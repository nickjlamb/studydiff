// Study-card extraction: turn a paper's source text into a structured StudyCard
// using Claude. The contract is strict — every field returns BOTH a value and a
// verbatim supporting quote, and any field the text does not state must be
// "not reported" with an empty quote. That discipline is what lets the grounding
// step later verify the card instead of trusting it.
//
// Extraction uses Claude tool-use with a forced input schema. That guarantees a
// validated JSON object back (no prose, no code fences, no all-or-nothing parse
// failure if the model chats first) — which is exactly the fragility that made an
// early version silently return an all-"not reported" card when one response
// didn't parse.

import { DIMENSIONS, DIMENSION_LABELS, NOT_REPORTED, field } from './types.mjs';

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.STUDYDIFF_MODEL || 'claude-sonnet-5';
// Extraction latency is dominated by input size (measured: ~7s on an abstract vs ~19s on
// full text). We cap the text the model READS for extraction; grounding still runs against
// the FULL source text, so quotes verify normally and anything past the cap is "not reported".
const MAX_EXTRACT_CHARS = Number(process.env.STUDYDIFF_MAX_EXTRACT_CHARS) || 18000;

// input_schema for the tool the model is forced to call.
const fieldSchema = {
  type: 'object',
  properties: {
    value: { type: 'string', description: `concise value, or "${NOT_REPORTED}"` },
    quote: { type: 'string', description: 'verbatim span copied from the source text, or "" if not reported' },
  },
  required: ['value', 'quote'],
};
const TOOL = {
  name: 'record_study_card',
  description: 'Record the extracted study design of one paper into the fixed schema.',
  input_schema: {
    type: 'object',
    properties: Object.fromEntries(DIMENSIONS.map((d) => [d, { ...fieldSchema, description: DIMENSION_LABELS[d] }])),
    required: [...DIMENSIONS],
  },
};

const systemPrompt = `You extract the study design of a single research paper into a fixed schema, for a tool that compares papers to explain why they disagree.

Rules:
- Call the record_study_card tool with one entry per dimension.
- For every field provide "value" (concise) and "quote" (a VERBATIM span copied exactly from the provided text — same characters and numbers — that supports the value).
- If the text does not state a field, set "value" to "${NOT_REPORTED}" and "quote" to "". Never guess or infer beyond the text.
- "finding" is the paper's main conclusion stated as a direction of effect relevant to the question.
- Prefer short, exact quotes so they can be located in the source text.`;

/**
 * @param {{pmid:string,citation:string,title:string,text:string,sourceDepth:string}} paper
 * @param {string} question  the biological question being compared across papers
 * @returns {Promise<import('./types.mjs').StudyCard>}
 */
const DEBUG = process.env.STUDYDIFF_DEBUG === '1';

/** A single extraction API call. Returns the tool_use input object (or null) plus metadata. */
async function callExtract(paper, question, key, retryHint = '') {
  const source = paper.text.length > MAX_EXTRACT_CHARS ? paper.text.slice(0, MAX_EXTRACT_CHARS) : paper.text;
  const userPrompt = `Question under comparison: ${question}

Paper: ${paper.citation} — ${paper.title}
Source depth: ${paper.sourceDepth}

--- SOURCE TEXT START ---
${source}
--- SOURCE TEXT END ---

Record every dimension (${DIMENSIONS.join(', ')}) via the record_study_card tool. Base every value only on the source text above.${retryHint}`;

  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const block = (data.content || []).find((b) => b.type === 'tool_use');
  if (DEBUG) {
    console.error(
      `[extract] ${paper.citation}: stop_reason=${data.stop_reason} ` +
      `blocks=${(data.content || []).map((b) => b.type).join(',')} ` +
      `inputKeys=${block ? Object.keys(block.input || {}).length : 0}`,
    );
  }
  return { input: block?.input ?? null, stopReason: data.stop_reason };
}

/**
 * @param {{pmid:string,citation:string,title:string,text:string,sourceDepth:string}} paper
 * @param {string} question  the biological question being compared across papers
 * @returns {Promise<import('./types.mjs').StudyCard>}
 */
export async function extractCard(paper, question) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set — use the offline demo, or add a key for live extraction.');

  // Every paper has a main finding; a card that comes back with no `finding` is a
  // failed call, not a real "the paper says nothing". Retry those, then fail loudly
  // rather than surfacing a blank card that looks like the paper reported nothing.
  const maxAttempts = 3;
  let lastReason = 'unknown';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // On retries, add an explicit nudge (this model deprecates `temperature`, so
    // we vary the prompt instead of the sampling temperature).
    const hint = attempt === 1 ? '' : ` The "finding" field must state this paper's main conclusion from the text — do not leave it as "${NOT_REPORTED}".`;
    const { input, stopReason } = await callExtract(paper, question, key, hint);
    lastReason = stopReason;
    if (input) {
      const card = normalizeCard(input, paper);
      if (card.finding.value !== NOT_REPORTED) return card;
    }
    if (DEBUG) console.error(`[extract] ${paper.citation}: attempt ${attempt} degenerate (no finding), retrying…`);
  }
  throw new Error(
    `extraction failed for ${paper.citation} after ${maxAttempts} attempts (last stop_reason=${lastReason}). ` +
    `Re-run, or set STUDYDIFF_DEBUG=1 for detail.`,
  );
}

/**
 * Coerce a parsed object (from tool-use, or JSON text) into a full StudyCard.
 * Accepts either an object or a JSON string (the latter tolerating code fences).
 */
export function normalizeCard(input, paper) {
  let parsed = input;
  if (typeof input === 'string') {
    const jsonText = input.replace(/```json|```/g, '').trim();
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const m = jsonText.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }
  }
  parsed = parsed || {};
  /** @type {any} */
  const card = {
    pmid: paper.pmid,
    citation: paper.citation,
    sourceDepth: paper.sourceDepth,
  };
  for (const d of DIMENSIONS) {
    const f = parsed[d] || {};
    let value = (f.value ?? NOT_REPORTED).toString().trim() || NOT_REPORTED;
    let quote = (f.quote ?? '').toString().trim();
    // Collapse verbose "not reported" variants to the canonical sentinel so the
    // comparison and gap logic don't mistake them for real, divergent values.
    if (/^(not reported|not specified|not stated|not mentioned|not applicable|n\/a|none reported|unspecified)\b/i.test(value)) {
      value = NOT_REPORTED;
      quote = '';
    }
    card[d] = field(value, quote);
  }
  return card;
}
