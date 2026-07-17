// `npm run eval:variance` — measure extraction stability.
//
// Runs the SAME pair through extraction N times and reports how often the
// top-ranked driver changes. Everything downstream of extraction is
// deterministic, so any variation observed here is variation in what Claude
// pulled out of the text — not in the ranking.
//
// This is known to be non-zero: the treg pair has yielded both
// "Genetic fate-mapping with flow cytometry" and "Flow cytometry (FACS) for
// Foxp3, GFP, YFP..." as Study A's assay across runs. Nobody in this space
// publishes this number, which is exactly why it is worth publishing.
//
// Requires ANTHROPIC_API_KEY + NCBI. Writes nothing to the main cache.
//
//   node eval/variance.mjs                        # default pairs, 5 runs
//   node eval/variance.mjs --runs 10
//   node eval/variance.mjs --case treg-lineage-fate-mapping --runs 5

import { DIMENSIONS } from '../src/types.mjs';
import { fetchPaper } from '../src/ncbi.mjs';
import { extractCard } from '../src/extract.mjs';
import { buildResult } from '../src/pipeline.mjs';
import { loadCases, cell, loadEnv } from './lib.mjs';

loadEnv(); // reads .env the same way src/server.mjs does

const args = process.argv.slice(2);
const runs = args.includes('--runs') ? Number(args[args.indexOf('--runs') + 1]) : 5;
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;

// Chosen because they are the known-unstable ones: treg has an abstract on side
// A that states no assay at all, so the extractor has nothing to anchor on.
const DEFAULT_PAIRS = [
  'treg-lineage-fate-mapping',
  'mouse-models-gene-selection',
  'thrombolysis-time-window',
];

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Shannon entropy in bits over the observed distribution of a categorical. */
function entropy(counts) {
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!n) return 0;
  return -Object.values(counts)
    .filter((c) => c > 0)
    .map((c) => c / n)
    .reduce((acc, p) => acc + p * Math.log2(p), 0);
}

async function runCase(caseDef, n) {
  // Fetch once — we are measuring extraction variance, not retrieval variance.
  const papers = [];
  for (const p of caseDef.papers) {
    papers.push(await fetchPaper(p.pmid));
    await sleep(400);
  }

  const tops = [];
  const assayValues = [[], []];
  const labelValues = [[], []]; // the LABELLED dimension, whatever it is
  const L = caseDef.label.dimension;
  for (let i = 0; i < n; i++) {
    const cards = [];
    for (let j = 0; j < papers.length; j++) {
      const card = await extractCard(papers[j], caseDef.question);
      const full = { pmid: caseDef.papers[j].pmid, citation: caseDef.papers[j].citation, sourceDepth: papers[j].sourceDepth };
      for (const d of DIMENSIONS) full[d] = card[d];
      cards.push(full);
      assayValues[j].push(card.assay?.value ?? '(none)');
      labelValues[j].push(card[L]?.value ?? '(none)');
      await sleep(200);
    }
    const result = buildResult(caseDef.question, cards, papers.map((p) => p.text));
    tops.push(result.comparison.candidateReasons[0]?.dimension ?? '(none)');
    process.stdout.write(DIM(`    run ${i + 1}/${n}: ${tops[i]}\n`));
  }
  return { tops, assayValues, labelValues };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(RED('\n  ANTHROPIC_API_KEY is not set. Extraction needs it.\n'));
    process.exit(1);
  }
  const data = loadCases();
  const ids = only ? [only] : DEFAULT_PAIRS;
  const cases = data.cases.filter((c) => ids.includes(c.id));

  console.log('');
  console.log(BOLD('  Extraction variance'));
  console.log(DIM(`  ${runs} runs per pair · everything after extraction is deterministic,`));
  console.log(DIM('  so all variation below originates in extraction.'));
  console.log('');

  const summary = [];
  for (const c of cases) {
    console.log(BOLD(`  ${c.id}`) + DIM(`  (label: ${c.label.dimension})`));
    const { tops, assayValues } = await runCase(c, runs);

    const counts = {};
    for (const t of tops) counts[t] = (counts[t] ?? 0) + 1;
    const modal = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const stable = modal[1] === runs;
    const rate = modal[1] / runs;

    console.log(
      '    ' +
        (stable ? GREEN('stable') : YELLOW('UNSTABLE')) +
        `  modal driver "${modal[0]}" in ${modal[1]}/${runs} runs` +
        DIM(`  · entropy ${entropy(counts).toFixed(2)} bits`),
    );
    for (const [d, c2] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(DIM(`      ${cell(d, 14)} ${c2}/${runs}`));
    }
    // The assay field is where the known instability lives — show the raw
    // strings, because "how many distinct values" is the honest measure.
    for (let j = 0; j < assayValues.length; j++) {
      const distinct = [...new Set(assayValues[j])];
      if (distinct.length > 1) {
        console.log(YELLOW(`      Study ${j === 0 ? 'A' : 'B'} assay extracted ${distinct.length} distinct ways:`));
        for (const v of distinct) console.log(DIM(`        - "${v}"`));
      }
    }
    // Value-level churn. Reported because driver stability MASKS it: the top
    // driver can be perfectly stable while the underlying extracted string is
    // different on every single run.
    const churn = assayValues.map((vs) => new Set(vs).size);
    console.log(DIM(`      distinct assay strings across ${runs} runs: A=${churn[0]}, B=${churn[1]}`));
    console.log('');
    summary.push({
      id: c.id, modal: modal[0], rate, stable, entropy: entropy(counts),
      churn, maxChurn: Math.max(...churn),
    });
  }

  console.log(BOLD('  Summary'));
  console.log('');
  console.log('  ' + cell('pair', 32) + cell('modal driver', 13) + cell('driver agree', 14) + cell('distinct assay', 15) + 'verdict');
  for (const s of summary) {
    console.log(
      '  ' +
        cell(s.id, 32) +
        cell(s.modal, 13) +
        cell(`${(s.rate * 100).toFixed(0)}%`, 14) +
        cell(`${s.churn.join(' / ')} of ${runs}`, 15) +
        (s.stable ? GREEN('driver stable') : YELLOW('driver changed')),
    );
  }
  const unstable = summary.filter((s) => !s.stable).length;
  const slots = summary.flatMap((s) => s.churn);
  const totallyUnstable = slots.filter((c) => c === runs).length;
  const meanDistinct = slots.reduce((a, b) => a + b, 0) / slots.length;

  console.log('');
  console.log(
    `  ${unstable}/${summary.length} pairs changed their top-ranked driver across ${runs} identical runs.`,
  );
  console.log(
    YELLOW(`  But the extracted assay string was unstable almost everywhere: `) +
    `mean ${meanDistinct.toFixed(1)} distinct values per ${runs} runs ` +
    `across ${slots.length} paper-slots; ${totallyUnstable} slot(s) produced a DIFFERENT value every run.`,
  );
  console.log('');
  console.log(DIM('  Why the driver looks stable anyway — this is the important part:'));
  console.log(DIM('  compare.mjs decides divergence with a STRING INEQUALITY (norm(a) !== norm(b)).'));
  console.log(DIM('  Every paraphrase is a new string, so `assay` "diverges" no matter what the'));
  console.log(DIM('  model wrote. The ranking is stable BECAUSE the divergence test is trivially'));
  console.log(DIM('  satisfied — not because extraction is reliable. It is stably wrong.'));
  console.log(DIM('  e.g. "Flow cytometry, ICS, bisulfite sequencing" vs "Genetic fate-mapping with'));
  console.log(DIM('  flow cytometry" — both say flow cytometry; scored as fully divergent.'));
  console.log('');
}

main();
