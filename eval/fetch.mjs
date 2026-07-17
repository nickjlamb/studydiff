// `npm run eval:fetch` — populate the extraction cache for the benchmark.
//
// This is the ONLY part of the eval that needs the network or costs money.
// It fetches each paper from NCBI, extracts a study card with Claude, and
// writes the result to eval/cache/. Once cached, `npm run eval` is free and
// fully offline — so the published number can be regenerated from committed
// artefacts by anyone, without an API key.
//
// Requires: ANTHROPIC_API_KEY, network access to NCBI.
// Safe to re-run: already-cached cards are skipped unless --force.
//
//   node eval/fetch.mjs                 # fill in whatever is missing
//   node eval/fetch.mjs --force         # re-extract everything
//   node eval/fetch.mjs --case treg-lineage-fate-mapping

import { fetchPaper, abstract } from '../src/ncbi.mjs';
import { extractCard } from '../src/extract.mjs';
import { loadCases, readCache, writeCache, loadEnv, parseDepth } from './lib.mjs';

loadEnv(); // reads .env the same way src/server.mjs does

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
const depth = parseDepth(args);

/**
 * Retrieve a paper at the requested depth.
 *
 * 'abstract' does NOT call fetchPaper, because fetchPaper silently upgrades to
 * PMC full text whenever the paper is in the OA subset — which is exactly the
 * uncontrolled variable the primary arm exists to eliminate.
 */
async function retrieve(pmid, depthArm) {
  if (depthArm === 'as-retrieved') return fetchPaper(pmid);
  const a = await abstract(pmid);
  if (!a.abstract || a.abstract.length < 50) {
    throw new Error(`no usable abstract for ${pmid} (got ${a.abstract?.length ?? 0} chars)`);
  }
  return { pmid, citation: a.citation, title: a.title, text: a.abstract, sourceDepth: 'abstract' };
}

const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(RED('\n  ANTHROPIC_API_KEY is not set. Extraction needs it.\n'));
    process.exit(1);
  }
  const data = loadCases();
  const cases = only ? data.cases.filter((c) => c.id === only) : data.cases;
  if (!cases.length) {
    console.error(RED(`\n  No case matching "${only}".\n`));
    process.exit(1);
  }

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  console.log('');
  console.log(DIM(`  depth arm: ${depth}${depth === 'abstract' ? ' (primary, pre-registered)' : ' (secondary — confounded by PMC OA membership)'}`));
  console.log('');
  for (const c of cases) {
    for (const p of c.papers) {
      if (!force && readCache(c.id, p.pmid, depth)) {
        skipped++;
        console.log(DIM(`  cached   ${c.id} / ${p.pmid}`));
        continue;
      }
      try {
        // Sequential, with a pause — NCBI rate-limits aggressively.
        const paper = await retrieve(p.pmid, depth);
        await sleep(400);
        const card = await extractCard(paper, c.question);
        writeCache(c.id, p.pmid, depth, {
          pmid: p.pmid,
          caseId: c.id,
          depthArm: depth,
          question: c.question,
          citation: p.citation,
          title: paper.title,
          sourceDepth: paper.sourceDepth,
          textChars: paper.text.length,
          text: paper.text,
          card,
          extractedAt: new Date().toISOString(),
          model: process.env.STUDYDIFF_MODEL || 'claude-sonnet-5',
        });
        fetched++;
        console.log(GREEN(`  fetched  ${c.id} / ${p.pmid}  ${DIM(`${paper.sourceDepth} · ${paper.text.length} chars`)}`));
      } catch (err) {
        failed++;
        console.log(RED(`  FAILED   ${c.id} / ${p.pmid}  ${err.message}`));
      }
    }
  }

  console.log('');
  console.log(`  ${fetched} fetched · ${skipped} already cached · ${failed} failed  ${DIM(`[arm: ${depth}]`)}`);
  if (failed) console.log(DIM('  Re-run to retry failures; cached entries are skipped.'));
  console.log(DIM(`  Now run \`npm run eval${depth === 'abstract' ? '' : ' -- --depth as-retrieved'}\`.`));
  console.log('');
}

main();
