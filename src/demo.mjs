// Offline demo – runs the whole downstream pipeline on real, cached PubMed
// abstracts with example study cards, so it needs no API key and no network.
// `npm run demo`
//
// It also shows the money shot: OpenGATE catching a fabricated statistic that a
// naive summariser might emit, and refusing to let it through as fact.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIMENSIONS } from './types.mjs';
import { buildResult } from './pipeline.mjs';
import { groundSynthesis } from './grounding.mjs';
import { renderResult } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Pick a fixture:  npm run demo -- resveratrol-sirt1   (default: mouse-inflammation)
const fixtureName = (process.argv[2] || 'mouse-inflammation').replace(/\.json$/, '');
const fixturePath = join(here, '..', 'fixtures', `${fixtureName}.json`);
const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));

// Assemble full StudyCards from the fixture (card fields + identity + provenance).
const cards = fx.papers.map((p) => {
  const card = { pmid: p.pmid, citation: p.citation, sourceDepth: p.sourceDepth };
  for (const d of DIMENSIONS) card[d] = p.card[d];
  return card;
});
const texts = fx.papers.map((p) => p.text);

const result = buildResult(fx.question, cards, texts);
console.log(renderResult(result));

// --- The verification wow: catch a hallucinated number -----------------------
const combined = texts.join('\n\n');
const naive = fx.naiveClaim || 'This treatment works, with a 0.85 effect size across all datasets.';
const check = groundSynthesis(naive, combined);

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(BOLD('  Guardrail demo – a naive summary vs. grounding'));
console.log(DIM('  Naive claim: ') + `"${naive}"`);
if (!check.grounded) {
  console.log('  OpenGATE verdict: ' + RED('✗ rejected'));
  for (const i of check.issues) console.log('    - ' + i);
  console.log(DIM('  → StudyDiff would not surface this – the flagged figure is nowhere in either paper.'));
} else {
  console.log('  OpenGATE verdict: ' + GREEN('✓ grounded'));
}
console.log('');
