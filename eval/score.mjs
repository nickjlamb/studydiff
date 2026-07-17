// `npm run eval` — score StudyDiff's driver ranking against the benchmark.
//
// Offline and pure: reads eval/cases.json and the cached cards in eval/cache/,
// runs the real pipeline (buildResult), and reports:
//
//   1. Top-1 accuracy   — how often the top-ranked driver IS the established cause
//   2. Baseline         — "always guess assay", the fixed prior's degenerate case
//   3. Oracle ceiling   — how often the established cause is even REACHABLE:
//                         i.e. it appears among the candidate drivers at all.
//                         Ranking cannot fix a dimension that was never a
//                         candidate, so this bounds what any re-ranking can do.
//
// If (1) ties (2), the ranker adds nothing over a constant guess. That is a
// real result and it gets published as-is. See EVAL.md.

import { DIMENSIONS } from '../src/types.mjs';
import { buildResult } from '../src/pipeline.mjs';
import { loadCases, readCache, withCI, pct, cell, SCORED_DIMENSIONS, parseDepth } from './lib.mjs';

const depth = parseDepth(process.argv.slice(2));

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

const BASELINE_DIMENSION = 'assay';

function assembleCards(caseDef) {
  const cards = [];
  const texts = [];
  const depths = [];
  for (const p of caseDef.papers) {
    const cached = readCache(caseDef.id, p.pmid, depth);
    if (!cached) return null;
    const card = { pmid: p.pmid, citation: p.citation, sourceDepth: cached.sourceDepth ?? 'abstract' };
    for (const d of DIMENSIONS) card[d] = cached.card[d];
    cards.push(card);
    texts.push(cached.text);
    depths.push(cached.sourceDepth ?? 'abstract');
  }
  return { cards, texts, depths };
}

function scoreCase(caseDef) {
  const assembled = assembleCards(caseDef);
  if (!assembled) return { id: caseDef.id, missing: true };

  const asymmetric = new Set(assembled.depths).size > 1;
  const result = buildResult(caseDef.question, assembled.cards, assembled.texts);
  const candidates = result.comparison.candidateReasons.map((r) => r.dimension);
  const top = candidates[0] ?? null;

  const label = caseDef.label;
  const strict = top === label.dimension;
  const lenient = strict || (label.alsoAcceptable ?? []).includes(top);
  // An oracle that could re-rank perfectly still only wins if the labelled
  // dimension is a candidate at all. This is the ceiling on any ranking fix.
  const reachable = candidates.includes(label.dimension);

  return {
    id: caseDef.id,
    missing: false,
    top,
    candidates,
    labelDim: label.dimension,
    strict,
    lenient,
    reachable,
    baseline: label.dimension === BASELINE_DIMENSION,
    confidence: label.confidence,
    visible: label.causeVisibleInSource,
    findingsConflict: result.comparison.findingsConflict,
    depths: assembled.depths,
    asymmetric,
  };
}

function confusionMatrix(rows) {
  const dims = SCORED_DIMENSIONS.filter(
    (d) => rows.some((r) => r.labelDim === d) || rows.some((r) => r.top === d),
  );
  const preds = [...dims, 'none'];
  const W = 11;
  let out = '';
  out += DIM('  rows = established cause (label) · cols = top-ranked driver (predicted)\n\n');
  out += '  ' + cell('', 12) + preds.map((p) => cell(p, W)).join('') + '\n';
  for (const truth of dims) {
    const line = rows.filter((r) => r.labelDim === truth);
    if (!line.length) continue;
    out += '  ' + cell(truth, 12);
    for (const p of preds) {
      const n = line.filter((r) => (r.top ?? 'none') === p).length;
      const s = n === 0 ? DIM('.') : truth === p ? GREEN(String(n)) : RED(String(n));
      out += s + ''.padEnd(W - 1);
    }
    out += '\n';
  }
  return out;
}

