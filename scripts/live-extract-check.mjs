// Dev check: run the REAL Claude extractor on the fixture abstracts and compare
// the model's study cards to the hand-authored golden cards.
//   node --env-file=.env scripts/live-extract-check.mjs
// Needs ANTHROPIC_API_KEY. Uses only the Claude API (no NCBI), so it runs anywhere.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED } from '../src/types.mjs';
import { extractCard } from '../src/extract.mjs';
import { buildResult } from '../src/pipeline.mjs';
import { renderResult } from '../src/render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, '..', 'fixtures', 'mouse-inflammation.json'), 'utf8'));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isReported = (v) => v && v !== NOT_REPORTED;

console.log('Running live extraction on both abstracts…\n');
const liveCards = [];
for (const p of fx.papers) {
  const paper = { pmid: p.pmid, citation: p.citation, title: p.title, text: p.text, sourceDepth: p.sourceDepth };
  const card = await extractCard(paper, fx.question);
  liveCards.push(card);
}

const texts = fx.papers.map((p) => p.text);
const result = buildResult(fx.question, liveCards, texts);
console.log(renderResult(result));

// --- Diff live vs golden ------------------------------------------------------
console.log('  Live vs golden (agreement on reported-ness + value overlap):');
for (let i = 0; i < fx.papers.length; i++) {
  console.log(`\n  ${fx.papers[i].citation}`);
  for (const d of DIMENSIONS) {
    const gold = fx.papers[i].card[d].value;
    const live = liveCards[i][d].value;
    const sameReported = isReported(gold) === isReported(live);
    const overlap = norm(live).includes(norm(gold).split(' ')[0]) || norm(gold).includes(norm(live).split(' ')[0]);
    const flag = !sameReported ? '✗ reported-ness differs' : (isReported(gold) && !overlap ? '~ wording differs' : '✓');
    console.log(`    ${DIMENSION_LABELS[d].padEnd(18)} ${flag}`);
    if (flag !== '✓') {
      console.log(`        gold: ${gold}`);
      console.log(`        live: ${live}`);
    }
  }
}
console.log('');
