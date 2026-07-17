// `npm run eval:audit` — dump grounding's decisions for independent adjudication.
//
// Phase 2, step 1. The eval showed grounding downgrades the labelled dimension in
// 7/15 cases. Before touching the trust layer we need to know whether those
// rejections are WRONG (false positives — the source does support the value) or
// RIGHT (true catches — the value really is unsupported).
//
// This script does not adjudicate. It extracts the evidence and writes it to
// eval/audit/grounding-audit.json so a human, or an independent reviewer, can
// judge each case against the source text. Grounding is the trust layer; the
// decision to loosen it must be evidence-led, not vibes-led.
//
// Emits BOTH directions:
//   rejections — every downgraded field (measures the FALSE POSITIVE rate)
//   accepted   — a deterministic sample of passing fields (measures the FALSE
//                NEGATIVE rate, which is the dangerous direction)

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { groundField } from '../src/grounding.mjs';
import { contains } from '@pharmatools/opengate/grounding';
import { DIMENSIONS } from '../src/types.mjs';
import { loadCases, cachePath, parseDepth, EVAL_DIR } from './lib.mjs';

const depth = parseDepth(process.argv.slice(2));
const OUT_DIR = join(EVAL_DIR, 'audit');
const NR = 'not reported';

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

/** Deterministic sample: hash the key so the sample never changes between runs. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const data = loadCases();
const rejections = [];
const accepted = [];

for (const c of data.cases) {
  for (const p of c.papers) {
    const f = cachePath(c.id, p.pmid, depth);
    if (!existsSync(f)) continue;
    const e = JSON.parse(readFileSync(f, 'utf8'));
    // Iterate DIMENSIONS only. An earlier version walked Object.entries(card),
    // which also picked up `pmid`/`citation`/`sourceDepth` — plain strings, not
    // {value,quote} fields. Those trivially "passed" grounding with "nothing to
    // verify" and padded the accepted sample by 30%, flattering the accept rate
    // while testing nothing. Caught by the audit's own adjudicator.
    for (const dim of DIMENSIONS) {
      const fld = e.card[dim];
      if (!fld || typeof fld !== 'object' || fld.value === NR) continue;
      const r = groundField(fld, e.text);
      const rec = {
        caseId: c.id,
        pmid: p.pmid,
        citation: p.citation,
        dimension: dim,
        isLabelledDimension: dim === c.label.dimension,
        value: fld.value,
        quote: fld.quote,
        quoteIsLiteralSubstring: fld.quote ? contains(e.text, fld.quote) : false,
        groundingReason: r.reason,
        sourceText: e.text,
      };
      if (!r.grounded) rejections.push(rec);
      else accepted.push(rec);
    }
  }
}

// Sample accepted fields for the FN check. Deterministic, so the audit is
// reproducible and cannot be re-rolled until it looks good.
const SAMPLE_N = 30;
const sampled = accepted
  .map((a) => ({ a, h: hash(`${a.caseId}|${a.pmid}|${a.dimension}`) }))
  .sort((x, y) => x.h - y.h)
  .slice(0, SAMPLE_N)
  .map((x) => x.a);

mkdirSync(OUT_DIR, { recursive: true });
const out = {
  generated: new Date().toISOString(),
  depthArm: depth,
  purpose:
    'Adjudicate grounding. For each REJECTION: does the source text actually support the value? ' +
    'If yes -> FALSE POSITIVE (grounding was wrong). If no -> TRUE CATCH (grounding was right). ' +
    'For each ACCEPTED sample: does the source support the value? If no -> FALSE NEGATIVE.',
  totals: {
    fieldsAsserted: rejections.length + accepted.length,
    rejected: rejections.length,
    accepted: accepted.length,
    acceptedSampled: sampled.length,
  },
  rejections,
  acceptedSample: sampled,
};
const path = join(OUT_DIR, 'grounding-audit.json');
writeFileSync(path, JSON.stringify(out, null, 2));

console.log('\n' + BOLD('  Grounding audit — evidence dumped for adjudication') + DIM(` · arm: ${depth}`));
console.log('');
console.log(`    fields asserting a value   ${out.totals.fieldsAsserted}`);
console.log(`    rejected by grounding      ${out.totals.rejected}   ${DIM('-> audit for FALSE POSITIVES')}`);
console.log(`    accepted by grounding      ${out.totals.accepted}   ${DIM(`-> ${sampled.length} sampled for FALSE NEGATIVES`)}`);
console.log('');
console.log(DIM(`    written to ${path}`));
console.log(DIM('    This script does not judge. Adjudicate against sourceText, then'));
console.log(DIM('    record verdicts in eval/audit/grounding-verdicts.json.'));
console.log('');

// Breakdown of the mechanical cause, which is all we can know without judging.
const byCause = { quoteNotSubstring: 0, numberNotTraceable: 0 };
for (const r of rejections) {
  if (!r.quoteIsLiteralSubstring) byCause.quoteNotSubstring++;
  else byCause.numberNotTraceable++;
}
console.log(BOLD('  Mechanical cause of rejection') + DIM('  (not yet a verdict)'));
console.log(`    quote not a literal substring   ${byCause.quoteNotSubstring}`);
console.log(`    number in value did not trace   ${byCause.numberNotTraceable}`);
console.log('');