function main() {
  const data = loadCases();
  const rows = data.cases.map(scoreCase);
  const missing = rows.filter((r) => r.missing);
  const scored = rows.filter((r) => !r.missing);

  console.log('');
  console.log(BOLD('  StudyDiff driver-ranking benchmark'));
  console.log(DIM(`  ${data.cases.length} documented contradictions · ${data.name}`));
  console.log(
    DIM('  depth arm: ') +
      (depth === 'abstract'
        ? BOLD('abstract') + DIM(' (primary, pre-registered)')
        : BOLD('as-retrieved') + YELLOW(' (secondary — confounded, not the headline)')),
  );
  console.log('');

  if (missing.length) {
    console.log(YELLOW(`  ${missing.length} case(s) have no cached extraction for this arm:`));
    for (const m of missing) console.log(DIM(`    - ${m.id}`));
    console.log(DIM(`    Run \`npm run eval:fetch${depth === 'abstract' ? '' : ' -- --depth as-retrieved'}\`.`));
    console.log('');
  }
  if (!scored.length) {
    console.log(RED('  Nothing to score. Populate the cache first.\n'));
    process.exit(1);
  }

  const n = scored.length;
  const strictN = scored.filter((r) => r.strict).length;
  const lenientN = scored.filter((r) => r.lenient).length;
  const baseN = scored.filter((r) => r.baseline).length;
  const reachN = scored.filter((r) => r.reachable).length;

  // ---- The two numbers -----------------------------------------------------
  console.log(BOLD('  THE NUMBERS'));
  console.log('');
  console.log('    Top-1 accuracy (strict)      ' + BOLD(withCI(strictN, n)));
  console.log('    Baseline "always say assay"  ' + withCI(baseN, n));
  console.log('');
  const delta = (strictN - baseN) / n;
  const verdict =
    strictN > baseN
      ? GREEN(`    → ranker beats the baseline by ${pct(delta)}`)
      : strictN === baseN
        ? YELLOW('    → ranker TIES the baseline. On this set it adds nothing over a constant guess.')
        : RED(`    → ranker LOSES to the baseline by ${pct(-delta)}.`);
  console.log(verdict);
  // Paired disagreement: with n this small, the headline delta is fragile.
  const discordant = scored.filter((r) => r.strict !== r.baseline).length;
  console.log(
    DIM(
      `      (the two disagree on ${discordant}/${n} cases; with n=${n} treat any gap smaller than\n` +
      `       the CI overlap as unresolved, not as evidence of an effect)`,
    ),
  );
  console.log('');

  // ---- Secondary --------------------------------------------------------
  console.log(BOLD('  SECONDARY'));
  console.log('');
  console.log('    Lenient accuracy             ' + withCI(lenientN, n));
  console.log(DIM('      credits any documented contributing dimension, not just the primary label'));
  console.log('    Oracle ceiling (reachable)   ' + withCI(reachN, n));
  console.log(DIM('      how often the established cause is a candidate driver at all.'));
  console.log(DIM('      Re-ranking cannot exceed this; only better extraction can raise it.'));
  console.log('');
  const amongReach = scored.filter((r) => r.reachable);
  if (amongReach.length) {
    console.log(
      '    Accuracy among reachable     ' +
        withCI(amongReach.filter((r) => r.strict).length, amongReach.length),
    );
    console.log(DIM('      the ranking problem in isolation, with extraction failures excluded'));
  }
  console.log('');

  // ---- Diagnostics ------------------------------------------------------
  // Asymmetric source depth is a confound, not a result: when one paper is read
  // at full text and the other only as an abstract, the abstract side returns
  // "not reported" for dimensions the other reports, so those dimensions are not
  // comparable and are dropped from the candidate set entirely. That is decided
  // by PMC Open Access membership — journal licensing — not by the science.
  const asym = scored.filter((r) => r.asymmetric);
  if (asym.length) {
    console.log(YELLOW(`  ${asym.length} case(s) have ASYMMETRIC source depth — a confound:`));
    for (const r of asym) console.log(DIM(`    - ${cell(r.id, 34)} ${r.depths.join(' / ')}`));
    console.log(DIM('    One paper read deeper than the other; the shallower side reports'));
    console.log(DIM('    "not reported", which silently removes dimensions from contention.'));
    console.log(DIM('    Driven by journal licensing, not by the papers. Prefer --depth abstract.'));
    console.log('');
  }

  const noConflict = scored.filter((r) => !r.findingsConflict);
  if (noConflict.length) {
    console.log(YELLOW(`  ${noConflict.length} case(s) where the pipeline did not detect conflicting findings:`));
    for (const r of noConflict) console.log(DIM(`    - ${r.id}`));
    console.log(DIM('    These are extraction failures upstream of ranking; they score as misses.'));
    console.log('');
  }

  const predDist = {};
  for (const r of scored) predDist[r.top ?? 'none'] = (predDist[r.top ?? 'none'] ?? 0) + 1;
  console.log(BOLD('  What the ranker actually predicts'));
  for (const [d, c] of Object.entries(predDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cell(d, 14)} ${String(c).padStart(2)}  ${DIM('#'.repeat(c))}`);
  }
  console.log('');

  console.log(BOLD('  Confusion matrix'));
  console.log(confusionMatrix(scored));

  // ---- Subsets (reported, never used to pick the headline) --------------
  console.log(BOLD('  Subsets') + DIM('  (diagnostic only — the headline is the full set)'));
  console.log('');
  for (const [name, filt] of [
    ['established only', (r) => r.confidence === 'established'],
    ['contested only', (r) => r.confidence === 'contested'],
    ['cause visible in both', (r) => r.visible === 'yes'],
    ['cause partly visible', (r) => r.visible === 'partial'],
    ['cause visible in neither', (r) => r.visible === 'no'],
    ['non-assay labels only', (r) => r.labelDim !== 'assay'],
  ]) {
    const sub = scored.filter(filt);
    if (!sub.length) continue;
    const sN = sub.filter((r) => r.strict).length;
    const bN = sub.filter((r) => r.baseline).length;
    console.log(
      `    ${cell(name, 26)} StudyDiff ${cell(withCI(sN, sub.length), 34)} baseline ${pct(bN / sub.length)}`,
    );
  }
  console.log('');

  // ---- Per-case ---------------------------------------------------------
  console.log(BOLD('  Per-case'));
  console.log('');
  console.log(
    '  ' + cell('case', 32) + cell('label', 12) + cell('predicted', 12) + cell('strict', 8) + cell('reach', 6),
  );
  for (const r of scored) {
    const mark = r.strict ? GREEN('hit') : RED('miss');
    console.log(
      '  ' +
        cell(r.id, 32) +
        cell(r.labelDim, 12) +
        cell(r.top ?? '(none)', 12) +
        mark.padEnd(8 + 9) +
        cell(r.reachable ? 'yes' : 'no', 6),
    );
  }
  console.log('');
}

main();
