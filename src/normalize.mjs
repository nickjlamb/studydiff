// Text normalisation for the grounding check.
//
// WHY THIS EXISTS. The Phase 2 audit adjudicated all 29 fields that grounding
// rejected. 26 of them (90%) were FALSE POSITIVES — values the source genuinely
// supports, rejected for mechanical reasons. The single largest cause, 10 of 26,
// was not a strictness problem at all: PubMed/PMC text arrives HTML-entity-encoded
// (`2&#xa0;h`, `&#x2265;`, `&#xd7;`, `&gt;`), the model reads it and sensibly
// writes the quote decoded (`2 h`), and the substring check then fails. The whole
// ivermectin case died to a non-breaking space.
//
// So grounding was not too strict. It was being fed corrupted text and correctly
// refusing to verify against it.
//
// EVERY function here is a LOSSLESS presentation change: it makes two spellings of
// the SAME characters comparable. None of it makes a claim easier to assert. That
// distinction is the whole design rule — see the "deliberately not done" list at
// the bottom.

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', minus: '−', times: '×',
  le: '≤', ge: '≥', deg: '°', plusmn: '±',
  alpha: 'α', beta: 'β', gamma: 'γ', mu: 'μ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…',
};

/** Decode numeric (&#160; &#xa0;) and common named HTML entities. */
export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCode(parseInt(d, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
      const v = NAMED[name.toLowerCase()];
      return v === undefined ? m : v;
    });
}

function safeFromCode(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  try { return String.fromCodePoint(cp); } catch { return ''; }
}

/**
 * Canonical form for comparison: decode entities, NFC-normalise (so a composed
 * "ò" equals a decomposed one), fold the unicode punctuation/space variants that
 * mean the same thing, and collapse whitespace.
 *
 * Deliberately does NOT lowercase — `contains` handles case, and keeping case
 * here means callers can still show the real span.
 */
export function normalizeText(s) {
  return decodeEntities(String(s))
    .normalize('NFC')
    // whitespace variants -> plain space (nbsp is the single biggest offender)
    .replace(/[  -​  　]/g, ' ')
    // quote/dash variants -> ascii
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Numeric spelling variants ----------------------------------------------
// The audit found 6 false positives where the SOURCE spells a number in words
// ("Ninety-seven percent") and the VALUE uses digits ("97%"). OpenGATE's number
// check scans for digits, finds none, and rejects a faithful restatement.
//
// Note this was my own published error: I claimed the OSC card's "97% of
// originals" was a caught fabrication because "97 appears nowhere in that
// abstract". The abstract says "Ninety-seven percent". The same digit-only scan
// that produced the false positive produced my description of it.

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000 };

// A word-number only counts when it is ADJACENT to something that makes it a
// measurement rather than an article or a figure of speech. Without this guard,
// "a single addition" and "one or two copies" would inject a bare 1 into the
// context and could ground a numeric claim that the source never quantified.
const ADJACENT_OK = /^(percent|per\s?cent|%|patients?|participants?|men|women|subjects?|studies|trials?|cases?|groups?|samples?|animals?|mice|hours?|hrs?|h|days?|weeks?|months?|years?|yrs?|minutes?|mins?|times?|fold|copies|alleles?|genes?|journals?|sites?|centres?|centers?|arms?|doses?|mg|kg|g|ml|l|iu|units?|nm|mm|cm|patients|replications?)\b/i;

/** "ninety-seven" -> 97 ; "three" -> 3 ; returns null if not a number phrase. */
function phraseToNumber(words) {
  let total = 0, current = 0, seen = false;
  for (const raw of words) {
    const w = raw.toLowerCase();
    if (w === 'and') continue;
    if (UNITS[w] !== undefined) { current += UNITS[w]; seen = true; }
    else if (TENS[w] !== undefined) { current += TENS[w]; seen = true; }
    else if (SCALES[w] !== undefined) {
      if (!seen) return null;
      if (SCALES[w] === 100) current *= 100;
      else { total += (current || 1) * SCALES[w]; current = 0; }
      seen = true;
    } else return null;
  }
  return seen ? total + current : null;
}

