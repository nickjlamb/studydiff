// "What would resolve this disagreement?" – the scientist's next question after
// seeing *where* two studies differ. These are deterministic, method-level next
// steps derived from the comparison we already computed (which dimensions diverge,
// and whether the studies share their data). They are framed as reasoning about what
// evidence is missing – NOT as claims extracted from the papers – so they stay on the
// right side of the grounding guarantee.
//
// This used to suggest varying candidateReasons[0] only, which quietly reintroduced the
// retired ranking through the back door: it named one dimension as *the* thing to test.
// It now offers the same suggestion for each divergent dimension, because the benchmark
// says StudyDiff has no basis for choosing between them.

/**
 * @param {{findingsConflict:boolean, candidateReasons:Array, sharedDesign:string[]}} comparison
 * @returns {string[]} suggested resolving evidence (empty when there's no conflict)
 */
export function resolvingEvidence(comparison) {
  if (!comparison.findingsConflict) return [];
  const out = [];
  const diffs = comparison.candidateReasons || [];
  const shared = comparison.sharedDesign || [];

  if (diffs.length === 1) {
    out.push(
      `Vary only the ${diffs[0].label.toLowerCase()}: applying both studies' approaches to the same data would isolate whether this difference – rather than the underlying biology – drives the divergence.`,
    );
  } else if (diffs.length) {
    const names = diffs.map((d) => d.label.toLowerCase());
    out.push(
      `Hold everything else constant and vary one of these at a time – ${names.join('; ')} – applying both studies' approaches to the same data. That isolates which difference, if any, drives the divergence rather than the underlying biology.`,
    );
  }

  // If both studies rest on the same experimental system/data, a reanalysis can't
  // settle it; if they don't, independent replication is the missing evidence.
  if (shared.includes('Model system') || shared.includes('Intervention')) {
    out.push(
      `Both studies share the same ${shared.includes('Model system') ? 'data/model system' : 'intervention'}, so resolving this calls for new, independent data – not a further reanalysis of the same source.`,
    );
  } else {
    out.push(
      `Independent replication in a separate cohort or dataset would test whether either result generalises beyond its original setup.`,
    );
  }

  return out;
}
