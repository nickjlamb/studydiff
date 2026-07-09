// Shared shapes for StudyDiff, expressed as JSDoc typedefs so the codebase
// stays build-free (plain ESM) while still being type-checkable in editors.

/**
 * A single field of a study card. `value` is the extracted answer; `quote` is
 * the verbatim span from the source text that supports it (used for grounding).
 * When the source does not state the field, value MUST be "not reported" and
 * quote MUST be "".
 * @typedef {Object} Field
 * @property {string} value
 * @property {string} quote
 */

/**
 * The dimensions StudyDiff compares across papers. Keep this list stable – the
 * comparison and grounding logic iterate over it.
 * @typedef {Object} StudyCard
 * @property {string} pmid
 * @property {string} citation           short "Author et al. YEAR, Journal"
 * @property {Field}  finding            main result / direction of effect vs the question
 * @property {Field}  species
 * @property {Field}  model              model system / cell type / cohort
 * @property {Field}  intervention       intervention / comparator / exposure
 * @property {Field}  assay              key assay or analytical method
 * @property {Field}  dose               dose / concentration
 * @property {Field}  timing             timing / duration / follow-up
 * @property {Field}  endpoint           primary endpoint / readout
 * @property {Field}  sampleSize         n / sample size
 * @property {Field}  statistic          headline statistic (effect size, correlation, p)
 * @property {Field}  limitations
 * @property {'fulltext'|'abstract'|'pasted'} sourceDepth  how much text we read
 */

/** Dimensions compared, in display order. `finding` is the conclusion; the rest are design. */
export const DIMENSIONS = [
  'finding',
  'species',
  'model',
  'intervention',
  'assay',
  'dose',
  'timing',
  'endpoint',
  'sampleSize',
  'statistic',
  'limitations',
];

/** Human-readable labels for each dimension. */
export const DIMENSION_LABELS = {
  finding: 'Main finding',
  species: 'Species',
  model: 'Model system',
  intervention: 'Intervention',
  assay: 'Assay / method',
  dose: 'Dose',
  timing: 'Timing / follow-up',
  endpoint: 'Endpoint',
  sampleSize: 'Sample size',
  statistic: 'Key result',
  limitations: 'Limitations',
};

export const NOT_REPORTED = 'not reported';

/** @returns {Field} */
export const field = (value = NOT_REPORTED, quote = '') => ({ value, quote });