const NUMBER_WORDS = new Set([...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)]);
// How far after the number to look for the thing being counted. Real text puts
// adjectives in between — "three PSYCHOLOGY journals", "Eight RANDOMISED CONTROLLED
// trials" — so a strict next-word check misses genuine quantities. Kept short: the
// further we look, the more likely we bind a number to a noun it doesn't quantify.
const LOOKAHEAD = 4;

/**
 * Digit forms of every spelled-out number in the text, as a space-joined string.
 * A number word only counts when it is quantifying something (the adjacency guard).
 */
export function spelledNumberVariants(text) {
  const out = new Set();
  const tokens = normalizeText(text).split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    // Greedily consume a number phrase: "ninety-seven", "twenty one", "three".
    const start = i;
    const words = [];
    while (i < tokens.length) {
      const parts = tokens[i].toLowerCase().replace(/[^a-z-]/g, '').split('-').filter(Boolean);
      if (!parts.length || !parts.every((p) => NUMBER_WORDS.has(p) || p === 'and')) break;
      words.push(...parts);
      i++;
    }
    if (!words.length) { i = start; continue; }

    const n = phraseToNumber(words.filter((w) => w !== 'and'));
    if (n === null) { i = start; continue; }

    const after = tokens.slice(i, i + LOOKAHEAD).map((t) => t.toLowerCase().replace(/[^a-z%]/g, ''));

    // GUARD 1 — partitive. "one of the reasons", "one of the studies" is not a
    // count of anything; it selects a member. Without this, any "one of the X"
    // would inject a bare 1 and could ground a quantity the source never gave.
    if (after[0] === 'of') { i--; continue; }

    // GUARD 2 — must be quantifying something recognisable within the lookahead.
    if (!after.some((w) => w && ADJACENT_OK.test(w))) { i--; continue; }

    out.add(String(n));
    i--; // the outer loop will i++
  }
  return [...out].join(' ');
}

/**
 * Alternate digit spellings: "35,533" <-> "35533".
 *
 * Separators only. The decimal point is deliberately untouched — "16.608" must
 * never be made to match "16608". That is a different number, not a different
 * spelling of the same one.
 */
export function separatorVariants(text) {
  const out = new Set();
  const t = normalizeText(text);
  for (const m of t.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)) out.add(m[0].replace(/,/g, ''));
  for (const m of t.matchAll(/\b\d{4,}\b/g)) {
    out.add(m[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  return [...out].join(' ');
}

/**
 * Context for the NUMBER check: the real source plus alternate spellings of
 * numbers ALREADY IN IT.
 *
 * This does not add any number the source does not state — it adds the other way
 * of writing a number the source does state. A value claiming a figure the paper
 * never gives still fails, which is what preserves the audit's two true catches:
 * Lippman's invented "~8800 per group" and Border's imported "5-HTTLPR".
 */
export function groundingContext(sourceText) {
  const base = normalizeText(sourceText);
  const extra = [spelledNumberVariants(base), separatorVariants(base)].filter(Boolean).join(' ');
  return extra ? `${base} ${extra}` : base;
}

// --- Deliberately NOT done ---------------------------------------------------
// Both were considered and refused; each would have destroyed a measured true catch
// or a real protection. Recorded so they are not "fixed" later by someone who has
// forgotten why.
//
// 1. FUZZY / SEMANTIC QUOTE MATCHING (would recover 3 false positives).
//    Abandons the verbatim guarantee, which is the only reason `quote` exists. It
//    would score the one confirmed FALSE NEGATIVE — Berry's "unlikely to affect
//    mortality" rewritten as "does not affect mortality" — as a near-perfect match.
//    Those 3 FPs are the model RETYPING a span from memory instead of copying it.
//    That is an extraction-discipline bug; fix it there, not here.
//
// 2. DERIVED ARITHMETIC (would recover 1 false positive: "1976 to 1996 (20 years)").
//    1996 - 1976 = 20 and 35,533 / 4 ~ 8800 are the SAME operation, and the second
//    is true catch #1. No rule admits one and excludes the other. Cost of refusing:
//    one false positive. Worth it.
//
// 3. IDENTIFIER ALLOWLIST for "5-HTTLPR"/"p53"/"IL-6" (predicted to recover >=3).
//    Measured at ZERO false positives. The only identifier-parse rejection was a
//    TRUE catch. This "fix" would have repaired nothing and let a fabrication pass.
