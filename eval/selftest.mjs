// `npm run eval:selftest` — validate the harness itself, offline, no API key.
//
// The eval's whole purpose is to produce a number worth trusting. That number is
// worthless if the scoring maths or the benchmark file are broken, so both are
// checked here rather than assumed. Runs in the sandbox and in CI.

import { DIMENSIONS, NOT_REPORTED, field } from '../src/types.mjs';
import { compareCards } from '../src/compare.mjs';
import { wilson, loadCases, SCORED_DIMENSIONS } from './lib.mjs';

let failures = 0;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ${GREEN('ok')}   ${name}`);
  } else {
    failures++;
    console.log(`  ${RED('FAIL')} ${name}${detail ? DIM(`  — ${detail}`) : ''}`);
  }
}

function near(a, b, tol = 0.001) {
  return Math.abs(a - b) < tol;
}

// --- 1. Wilson interval ------------------------------------------------------
// Reference values computed independently for the Wilson score interval.
console.log('\n' + BOLD('  Wilson interval'));
{
  const w = wilson(9, 15);
  check('9/15 -> [0.3575, 0.8018]', near(w.low, 0.3575, 0.001) && near(w.high, 0.8018, 0.001),
    `got [${w.low.toFixed(4)}, ${w.high.toFixed(4)}]`);

  const z = wilson(0, 15);
  check('0/15 lower bound is 0', near(z.low, 0));
  check('0/15 upper bound < 0.25 (not 0 — absence of hits is not proof of 0%)', z.high > 0 && z.high < 0.25,
    `got high=${z.high.toFixed(4)}`);

  const f = wilson(15, 15);
  check('15/15 upper bound is 1', near(f.high, 1));
  check('15/15 lower bound < 1 (15/15 is not proof of 100%)', f.low < 1 && f.low > 0.7,
    `got low=${f.low.toFixed(4)}`);

  check('n=0 does not divide by zero', (() => { const r = wilson(0, 0); return r.low === 0 && r.high === 0; })());
}

// --- 2. The fixed prior actually behaves as documented ------------------------
// If this ever stops being true, the baseline comparison is measuring the wrong
// thing and the eval is invalid.
console.log('\n' + BOLD('  DRIVER_RANK prior behaviour'));
{
  const mk = (over) => {
    const c = { pmid: 'x', citation: 'x', sourceDepth: 'abstract' };
    for (const d of DIMENSIONS) c[d] = field(NOT_REPORTED, '');
    for (const [k, v] of Object.entries(over)) c[k] = field(v, v);
    return c;
  };

  // assay diverges alongside timing -> assay must win, by construction.
  const a1 = mk({ finding: 'yes', assay: 'flow cytometry', timing: '3 hours' });
  const b1 = mk({ finding: 'no', assay: 'bisulfite seq', timing: '6 hours' });
  const r1 = compareCards(a1, b1);
  check('assay outranks timing whenever both diverge', r1.candidateReasons[0]?.dimension === 'assay',
    `top was ${r1.candidateReasons[0]?.dimension}`);

  // With assay absent, timing surfaces.
  const a2 = mk({ finding: 'yes', timing: '3 hours' });
  const b2 = mk({ finding: 'no', timing: '6 hours' });
  const r2 = compareCards(a2, b2);
  check('timing surfaces when assay does not diverge', r2.candidateReasons[0]?.dimension === 'timing',
    `top was ${r2.candidateReasons[0]?.dimension}`);

  // A dimension reported by only one paper is NOT comparable, so never a driver.
  const a3 = mk({ finding: 'yes', dose: '500000 IU' });
  const b3 = mk({ finding: 'no' });
  const r3 = compareCards(a3, b3);
  check('one-sided dimension is not a candidate driver', !r3.candidateReasons.some((r) => r.dimension === 'dose'));
  console.log(DIM('       ^ this is why causeVisibleInSource "partial" cases can be unwinnable too'));

  // The known weakness, asserted so it is measured rather than believed.
  const a4 = mk({ finding: 'yes', assay: 'Flow cytometry, ICS, bisulfite sequencing' });
  const b4 = mk({ finding: 'no', assay: 'Flow cytometry (FACS) for Foxp3' });
  const r4 = compareCards(a4, b4);
  check('near-identical assay strings still count as fully divergent (known weakness)',
    r4.candidateReasons[0]?.dimension === 'assay');
}

// --- 3. Benchmark file integrity ---------------------------------------------
console.log('\n' + BOLD('  cases.json integrity'));
{
  const data = loadCases();
  const cases = data.cases;
  check('file parses and has cases', cases.length > 0);
  check('15-20 cases as specified', cases.length >= 15 && cases.length <= 20, `got ${cases.length}`);

  const ids = cases.map((c) => c.id);
  check('case ids unique', new Set(ids).size === ids.length);

  let allLabelled = true, allCited = true, allEvidence = true, allVisible = true, validDims = true;
  for (const c of cases) {
    if (!c.label?.dimension || !c.label?.cause) allLabelled = false;
    if (!c.label?.citation?.pmid || !c.label?.citation?.establishes) allCited = false;
    if (!c.label?.evidence?.a || !c.label?.evidence?.b) allEvidence = false;
    if (!['yes', 'partial', 'no'].includes(c.label?.causeVisibleInSource)) allVisible = false;
    if (!SCORED_DIMENSIONS.includes(c.label?.dimension)) validDims = false;
    for (const d of c.label?.alsoAcceptable ?? []) if (!SCORED_DIMENSIONS.includes(d)) validDims = false;
    if (c.papers?.length !== 2) allLabelled = false;
  }
  check('every case has a primary label + one-sentence cause', allLabelled);
  check('every label has a citation with a PMID (no label without a source)', allCited);
  check('every case has evidence spans for both papers', allEvidence);
  check('every case has a valid causeVisibleInSource flag', allVisible);
  check('every labelled dimension is one the ranker can actually emit', validDims);

  const conf = cases.map((c) => c.label.confidence);
  check('every case has established|contested confidence', conf.every((c) => ['established', 'contested'].includes(c)));

  // THE constraint that makes or breaks the eval.
  const assayN = cases.filter((c) => c.label.dimension === 'assay').length;
  const frac = assayN / cases.length;
  check(`assay <= 1/3 of set (the constraint that makes the eval meaningful)`, frac <= 1 / 3,
    `assay is ${assayN}/${cases.length} = ${(frac * 100).toFixed(1)}%`);
  console.log(DIM(`       assay ${assayN}/${cases.length} = ${(frac * 100).toFixed(1)}%`));

  // Report the label distribution — if this collapses onto one dimension the
  // eval stops discriminating.
  const dist = {};
  for (const c of cases) dist[c.label.dimension] = (dist[c.label.dimension] ?? 0) + 1;
  console.log(DIM('       label distribution: ' + Object.entries(dist).sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${d}=${n}`).join(' · ')));
  check('at least 4 distinct dimensions represented', Object.keys(dist).length >= 4, `got ${Object.keys(dist).length}`);

  // A priori ceiling from the annotations. The measured ceiling comes from real
  // extraction in score.mjs; this is the paper-side bound.
  const invisible = cases.filter((c) => c.label.causeVisibleInSource === 'no').length;
  const partial = cases.filter((c) => c.label.causeVisibleInSource === 'partial').length;
  console.log(DIM(`       cause visible in neither abstract: ${invisible}/${cases.length} (unwinnable by construction)`));
  console.log(DIM(`       cause visible in only one:         ${partial}/${cases.length} (likely unwinnable)`));
  console.log(DIM(`       a priori ceiling <= ${(((cases.length - invisible) / cases.length) * 100).toFixed(1)}%`));
}

console.log('');
if (failures) {
  console.log(RED(`  ${failures} check(s) failed.\n`));
  process.exit(1);
}
console.log(GREEN('  all checks passed') + DIM(' — harness maths and benchmark file are internally consistent\n'));
