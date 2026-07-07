// StudyDiff local server. Serves the browser UI and runs the pipeline server-side
// so your ANTHROPIC_API_KEY never reaches the browser. Streams pipeline progress
// to the page as newline-delimited JSON (NDJSON) so the UI can show each step
// lighting up — fetch → extract → verify → compare.
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
import { fetchPaper } from './ncbi.mjs';
import { extractCard } from './extract.mjs';
import { buildResult } from './pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const PORT = process.env.PORT || 4173;

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

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

/** Run the pipeline while streaming step events. `mode` = demo | pmid | paste. */
async function runStreaming(res, body) {
  const mode = body.mode || 'pmid';
  const question = body.question || 'Why do these papers reach different conclusions?';

  res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' });

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
      step(res, 'extractA', 'active', `Extracting study design — ${papers[0].citation}`);
      await sleep(500);
      step(res, 'extractA', 'done', `Study card ready — ${papers[0].citation}`);
      step(res, 'extractB', 'active', `Extracting study design — ${papers[1].citation}`);
      await sleep(500);
      step(res, 'extractB', 'done', `Study card ready — ${papers[1].citation}`);
      cards = papers.map(cardFromFixturePaper);
      // buildResult grounds then compares; return question from fixture if none given.
      finishAndSend(res, fx.question || question, cards, texts);
      return;
    }

    if (mode === 'paste') {
      const papers = (body.papers || []).slice(0, 2);
      if (papers.length !== 2) throw new Error('Provide two papers (title + text) to compare.');
      step(res, 'fetch', 'done', 'Using pasted text');
      texts = papers.map((p) => p.text || '');
      cards = [];
      for (let i = 0; i < papers.length; i++) {
        const id = i === 0 ? 'extractA' : 'extractB';
        const p = { pmid: '', citation: papers[i].citation || `Paper ${i + 1}`, title: papers[i].title || '', text: texts[i], sourceDepth: 'pasted' };
        step(res, id, 'active', `Extracting study design — ${p.citation}`);
        cards.push(await extractCard(p, question));
        step(res, id, 'done', `Study card ready — ${p.citation}`);
      }
      finishAndSend(res, question, cards, texts);
      return;
    }

    // mode === 'pmid'
    const pmids = (body.pmids || []).slice(0, 2);
    if (pmids.length !== 2) throw new Error('Provide exactly two PMIDs.');
    step(res, 'fetch', 'active', `Fetching PubMed ${pmids.join(' & ')}`);
    const papers = [];
    for (const pmid of pmids) papers.push(await fetchPaper(pmid)); // sequential — NCBI rate limits
    texts = papers.map((p) => p.text);
    step(res, 'fetch', 'done', `Fetched: ${papers.map((p) => `${p.citation} [${p.sourceDepth}]`).join('  ·  ')}`);
    cards = [];
    for (let i = 0; i < papers.length; i++) {
      const id = i === 0 ? 'extractA' : 'extractB';
      step(res, id, 'active', `Extracting study design — ${papers[i].citation}`);
      cards.push(await extractCard(papers[i], question));
      step(res, id, 'done', `Study card ready — ${papers[i].citation}`);
    }
    finishAndSend(res, question, cards, texts);
  } catch (err) {
    send(res, { type: 'error', message: err.message });
    res.end();
  }
}

async function finishAndSend(res, question, cards, texts) {
  step(res, 'verify', 'active', 'Verifying every claim against the source (OpenGATE)');
  await sleep(300);
  const result = buildResult(question, cards, texts);
  step(res, 'verify', 'done', 'Grounding complete');
  step(res, 'compare', 'active', 'Explaining the disagreement');
  await sleep(200);
  step(res, 'compare', 'done', 'Comparison ready');
  send(res, { type: 'result', payload: result });
  res.end();
}

const CONTENT = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api/compare') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    return runStreaming(res, body);
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, live: Boolean(process.env.ANTHROPIC_API_KEY) }));
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
