// Grounding: the trust layer. Every extracted value and every synthesised reason
// is checked against the actual source text using OpenGATE's deterministic
// checkGrounding – no second LLM acting as judge. A field is grounded only when
// its supporting quote really appears in the source AND every number in its value
// traces back to that source. Anything that fails is downgraded, not shown as fact.

import { checkGrounding, contains } from '@pharmatools/opengate/grounding';
import { NOT_REPORTED } from './types.mjs';

/**
 * Verify one study-card field against the paper's source text.
 * @returns {{grounded:boolean, reason:string}}
 */
export function groundField(f, sourceText) {
  if (!f || f.value === NOT_REPORTED || !f.value) {
    return { grounded: true, reason: 'not reported – nothing to verify' };
  }
  // 1. The supporting quote must genuinely exist in the source.
  if (!f.quote) return { grounded: false, reason: 'no supporting quote provided' };
  if (!contains(sourceText, f.quote)) {
    return { grounded: false, reason: 'supporting quote not found in source text' };
  }
  // 2. Every number in the value must trace to the source (guards fabricated stats).
  const res = checkGrounding({ answer: f.value, context: sourceText });
  if (!res.grounded) {
    return { grounded: false, reason: res.issues.join('; ') };
  }
  return { grounded: true, reason: 'quote found; numbers traceable' };
}

/**
 * Verify a synthesised reason sentence against the combined text of both papers.
 * @returns {{grounded:boolean, issues:string[]}}
 */
export function groundSynthesis(sentence, combinedContext) {
  const res = checkGrounding({ answer: sentence, context: combinedContext });
  return { grounded: res.grounded, issues: res.issues };
}

/**
 * Run grounding across every field of a card.
 * @returns {{results:Record<string,{grounded:boolean,reason:string}>, downgraded:string[]}}
 */
export function groundCard(card, sourceText, dimensions) {
  const results = {};
  const downgraded = [];
  for (const d of dimensions) {
    const r = groundField(card[d], sourceText);
    results[d] = r;
    if (!r.grounded) downgraded.push(d);
  }
  return { results, downgraded };
}
