// StudyDiff local server. Serves the browser UI and runs the pipeline server-side
// so your ANTHROPIC_API_KEY never reaches the browser. Streams pipeline progress
// to the page as newline-delimited JSON (NDJSON) so the UI can show each step
// lighting up – fetch → extract → verify → compare.
//
//   node --env-file=.env src/server.mjs      (live: needs key + network)
//   npm run serve                            (loads .env if present)
//
// Zero runtime dependencies beyond @pharmatools/opengate (via the pipeline).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIMENSIONS } from './types.mjs';
import { fetchPaper, resolveDoiToPmid } from './ncbi.mjs';
import { extractCard } from './extract.mjs';
import { buildResult } from './pipeline.mjs';
import { pdfToText } from './pdf.mjs';
import { clientIp, createLimiter, createCache, securityHeaders } from './guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const PORT = process.env.PORT || 4173;
const MAX_BODY = 8 * 1024 * 1024;   // 8 MB – holds two full-text PDFs' extracted text (JSON), not just abstracts
const MAX_PDF = 15 * 1024 * 1024;   // 15 MB – a generous single-paper PDF ceiling

// Domains allowed to embed the app in an iframe (so pharmatools.ai/studydiff can
// frame studydiff.pharmatools.ai). Override with EMBED_ORIGINS if needed.
const EMBED_ORIGINS = process.env.EMBED_ORIGINS || "'self' https://pharmatools.ai https://*.pharmatools.ai";

const limiter = createLimiter({
  perHour: Number(process.env.RATE_LIMIT_PER_HOUR) || 30,
  dailyGlobalLive: Number(process.env.DAILY_LIVE_CAP) || 300,
});
const cache = createCache({ ttlMs: 6 * 3600_000 });

// Minimal .env loader so `npm run serve` works without the --env-file flag.
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fixture(name) {
  const safe = String(name).replace(/[^a-z0-9-]/gi, '');
  return JSON.parse(readFileSync(join(ROOT, 'fixtures', `${safe}.json`), 'utf8'));
}

function cardFromFixturePaper(p) {
  const card = { pmid: p.pmid, citation: p.citation, sourceDepth: p.sourceDepth };
  for (const d of DIMENSIONS) card[d] = p.card[d];
  return card;
}

/** Write one NDJSON event. */
const send = (res, obj) => res.write(JSON.stringify(obj) + '\n');
const step = (res, id, status, label) => send(res, { type: 'step', id, status, label });

/** Extract both study cards concurrently, streaming per-paper progress. Halves the
 *  wall-clock vs. sequential extraction (two Claude calls) – the dominant cost of a run. */
async function extractCardsStreaming(res, papers, question) {
  return Promise.all(papers.map(async (p, i) => {
    const id = i === 0 ? 'extractA' : 'extractB';
    step(res, id, 'active', `Extracting study design – ${p.citation}`);
    const card = await extractCard(p, question);
    step(res, id, 'done', `Study card ready – ${p.citation}`);
    return card;
  }));
}

async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('Request too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function readBody(req) {
  const buf = await readRaw(req, MAX_BODY);
  return buf.length ? JSON.parse(buf.toString('utf8')) : {};
}

const cacheKey = (body) => JSON.stringify({
  m: body.mode, q: body.question, p: body.pmids, f: body.fixture,
  papers: (body.papers || []).map((x) => ({ id: x.id || '', t: (x.text || '').slice(0, 200) })),
});

const STEP_IDS = ['fetch', 'extractA', 'extractB', 'verify', 'compare'];

