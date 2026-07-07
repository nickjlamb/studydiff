// Orchestration: retrieve → extract → compare → find gaps → ground → synthesise.
// buildResult is pure (given cards + their source texts) so the offline demo and
// the live path share identical downstream logic; only how the cards are produced
// differs.

import { DIMENSIONS, NOT_REPORTED, field } from './types.mjs';
import { fetchPaper } from './ncbi.mjs';
import { extractCard } from './extract.mjs';
import { compareCards } from './compare.mjs';
import { findGaps } from './gaps.mjs';
import { groundCard, groundSynthesis } from './grounding.mjs';

/** Deterministic synthesis built only from already-extracted (and grounded) fields. */
function synthesize(comparison, cards) {
  if (!comparison.findingsConflict) {
    return {
      text: 'The compared papers do not state clearly opposing conclusions on this question, so no contradiction is asserted.',
    };
  }
  const [a, b] = cards;
  const top = comparison.candidateReasons[0];
  let text =
    `Both studies address the same question but reach different conclusions ` +
    `(A: "${a.finding.value}"; B: "${b.finding.value}"). `;
  if (top) {
    text += `The most likely driver is the ${top.label.toLowerCase()}: A used ${top.a}, whereas B used ${top.b}.`;
  } else {
    text += `No differing design dimension was reported in both papers, so the source of disagreement cannot be localised from the available text.`;
  }
  // Fold in the headline statistics when both report them — this puts numbers
  // into the synthesis so the grounding check has something real to verify.
  if (a.statistic.value !== NOT_REPORTED && b.statistic.value !== NOT_REPORTED) {
    text += ` A reports ${a.statistic.value}; B reports ${b.statistic.value}.`;
  }
  return { text };
}

/**
 * Pure assembly of the full result from cards and their source texts.
 * @param {string} question
 * @param {import('./types.mjs').StudyCard[]} cards  exactly two
 * @param {string[]} texts  source text per card, aligned by index
 */
export function buildResult(question, cards, texts) {
  // 1. Ground FIRST. Anything the source text can't back is not trusted…
  const grounding = {
    a: groundCard(cards[0], texts[0], DIMENSIONS),
    b: groundCard(cards[1], texts[1], DIMENSIONS),
  };
  // 2. …so downgrade every ungrounded field to "not reported" before comparing.
  //    StudyDiff must never cite a fact it just refused to verify.
  const clean = [
    downgradeUngrounded(cards[0], grounding.a.downgraded),
    downgradeUngrounded(cards[1], grounding.b.downgraded),
  ];
  // 3. Compare / find gaps / synthesise only over grounded facts.
  const comparison = compareCards(clean[0], clean[1]);
  const gaps = findGaps(clean);
  const synth = synthesize(comparison, clean);
  const combined = `${texts[0]}\n\n${texts[1]}`;
  const g = groundSynthesis(synth.text, combined);
  const synthesis = { ...synth, grounded: g.grounded, issues: g.issues };
  return { question, cards: clean, comparison, gaps, grounding, synthesis };
}

/** Return a copy of the card with each ungrounded dimension reset to "not reported". */
function downgradeUngrounded(card, downgraded) {
  if (!downgraded.length) return card;
  const copy = { ...card };
  for (const d of downgraded) copy[d] = field(NOT_REPORTED, '');
  return copy;
}

/**
 * Live path: fetch two PMIDs, extract each with Claude, assemble the result.
 * Requires ANTHROPIC_API_KEY (extraction) and network to NCBI (retrieval).
 */
export async function runPipeline(question, pmids) {
  const papers = [];
  for (const pmid of pmids) papers.push(await fetchPaper(pmid)); // sequential — respect NCBI rate limits
  const cards = [];
  for (const p of papers) cards.push(await extractCard(p, question));
  return buildResult(question, cards, papers.map((p) => p.text));
}
