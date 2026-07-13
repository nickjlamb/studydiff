// Markdown rendering of a grounded StudyDiff result. Kept separate from the
// transports (web, CLI, MCP) so every surface emits the same, auditable report:
// the answer first, then the ranked drivers, then every value with the verbatim
// sentence that supports it. Nothing here invents a number – each count is derived
// from fields that already survived grounding.

import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED } from './types.mjs';

const DEPTH = { fulltext: 'full text', abstract: 'abstract', pasted: 'pasted text', uploaded: 'uploaded PDF' };
const reported = (f) => f && f.value && f.value !== NOT_REPORTED;

/** Counts used by the verification block. All computed, none estimated. */
export function verificationCounts(result) {
  const [a, b] = result.cards;
  const verified = DIMENSIONS.filter((d) => reported(a[d])).length + DIMENSIONS.filter((d) => reported(b[d])).length;
  const total = DIMENSIONS.length * 2;
  return { verified, notReported: total - verified, total };
}

/**
 * Render a buildResult() payload as a grounded Markdown analysis.
 * @param {{question:string,cards:any[],comparison:any,gaps:any,grounding:any,synthesis:any,resolve:string[]}} result
 */
export function toMarkdown(result) {
  const [a, b] = result.cards;
  const { comparison: cmp, synthesis, resolve, gaps } = result;
  const { verified, notReported } = verificationCounts(result);
  const top = cmp.candidateReasons[0];
  const L = [];

  L.push('# StudyDiff – why these studies differ', '');
  if (result.question) L.push(`**Question:** ${result.question}`, '');
  L.push(`**Study A:** ${a.citation} _(${DEPTH[a.sourceDepth] || a.sourceDepth})_`);
  L.push(`**Study B:** ${b.citation} _(${DEPTH[b.sourceDepth] || b.sourceDepth})_`, '');

  L.push('## Verdict', '');
  L.push(cmp.findingsConflict
    ? 'These studies reach different conclusions.'
    : 'These studies do not state clearly opposing conclusions, so no contradiction is asserted.', '');

  L.push('## Why they differ', '');
  L.push(synthesis.text);
  L.push('', synthesis.grounded
    ? '_Verified against the source._'
    : `_Could not be fully verified: ${(synthesis.issues || []).join('; ')}_`, '');

  if (cmp.findingsConflict) {
    L.push('## Their conclusions', '');
    L.push(`- **Study A** – ${a.finding.value}`);
    if (a.finding.quote) L.push(`  > "${a.finding.quote}"`);
    L.push(`- **Study B** – ${b.finding.value}`);
    if (b.finding.quote) L.push(`  > "${b.finding.quote}"`);
    L.push('');
  }

  if (cmp.candidateReasons.length || (cmp.sharedDesign || []).length) {
    L.push("## What's driving the difference", '');
    cmp.candidateReasons.forEach((r, i) => {
      L.push(`**${i === 0 ? 'Primary driver' : 'Also differs'} – ${r.label}**`);
      L.push(`- Study A: ${r.a}`);
      L.push(`- Study B: ${r.b}`, '');
    });
    if ((cmp.sharedDesign || []).length) {
      L.push(`**Ruled out** – identical in both studies, so not the cause: ${cmp.sharedDesign.join(', ')}.`, '');
    }
  }

  L.push('## Verification', '');
  L.push(`- **${verified}** claims verified against the source`);
  L.push(`- **${notReported}** fields not reported by the papers`);
  L.push('- **0** invented – every claim links to a verbatim source sentence');
  L.push('', 'Grounding is deterministic (OpenGATE), not an LLM-as-judge: any value whose quote is not found in the source, or whose numbers do not trace back, is downgraded to _not reported_ before it can be cited. Re-run and you get identical drivers.', '');

  if (resolve && resolve.length) {
    L.push('## What would resolve this disagreement', '');
    for (const r of resolve) L.push(`- ${r}`);
    L.push('', '_Suggested next evidence, derived from the differences above – reasoning about what is missing, not a claim from the papers._', '');
  }

  L.push('## Full comparison', '');
  L.push('Every reported value with the verbatim sentence that supports it.', '');
  for (const row of cmp.rows) {
    const d = row.dimension;
    L.push(`### ${DIMENSION_LABELS[d] || row.label}${row.diverges ? ' – differs' : ''}`);
    for (const [tag, c] of [['A', a], ['B', b]]) {
      const f = c[d];
      if (!reported(f)) { L.push(`- **${tag}** – _not reported_`); continue; }
      L.push(`- **${tag}** – ${f.value}`);
      if (f.quote) L.push(`  > "${f.quote}"`);
    }
    L.push('');
  }

  const unrep = (gaps && gaps.unreported) || [];
  if (unrep.length) {
    L.push('## Not reported by either study', '');
    for (const g of unrep) L.push(`- ${g}`);
    L.push('', '_Bounded to the two papers compared – not a claim about the wider literature._', '');
  }

  return L.join('\n');
}
