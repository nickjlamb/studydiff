#!/usr/bin/env node
// StudyDiff as an MCP server – so Claude (or any agent) can call the contradiction
// engine directly instead of going through the web UI.
//
//   compare_studies(paperA, paperB, question?)  live: needs ANTHROPIC_API_KEY + network
//   compare_example(example)                    cached worked example: no key, no network
//   list_examples()                             the built-in worked examples
//
// The engine is unchanged: retrieve → extract (Claude tool-use) → verify (deterministic
// OpenGATE grounding) → compare → explain. Grounding runs BEFORE comparison, so anything
// the source can't back is downgraded to "not reported" before it can be cited. The tool
// never picks a winner and never reports a confidence it did not compute.
//
//   node src/mcp.mjs      (stdio transport)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DIMENSIONS } from './types.mjs';
import { fetchPaper, resolveDoiToPmid } from './ncbi.mjs';
import { extractCard } from './extract.mjs';
import { buildResult } from './pipeline.mjs';
import { toMarkdown } from './report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = ['mouse-inflammation', 'resveratrol-sirt1', 'treg-stability'];

/** Minimal .env loader so the key works without extra flags. */
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const fixture = (name) => JSON.parse(
  readFileSync(join(ROOT, 'fixtures', `${String(name).replace(/[^a-z0-9-]/gi, '')}.json`), 'utf8'),
);

function cardFromFixturePaper(p) {
  const card = { pmid: p.pmid, citation: p.citation, sourceDepth: p.sourceDepth };
  for (const d of DIMENSIONS) card[d] = p.card[d];
  return card;
}

/** A paper descriptor is either {id} (PMID or DOI) or {text} (raw abstract/methods). */
async function resolvePaper(desc, i) {
  if (desc?.text && desc.text.trim()) {
    return { pmid: '', citation: desc.citation || `Paper ${i + 1}`, title: '', text: desc.text, sourceDepth: 'pasted' };
  }
  if (desc?.id && desc.id.trim()) {
    const raw = desc.id.trim();
    const pmid = /^\d+$/.test(raw) ? raw : await resolveDoiToPmid(raw);
    return await fetchPaper(pmid);
  }
  throw new Error(`Paper ${i + 1}: provide "id" (a PMID or DOI) or "text" (the abstract/methods).`);
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ isError: true, content: [{ type: 'text', text }] });

const paperShape = z.object({
  id: z.string().optional().describe('PMID (e.g. "19633673") or DOI (e.g. "10.1126/science.1191996")'),
  citation: z.string().optional().describe('Short citation, used when supplying raw text (e.g. "Zhou et al. 2009")'),
  text: z.string().optional().describe('Raw abstract/methods text to analyse instead of fetching from PubMed'),
});

const server = new McpServer({ name: 'studydiff', version: '0.1.0' });

server.registerTool(
  'compare_studies',
  {
    title: 'Compare two studies and explain why they disagree',
    description:
      'Explain WHY two scientific papers reach different conclusions. Extracts each study design ' +
      '(species, model, intervention, assay, dose, timing, endpoint, sample size, statistic, finding, limitations), ' +
      'verifies every extracted value against the source text with deterministic grounding, then lists the design ' +
      'differences that could drive the disagreement (primary driver / also differs / ruled out – ordered by a fixed ' +
      'prior over dimensions, not by an assessment of this pair) and suggests ' +
      'what evidence would resolve it. Every claim is traced to a verbatim quote; unsupported fields are returned as ' +
      '"not reported" rather than guessed. Never picks a winner. Each paper is given as {id} (PMID or DOI) or {text}. ' +
      'Requires ANTHROPIC_API_KEY – use compare_example for a no-key demonstration.',
    inputSchema: {
      paperA: paperShape.describe('First study – {id} (PMID/DOI) or {citation, text}'),
      paperB: paperShape.describe('Second study – {id} (PMID/DOI) or {citation, text}'),
      question: z.string().optional().describe('The question under comparison, e.g. "Is the Treg lineage stable in vivo?"'),
    },
  },
  async ({ paperA, paperB, question }) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return fail('ANTHROPIC_API_KEY is not set, so live extraction is unavailable. Try compare_example("treg-stability") for a cached worked example that needs no key or network.');
    }
    try {
      const q = question || 'Why do these papers reach different conclusions?';
      const papers = [await resolvePaper(paperA, 0), await resolvePaper(paperB, 1)];
      // Both extractions run concurrently – the dominant cost of a run.
      const cards = await Promise.all(papers.map((p) => extractCard(p, q)));
      const result = buildResult(q, cards, papers.map((p) => p.text));
      return ok(toMarkdown(result));
    } catch (err) {
      return fail(`StudyDiff could not complete the comparison: ${err.message}`);
    }
  },
);

server.registerTool(
  'compare_example',
  {
    title: 'Run a cached worked example',
    description:
      'Run one of StudyDiff\'s built-in worked examples – real, famous contradictions with verbatim abstracts. ' +
      'Runs fully offline against cached papers: no API key and no network needed, so it is the quickest way to see ' +
      'the grounded output. Options: "mouse-inflammation" (Seok 2013 vs Takao 2015 – same datasets, opposite ' +
      'conclusions), "resveratrol-sirt1" (Howitz 2003 vs Beher 2009 – an assay artifact), "treg-stability" ' +
      '(Zhou 2009 vs Rubtsov 2010 – stable vs unstable Treg lineage, driven by the fate-mapping method).',
    inputSchema: { example: z.enum(EXAMPLES).describe('Which built-in example to run') },
  },
  async ({ example }) => {
    try {
      const fx = fixture(example);
      const cards = fx.papers.map(cardFromFixturePaper);
      const result = buildResult(fx.question, cards, fx.papers.map((p) => p.text));
      return ok(toMarkdown(result));
    } catch (err) {
      return fail(`Could not run example "${example}": ${err.message}`);
    }
  },
);

server.registerTool(
  'list_examples',
  {
    title: 'List the built-in worked examples',
    description: 'List StudyDiff\'s cached worked examples (real published contradictions) that can be run with compare_example without an API key.',
    inputSchema: {},
  },
  async () => {
    try {
      const lines = ['# StudyDiff worked examples', '', 'Run any of these with `compare_example` – no API key or network needed.', ''];
      for (const id of EXAMPLES) {
        const fx = fixture(id);
        lines.push(`### \`${id}\``);
        lines.push(`- **Question:** ${fx.question}`);
        lines.push(`- **Studies:** ${fx.papers.map((p) => p.citation).join('  vs  ')}`, '');
      }
      return ok(lines.join('\n'));
    } catch (err) {
      return fail(`Could not list examples: ${err.message}`);
    }
  },
);

await server.connect(new StdioServerTransport());
