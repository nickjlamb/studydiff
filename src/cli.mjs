#!/usr/bin/env node
// Live CLI: fetch two PubMed papers, extract with Claude, explain the conflict.
//   studydiff --q "Does resveratrol activate SIRT1?" 12939617 19843076
// Requires ANTHROPIC_API_KEY (extraction) and network access to NCBI.
// No key? Run `npm run demo` for the fully offline walkthrough.

import { runPipeline } from './pipeline.mjs';
import { renderResult } from './render.mjs';

function parseArgs(argv) {
  const args = argv.slice(2);
  let question = 'Why do these papers reach different conclusions?';
  const pmids = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--q' || args[i] === '--question') question = args[++i];
    else if (/^\d+$/.test(args[i])) pmids.push(args[i]);
  }
  return { question, pmids };
}

const { question, pmids } = parseArgs(process.argv);

if (pmids.length !== 2) {
  console.error('Usage: studydiff --q "<question>" <PMID> <PMID>');
  console.error('Example: studydiff --q "Does resveratrol activate SIRT1?" 12939617 19843076');
  console.error('\nNo API key? Try the offline demo:  npm run demo');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set. Add it to .env, or run `npm run demo` for the offline walkthrough.');
  process.exit(1);
}

console.error(`Fetching and comparing PMIDs ${pmids.join(' and ')} …`);
try {
  const result = await runPipeline(question, pmids);
  console.log(renderResult(result));
} catch (err) {
  console.error('StudyDiff failed:', err.message);
  process.exit(1);
}
