// Comparison logic: given two study cards, decide where they agree and where
// they diverge, and rank the divergent DESIGN dimensions as candidate reasons
// the papers reach different conclusions. This is deterministic; the LLM's job
// was extraction, not adjudication.

import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED } from './types.mjs';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const reported = (f) => f && f.value && f.value !== NOT_REPORTED;

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
    const diverges = comparable && norm(av) !== norm(bv);
    return { dimension: d, label: DIMENSION_LABELS[d], a: av, b: bv, diverges, comparable };
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
