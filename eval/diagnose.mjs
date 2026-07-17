// `npm run eval:diagnose` — explain WHY the ceiling is where it is.
//
// The headline eval says the ranker ties the "always guess assay" baseline. This
// script answers the more useful question: what stopped the established cause
// from even being a CANDIDATE?
//
// It splits the loss into two stages:
//
//   stage 1  extraction — did the model put the labelled dimension in the card,
//                         with different values for the two papers?
//   stage 2  grounding  — did buildResult's grounding step then DOWNGRADE it to
//                         "not reported" because the quote or a number failed to
//                         verify?
//
// Stage 2 is the surprising one and it is where most of the loss lives. Offline;
// reads the same cache as `npm run eval`.

import { DIMENSIONS } from '../src/types.mjs';
import { buildResult } from '../src/pipeline.mjs';
import { groundField } from '../src/grounding.mjs';
import { contains } from '@pharmatools/opengate/grounding';
import { readFileSync, existsSync } from 'node:fs';
import { loadCases, cachePath, parseDepth, cell } from './lib.mjs';

const depth = parseDepth(process.argv.slice(2));

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const NR = 'not reported';

function load(caseId, pmid) {
  const p = cachePath(caseId, pmid, depth);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

const data = loadCases();
let preGround = 0, postGround = 0, killed = 0, total = 0;
const rows = [];

console.log('\n' + BOLD('  Where the signal is lost') + DIM(`  · arm: ${depth}`) + '\n');

for (const c of data.cases) {
  const entries = c.papers.map((p) => load(c.id, p.pmid));
  if (entries.some((e) => !e)) continue;
  total++;
  const L = c.label.dimension;

  // Stage 1: is the labelled dimension divergent in the RAW extracted cards?
  const [ra, rb] = entries.map((e) => e.card[L]);
  const rawOk = ra?.value !== NR && rb?.value !== NR && norm(ra.value) !== norm(rb.value);
  if (rawOk) preGround++;

  // Stage 2: does it survive grounding?
  const cards = entries.map((e, i) => {
    const card = { pmid: c.papers[i].pmid, citation: c.papers[i].citation, sourceDepth: e.sourceDepth };
    for (const d of DIMENSIONS) card[d] = e.card[d];
    return card;
  });
  const result = buildResult(c.question, cards, entries.map((e) => e.text));
  const survives = result.comparison.candidateReasons.some((r) => r.dimension === L);
  if (survives) postGround++;
  if (rawOk && !survives) killed++;

  rows.push({ id: c.id, L, rawOk, survives, killedBy: rawOk && !survives });
}

console.log('  ' + cell('case', 34) + cell('label', 11) + cell('extracted?', 12) + 'survives grounding?');
for (const r of rows) {
  console.log(
    '  ' + cell(r.id, 34) + cell(r.L, 11) +
    cell(r.rawOk ? 'yes' : 'no', 12) +
    (r.killedBy ? RED('NO — killed by grounding') : r.survives ? GREEN('yes') : DIM('n/a (never extracted)')),
  );
}

console.log('\n' + BOLD('  Funnel'));
console.log(`    labelled dimension divergent in raw extraction   ${preGround}/${total}`);
console.log(`    still a candidate after grounding                ${postGround}/${total}`);
console.log(RED(`    LOST TO GROUNDING                               ${killed}/${total}`));
console.log(DIM('    ^ the ranker never sees these. Re-ranking cannot recover them.'));

// --- Why each grounding downgrade fired -------------------------------------
let quoteMissing = 0, numberFail = 0, noQuote = 0;
const examples = { quote: [], number: [] };
for (const c of data.cases) {
  for (const p of c.papers) {
    const e = load(c.id, p.pmid);
    if (!e) continue;
    for (const [dim, fld] of Object.entries(e.card)) {
      const r = groundField(fld, e.text);
      if (r.grounded) continue;
      if (!fld.quote) { noQuote++; continue; }
      if (!contains(e.text, fld.quote)) {
        quoteMissing++;
        if (examples.quote.length < 4) examples.quote.push({ id: c.id, dim, q: fld.quote });
      } else {
        numberFail++;
        if (examples.number.length < 4) examples.number.push({ id: c.id, dim, v: fld.value, why: r.reason });
      }
    }
  }
}

console.log('\n' + BOLD('  Why grounding rejected fields'));
console.log(`    quote not an exact substring of source   ${quoteMissing}`);
console.log(`    a number in the value did not trace      ${numberFail}`);
console.log(`    no quote supplied                        ${noQuote}`);

console.log('\n' + YELLOW('  Quote-not-found examples') + DIM(' (note ellipses and reformatting):'));
for (const x of examples.quote) console.log(DIM(`    ${x.id} / ${x.dim}\n      ${JSON.stringify(x.q).slice(0, 100)}`));

console.log('\n' + YELLOW('  Number-not-traceable examples') + DIM(' (some are TRUE catches, some are false positives):'));
for (const x of examples.number) console.log(DIM(`    ${x.id} / ${x.dim}\n      value: ${JSON.stringify(x.v).slice(0, 90)}\n      ${x.why.slice(0, 100)}`));

console.log('\n' + BOLD('  Read this carefully before "fixing" grounding'));
console.log(DIM('    Grounding is the trust layer. Some of these rejections are CORRECT —'));
console.log(DIM('    e.g. the OSC card claimed "97% of originals" and 97 appears nowhere in'));
console.log(DIM('    that abstract. That is OpenGATE doing its job and catching a real'));
console.log(DIM('    fabrication. Others look like false positives: "5-HTTLPR" contains the'));
console.log(DIM('    digit 5 and is checked as if it were a numeric claim, and a source that'));
console.log(DIM('    spells "Thirty-six percent" fails a value written as "36%".'));
console.log(DIM('    Loosening this trades a measured false-positive rate for an UNMEASURED'));
console.log(DIM('    false-negative rate. Do not do it by feel — measure both.'));
console.log('');
