// Grounding: the trust layer. Every extracted value and every synthesised reason
// is checked against the actual source text using OpenGATE's deterministic
// checkGrounding – no second LLM acting as judge. A field is grounded only when
// its supporting quote really appears in the source AND every number in its value
// traces back to that source. Anything that fails is downgraded, not shown as fact.

import { checkGrounding, contains } from '@pharmatools/opengate/grounding';
import { NOT_REPORTED } from './types.mjs';
import { normalizeText, groundingContext } from './normalize.mjs';

/**
 * Does `quote` appear in `source`, allowing an ellipsis to join fragments?
 *
 * The audit found 4 false positives where the model wrote a quote like
 * "potent activator resveratrol ... lowers the Michaelis constant" — both halves
 * verbatim, joined by an ellipsis, so the substring test failed on an honest quote.
 *
 * The guards are not optional. Unguarded, ellipsis-joining is a licence to stitch
 * fragments from opposite ends of a paper into a claim neither supports — the
 * Howitz quote already spans SIRT1 (human) and Sir2 (yeast) machinery. So:
 *   - every fragment must appear, IN SOURCE ORDER
 *   - fragments must be near each other (maxGap), not dredged from distant sections
 *   - every fragment must be substantial (minFragment), so no fragment is one word
 * Fail any guard and the field is rejected, exactly as before.
 */
export function containsAllowingEllipsis(source, quote, { maxGap = 200, minFragment = 25 } = {}) {
  const nQuote = normalizeText(quote);
  const nSource = normalizeText(source);
  const parts = nQuote.split(/\s*(?:\.\.\.+|…)\s*/).map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) return contains(nSource, nQuote);
  // A short fragment matches too easily to be evidence of anything.
  if (parts.some((p) => p.length < minFragment)) return false;

  const hay = nSource.toLowerCase();
  let cursor = 0;
  for (let i = 0; i < parts.length; i++) {
    const needle = parts[i].toLowerCase();
    const idx = hay.indexOf(needle, cursor);
    if (idx === -1) return false;                        // fragment absent, or out of order
    if (i > 0 && idx - cursor > maxGap) return false;    // fragments too far apart
    cursor = idx + needle.length;
  }
  return true;
}

/**
 * Verify one study-card field against the paper's source text.
 * @returns {{grounded:boolean, reason:string}}
 */
export function groundField(f, sourceText) {
  if (!f || f.value === NOT_REPORTED || !f.value) {
    return { grounded: true, reason: 'not reported – nothing to verify' };
  }
  // 1. The supporting quote must genuinely exist in the source.
  //    Compared after normalisation, because PubMed/PMC text arrives
  //    entity-encoded ("2&#xa0;h") while the model quotes it decoded ("2 h").
  //    That mismatch alone accounted for 10 of 26 measured false positives.
  if (!f.quote) return { grounded: false, reason: 'no supporting quote provided' };
  if (!containsAllowingEllipsis(sourceText, f.quote)) {
    return { grounded: false, reason: 'supporting quote not found in source text' };
  }
  // 2. Every number in the value must trace to the source (guards fabricated stats).
  //    The context is widened to include alternate SPELLINGS of numbers the source
  //    already states ("Ninety-seven percent" -> 97; "35,533" -> 35533). It never
  //    adds a number the source does not state, so a fabricated figure still fails.
  const res = checkGrounding({ answer: f.value, context: groundingContext(sourceText) });
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
