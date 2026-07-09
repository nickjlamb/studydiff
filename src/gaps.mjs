// Bounded gap detection. The ONLY safe claim a literature tool can make about
// absence is one scoped to the papers in front of it – never "no one has ever
// studied X". So we report two kinds of observation, both provably true of the
// compared set: shared constraints (every study did the same thing here, which
// bounds how far the conclusions generalise) and dimensions no study reported.

import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED } from './types.mjs';

const reported = (f) => f && f.value && f.value !== NOT_REPORTED;
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * @param {import('./types.mjs').StudyCard[]} cards
 * @returns {{sharedConstraints:string[], unreported:string[]}}
 */
export function findGaps(cards) {
  const sharedConstraints = [];
  const unreported = [];

  for (const d of DIMENSIONS) {
    if (d === 'finding' || d === 'limitations' || d === 'statistic') continue;
    const fields = cards.map((c) => c[d]);
    const allReported = fields.every(reported);
    const noneReported = fields.every((f) => !reported(f));

    if (allReported) {
      const values = fields.map((f) => norm(f.value));
      if (values.every((v) => v === values[0])) {
        sharedConstraints.push(
          `All compared studies share the same ${DIMENSION_LABELS[d].toLowerCase()} (${cards[0][d].value}), so the disagreement is not explained by this factor.`,
        );
      }
    } else if (noneReported) {
      unreported.push(
        `None of the compared studies reports ${DIMENSION_LABELS[d].toLowerCase()}.`,
      );
    }
  }
  return { sharedConstraints, unreported };
}
