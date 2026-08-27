// Grounding: the trust layer. Every extracted value and every synthesised reason
// is checked against the actual source text using OpenGATE's deterministic
// checkGrounding – no second LLM acting as judge. A field is grounded only when
// its supporting quote really appears in the source AND every number in its value
// traces back to that source. Anything that fails is downgraded, not shown as fact.

import { checkGrounding, contains } from '@pharmatools/opengate/grounding';
import { NOT_REPORTED } from './types.mjs';
import { normalizeText, groundingContext } from './normalize.mjs';

/**
 * Locate `quote` inside `source`, allowing an ellipsis to join fragments, and
 * return WHERE it matched — the offsets of each matched fragment in the normalised
 * source. This is the single source of truth for both the ✓ badge (does it ground?)
 * and the source viewer (where to highlight). They can never disagree because the
 * viewer does not re-implement matching; it renders the very spans this function
 * returns. That is the whole point — a viewer that said "sentence not found" next to
 * a ✓ badge would be the worst bug this product could ship.
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
 *
 * @returns {{ok:boolean, text:string, spans:Array<[number,number]>}}
 *   `text` is the normalised source the offsets index into (what the viewer must
 *   display); `spans` are [start,end) fragment ranges, empty when `ok` is false.
 */
export function locateQuote(source, quote, { maxGap = 200, minFragment = 25 } = {}) {
  const nQuote = normalizeText(quote);
  const nSource = normalizeText(source);
  const miss = { ok: false, text: nSource, spans: [] };
  const parts = nQuote.split(/\s*(?:\.\.\.+|…)\s*/).map((p) => p.trim()).filter(Boolean);

  // Single fragment: the badge is opengate's whitespace-insensitive contains(), so
  // the span must be found the same tolerant way, or the two could disagree on an
  // odd whitespace/case difference. tolerantFind mirrors contains() exactly.
  if (parts.length <= 1) {
    if (!contains(nSource, nQuote)) return miss;
    const span = tolerantFind(nSource, nQuote);
    return { ok: true, text: nSource, spans: span ? [span] : [] };
  }

  // A short fragment matches too easily to be evidence of anything.
  if (parts.some((p) => p.length < minFragment)) return miss;

  const hay = nSource.toLowerCase();
  let cursor = 0;
  const spans = [];
  for (let i = 0; i < parts.length; i++) {
    const needle = parts[i].toLowerCase();
    const idx = hay.indexOf(needle, cursor);
    if (idx === -1) return miss;                          // fragment absent, or out of order
    if (i > 0 && idx - cursor > maxGap) return miss;      // fragments too far apart
    spans.push([idx, idx + needle.length]);
    cursor = idx + needle.length;
  }
  return { ok: true, text: nSource, spans };
}

/**
 * Backwards-compatible boolean wrapper. The trust layer and its tests
 * (eval/normalize.test.mjs) ask only "does this ground?"; they get the same answer
 * they always did, now derived from locateQuote so there is exactly one matcher.
 */
export function containsAllowingEllipsis(source, quote, opts = {}) {
  return locateQuote(source, quote, opts).ok;
}

/**
 * Find `needle` in `haystack` the way opengate's contains() decides membership —
 * case-insensitive and ignoring ALL whitespace — but return the [start,end) offsets
 * in the ORIGINAL (spaced) haystack. Ignoring whitespace lets a quote match across a
 * spacing difference exactly as the badge does; the index map carries us back to real
 * offsets so the highlight lands on the readable text. Returns null if absent.
 */
function tolerantFind(haystack, needle) {
  const h = haystack.toLowerCase();
  let stripped = '';
  const map = [];                       // stripped index -> original index
  for (let i = 0; i < h.length; i++) {
    if (!/\s/.test(h[i])) { stripped += h[i]; map.push(i); }
  }
  const n = needle.toLowerCase().replace(/\s+/g, '');
  if (!n) return null;
  const at = stripped.indexOf(n);
  if (at === -1) return null;
  return [map[at], map[at + n.length - 1] + 1];
}

/**
 * Verify one study-card field against the paper's source text.
 * When grounded, `spans` are the offsets of the supporting sentence in the
 * normalised source, so the viewer can highlight it in place — the same match that
 * earned the ✓, never a second guess at it.
 * @returns {{grounded:boolean, reason:string, spans:Array<[number,number]>}}
 */
export function groundField(f, sourceText) {
  if (!f || f.value === NOT_REPORTED || !f.value) {
    return { grounded: true, reason: 'not reported – nothing to verify', spans: [] };
  }
  // 1. The supporting quote must genuinely exist in the source.
  //    Compared after normalisation, because PubMed/PMC text arrives
  //    entity-encoded ("2&#xa0;h") while the model quotes it decoded ("2 h").
  //    That mismatch alone accounted for 10 of 26 measured false positives.
  if (!f.quote) return { grounded: false, reason: 'no supporting quote provided', spans: [] };
  const loc = locateQuote(sourceText, f.quote);
  if (!loc.ok) {
    return { grounded: false, reason: 'supporting quote not found in source text', spans: [] };
  }
  // 2. Every number in the value must trace to the source (guards fabricated stats).
  //    The context is widened to include alternate SPELLINGS of numbers the source
  //    already states ("Ninety-seven percent" -> 97; "35,533" -> 35533). It never
  //    adds a number the source does not state, so a fabricated figure still fails.
  const res = checkGrounding({ answer: f.value, context: groundingContext(sourceText) });
  if (!res.grounded) {
    return { grounded: false, reason: res.issues.join('; '), spans: [] };
  }
  return { grounded: true, reason: 'quote found; numbers traceable', spans: loc.spans };
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
