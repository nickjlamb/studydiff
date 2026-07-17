// Comparison logic: given two study cards, decide where they agree and where
// they diverge, and rank the divergent DESIGN dimensions as candidate reasons
// the papers reach different conclusions. This is deterministic; the LLM's job
// was extraction, not adjudication.

import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED } from './types.mjs';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const reported = (f) => f && f.value && f.value !== NOT_REPORTED;

// Function words carry no design information; keeping them would let two values
// look similar merely for both being English.
const STOP = new Set([
  'the', 'a', 'an', 'of', 'for', 'and', 'or', 'in', 'on', 'with', 'at', 'to', 'by',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'via', 'using', 'used', 'per',
  'that', 'this', 'these', 'those', 'both', 'its', 'their',
]);

// Digits are ALWAYS content, however short. Dropping single characters as noise
// silently destroyed timing and dose: "3 hours" and "6 hours" both reduced to
// {hours}, scored similarity 1.0, and stopped counting as divergent — which is the
// entire thrombolysis case (3 h vs 6 h). Caught by eval:selftest, not by the
// benchmark; a unit test found what a 15-case accuracy number never would have.
const contentTokens = (s) =>
  new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t) && (t.length > 1 || /\d/.test(t))));

/**
 * Jaccard similarity over content tokens: |A n B| / |A u B|.
 * 1 = same content, 0 = nothing shared.
 */
function similarity(av, bv) {
  const A = contentTokens(av);
  const B = contentTokens(bv);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Two values count as DIVERGENT only when they share less than half their content.
//
// 0.5 is the midpoint of the Jaccard scale — "they share more than they differ" vs
// "they differ more than they share". It is deliberately NOT tuned: no threshold was
// searched against the benchmark, because a threshold chosen to maximise the score
// would turn the eval into a training set and the number into a fiction.
export const DIVERGENCE_THRESHOLD = 0.5;

// Token overlap measures TOPIC, not POLARITY — so it must never be applied to a
// conclusion. Measured the hard way: applying it to `finding` made the tool declare
// "no contradiction" on Seok vs Takao, whose findings are
//   "Mouse models POORLY mimic human inflammatory diseases"
//   "Mouse models GREATLY mimic human inflammatory diseases"
// — maximal semantic opposition, ~0.7 Jaccard. Antonyms share almost all their
// tokens. Contradiction-detection got worse (2 -> 4 undetected) before this scope
// was added.
//
// These fields state a claim whose direction matters, so they keep the strict
// inequality. The design dimensions below are lists of methods/populations/doses,
// where shared content genuinely means "these are the same thing described
// differently" — which is exactly what the overlap test is for.
const POLARITY_FIELDS = new Set(['finding', 'limitations']);

// A FIXED PRIOR over which design differences tend to flip a conclusion, most-to-least.
// This is not an assessment of any particular pair of papers: if `assay` diverges at all,
// it is always ranked first. The prior is a reasonable default, but it is unmeasured —
// how often the top-ranked dimension is the established cause is an open question, and
// building the benchmark to answer it is the next roadmap item. Two known weaknesses:
//   1. `diverges` below is a string inequality, so two values that share most of their
//      content ("flow cytometry, ICS, bisulfite seq" vs "flow cytometry (FACS)") count
//      as fully divergent.
//   2. `assay` is coarse — a fate-mapping strategy and a staining panel are both "assay".
// (finding = the conclusion itself; limitations = commentary – both excluded.)
const DRIVER_RANK = {
  assay: 0,
  model: 1,
  intervention: 2,
  dose: 3,
  timing: 4,
  endpoint: 5,
  species: 6,
  sampleSize: 7,
  statistic: 8,
};

/**
 * @param {import('./types.mjs').StudyCard} a
 * @param {import('./types.mjs').StudyCard} b
 * @returns {{
 *   rows: Array<{dimension:string,label:string,a:string,b:string,diverges:boolean,comparable:boolean}>,
 *   findingsConflict: boolean,
 *   sharedDesign: string[],
 *   candidateReasons: Array<{dimension:string,label:string,a:string,b:string}>
 * }}
 */
export function compareCards(a, b) {
  const rows = DIMENSIONS.map((d) => {
    const av = a[d]?.value ?? NOT_REPORTED;
    const bv = b[d]?.value ?? NOT_REPORTED;
    const comparable = reported(a[d]) && reported(b[d]);
    // Graded, not binary. The old test was `norm(av) !== norm(bv)` — a string
    // inequality, so ANY paraphrase counted as full divergence. Measured
    // consequence: the extracted assay string differed on ~90% of re-runs, so
    // `assay` "diverged" in essentially every pair, so DRIVER_RANK (which puts
    // assay first) fired every time. The ranking was stable because the test was
    // trivially satisfied, not because extraction was reliable.
    const sim = comparable ? similarity(av, bv) : 0;
    const diverges = comparable && (POLARITY_FIELDS.has(d)
      ? norm(av) !== norm(bv)          // polarity matters: any difference counts
      : sim < DIVERGENCE_THRESHOLD);   // design: only count as divergent if little shared
    return { dimension: d, label: DIMENSION_LABELS[d], a: av, b: bv, diverges, comparable, similarity: sim };
  });

  const findingsConflict = rows.find((r) => r.dimension === 'finding')?.diverges ?? false;

  const sharedDesign = rows
    .filter((r) => r.dimension !== 'finding' && r.dimension !== 'limitations' && r.comparable && !r.diverges)
    .map((r) => r.label);

  const candidateReasons = rows
    .filter((r) => r.dimension !== 'finding' && r.dimension !== 'limitations' && r.diverges)
    .sort((x, y) => (DRIVER_RANK[x.dimension] ?? 99) - (DRIVER_RANK[y.dimension] ?? 99))
    .map((r) => ({ dimension: r.dimension, label: r.label, a: r.a, b: r.b }));

  return { rows, findingsConflict, sharedDesign, candidateReasons };
}