/** Run the pipeline while streaming step events. `mode` = demo | pmid | paste. */
async function runStreaming(res, body, ip) {
  const mode = body.mode || 'pmid';
  const isLive = mode === 'pmid' || mode === 'paste';
  const question = body.question || 'Why do these papers reach different conclusions?';

  res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' });
  res.flushHeaders?.();  // push headers immediately so the proxy opens the stream now, not at the end

  // Rate limit (protects the API budget); live calls also count toward a daily cap.
  const rl = limiter.check(ip, isLive);
  if (!rl.ok) { send(res, { type: 'error', message: rl.reason }); return res.end(); }

  // Serve a cached result instantly if we've computed this exact comparison recently.
  const key = cacheKey(body);
  const hit = cache.get(key);
  if (hit) {
    for (const id of STEP_IDS) step(res, id, 'done', null);
    send(res, { type: 'result', payload: hit });
    return res.end();
  }

  try {
    let cards;
    let texts;

    if (mode === 'demo') {
      const fx = fixture(body.fixture || 'mouse-inflammation');
      step(res, 'fetch', 'active', 'Loading cached papers');
      await sleep(400);
      const papers = fx.papers;
      texts = papers.map((p) => p.text);
      step(res, 'fetch', 'done', `Loaded ${papers.length} papers`);
      step(res, 'extractA', 'active', `Extracting study design – ${papers[0].citation}`);
      await sleep(500);
      step(res, 'extractA', 'done', `Study card ready – ${papers[0].citation}`);
      step(res, 'extractB', 'active', `Extracting study design – ${papers[1].citation}`);
      await sleep(500);
      step(res, 'extractB', 'done', `Study card ready – ${papers[1].citation}`);
      cards = papers.map(cardFromFixturePaper);
      // buildResult grounds then compares; return question from fixture if none given.
      finishAndSend(res, fx.question || question, cards, texts, key);
      return;
    }

    if (mode === 'paste') {
      const papers = (body.papers || []).slice(0, 2);
      if (papers.length !== 2) throw new Error('Provide two papers (title + text) to compare.');
      step(res, 'fetch', 'done', 'Using pasted text');
      texts = papers.map((p) => p.text || '');
      const pasteObjs = papers.map((pp, i) => ({ pmid: '', citation: pp.citation || `Paper ${i + 1}`, title: pp.title || '', text: texts[i], sourceDepth: 'pasted' }));
      cards = await extractCardsStreaming(res, pasteObjs, question);
      finishAndSend(res, question, cards, texts, key);
      return;
    }

    if (mode === 'papers') {
      // Unified per-paper input: each descriptor is {id} (PMID or DOI) or {citation,text}.
      const descriptors = (body.papers || []).slice(0, 2);
      if (descriptors.length !== 2) throw new Error('Provide two papers to compare.');
      step(res, 'fetch', 'active', 'Resolving papers…');
      const papers = [];
      for (let i = 0; i < descriptors.length; i++) {
        const d = descriptors[i];
        if (d.text && d.text.trim()) {
          papers.push({ pmid: '', citation: d.citation || `Paper ${i + 1}`, title: '', text: d.text, sourceDepth: d.sourceDepth || 'pasted' });
        } else if (d.id && d.id.trim()) {
          const raw = d.id.trim();
          const pmid = /^\d+$/.test(raw) ? raw : await resolveDoiToPmid(raw);
          papers.push(await fetchPaper(pmid));
        } else {
          throw new Error(`Paper ${i + 1}: provide a PMID/DOI, upload a PDF, or paste text.`);
        }
      }
      texts = papers.map((p) => p.text);
      step(res, 'fetch', 'done', `Fetched: ${papers.map((p) => `${p.citation} [${p.sourceDepth}]`).join('  ·  ')}`);
      cards = await extractCardsStreaming(res, papers, question);
      finishAndSend(res, question, cards, texts, key);
      return;
    }

    // mode === 'pmid'
    const pmids = (body.pmids || []).slice(0, 2);
    if (pmids.length !== 2) throw new Error('Provide exactly two PMIDs.');
    step(res, 'fetch', 'active', `Fetching PubMed ${pmids.join(' & ')}`);
    const papers = [];
    for (const pmid of pmids) papers.push(await fetchPaper(pmid)); // sequential – NCBI rate limits
    texts = papers.map((p) => p.text);
    step(res, 'fetch', 'done', `Fetched: ${papers.map((p) => `${p.citation} [${p.sourceDepth}]`).join('  ·  ')}`);
    cards = await extractCardsStreaming(res, papers, question);
    finishAndSend(res, question, cards, texts, key);
  } catch (err) {
    send(res, { type: 'error', message: err.message });
    res.end();
  }
}

async function finishAndSend(res, question, cards, texts, key) {
  step(res, 'verify', 'active', 'Verifying every claim against the source (OpenGATE)');
  const result = buildResult(question, cards, texts);
  step(res, 'verify', 'done', 'Grounding complete');
  step(res, 'compare', 'active', 'Explaining the disagreement');
  step(res, 'compare', 'done', 'Comparison ready');
  if (key) cache.set(key, result);
  send(res, { type: 'result', payload: result });
  res.end();
}

const CONTENT = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  securityHeaders(res, { embedOrigins: EMBED_ORIGINS });
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api/compare') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      res.writeHead(413, { 'content-type': 'application/x-ndjson' });
      res.end(JSON.stringify({ type: 'error', message: err.message || 'bad request' }) + '\n');
      return;
    }
    return runStreaming(res, body, clientIp(req));
  }
  if (req.method === 'POST' && url.pathname === '/api/extract-pdf') {
    const rl = limiter.check(clientIp(req), false);
    const reply = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (!rl.ok) return reply(429, { error: rl.reason });
    try {
      const buf = await readRaw(req, MAX_PDF);
      const out = await pdfToText(buf);
      return reply(200, out);
    } catch (err) {
      const tooBig = /too large/i.test(err.message);
      return reply(tooBig ? 413 : 422, { error: tooBig ? 'PDF exceeds the 15 MB limit.' : err.message });
    }
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, live: Boolean(process.env.ANTHROPIC_API_KEY), ...limiter.stats() }));
    return;
  }
  // static
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const ext = file.slice(file.lastIndexOf('.'));
  try {
    const data = await readFile(join(ROOT, 'public', file));
    res.writeHead(200, { 'content-type': CONTENT[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, () => {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`StudyDiff running at http://localhost:${PORT}`);
  console.log(live ? '  live mode: ANTHROPIC_API_KEY detected' : '  demo mode only: no ANTHROPIC_API_KEY (examples still work)');
});
