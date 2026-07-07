# Contributing to StudyDiff

Thanks for your interest. StudyDiff compares two papers and explains *why* they disagree, with every claim grounded in the source text. Contributions that keep that trust guarantee intact are very welcome.

## Getting started

```bash
npm install
npm run demo                        # offline walkthrough, no API key
npm run demo -- resveratrol-sirt1   # second example pair
npm run serve                       # web app at http://localhost:4173
```

Live extraction (the `pmid` / `paste` paths and the CLI) needs an `ANTHROPIC_API_KEY` in a local `.env` — copy `.env.example`. Never commit `.env`; it's gitignored.

## Project layout

- `src/ncbi.mjs` — PubMed/PMC retrieval, with a full-text→abstract fallback and honest `sourceDepth` tagging.
- `src/extract.mjs` — Claude tool-use extraction into a fixed study-card schema.
- `src/compare.mjs` — deterministic divergence detection and candidate-driver ranking.
- `src/gaps.mjs` — bounded "observed across these papers" gaps.
- `src/grounding.mjs` — OpenGATE grounding wrapper (deterministic, no LLM judge).
- `src/pipeline.mjs` — orchestration: retrieve → extract → **verify → compare**.
- `src/server.mjs` + `public/index.html` — local web app.
- `fixtures/` — cached real papers + example study cards for the offline demos.

## Invariants (please don't break these)

1. **Grounding is deterministic.** The verification step uses OpenGATE's `checkGrounding`, never an LLM as judge. Keep it that way.
2. **Ground before you compare.** `buildResult` verifies every field first and downgrades anything unsupported to `not reported` *before* comparison and synthesis. StudyDiff must never cite a fact it hasn't verified.
3. **"Not reported", never guessed.** Any field the source text doesn't support is `not reported` with an empty quote. Extraction must not infer beyond the text.
4. **Gaps stay bounded.** Absence claims are only ever scoped to the compared papers ("none of these studies…"), never "no one has ever…".
5. **Plain ESM, minimal deps.** `.mjs` modules, no build step; the only runtime dependency is `@pharmatools/opengate`.

## Adding a demo pair

Add a `fixtures/<name>.json` with two `papers` (verbatim `text`, plus an example `card` whose every `quote` is an exact substring of that text so grounding passes), a `question`, and a `naiveClaim` for the guardrail demo. Then `npm run demo -- <name>`.

## Conventions

- Keep values concise; quotes must be copied verbatim from the source.
- Match the existing style; no new runtime dependencies without discussion.
- Open an issue before large changes.
