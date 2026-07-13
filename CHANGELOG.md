# Changelog

All notable changes to StudyDiff are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Planned

- Keyword search with a results picker (currently PMID/DOI only).
- Source viewer that highlights each grounded quote in the original text.

## [0.2.0] — 2026-07-13

Submission for Anthropic's **Built with Claude: Life Sciences** hackathon.

### Added

- **MCP server** — the contradiction engine is now a [Model Context Protocol](https://modelcontextprotocol.io)
  server (`src/mcp.mjs`), so Claude or any agent can call it as a tool: `compare_studies`,
  `compare_example`, `list_examples`. Published to npm as
  [`studydiff-mcp`](https://www.npmjs.com/package/studydiff-mcp) and to the
  [official MCP Registry](https://registry.modelcontextprotocol.io) as
  `io.github.nickjlamb/studydiff`. `compare_example` runs fully offline — no API key, no network.
- **Shared Markdown report** (`src/report.mjs`) — one auditable report format across the web app,
  the CLI and the MCP surface: verdict, ranked drivers, verification counts, and every value with
  the verbatim sentence that supports it.
- **Third worked example — Treg lineage stability**
  ([Zhou 2009](https://pubmed.ncbi.nlm.nih.gov/19633673/) vs
  [Rubtsov 2010](https://pubmed.ncbi.nlm.nih.gov/20929851/)): a landmark T-cell-immunology
  controversy where the disagreement (stable vs. unstable Treg lineage) traces to the
  fate-mapping method.
- **Unified dropzone** — one drag-and-drop target that splits into Paper A / Paper B on first
  interaction, so two PDFs can be dropped in a single action while still allowing mixed inputs
  (PDF · PMID/DOI · paste).

### Changed

- **Run time roughly halved.** The two Claude extractions now run concurrently, extraction input is
  capped, and quotes are constrained to the shortest exact span. Output dropped from ~2.5k to ~1.2k
  tokens per card, taking a full-text pair from ~19–21s to ~11s. Grounding still runs in 0–15ms.
- **Results rebuilt around the answer** — a scannable "why these studies differ" card (verdict →
  most likely reason → each study's conclusion), a visually dominant primary driver, in-body
  accordions for the detail panels, and a unified right rail with verification metric tiles
  (claims verified · fields not reported · **0 invented**).
- Colour now carries meaning only: teal = Study A, purple = Study B, green = verified.
- En dashes throughout the app.

### Fixed

- Full-text PDFs no longer fail with "Request too large" (compare-body limit raised to 8 MB).
- The results reveal no longer jumps: layout settles before scrolling, and the embedded iframe no
  longer fights its own resize.
- Added HSTS and `upgrade-insecure-requests`, so the app can't be reached over plain HTTP.

## [0.1.0] — 2026-07-12

First public release.

### Added

- **Contradiction engine** — extracts a structured study card per paper (species, model,
  assay, dose, timing, endpoint, sample size, statistic, finding, limitations) via Claude
  tool-use, defaulting any unsupported field to *not reported*.
- **Deterministic grounding** — every value and every synthesised reason is verified against
  the source text (verbatim quote present, numbers traceable) with no LLM-as-judge. Grounding
  runs before comparison, so ungrounded fields are downgraded before they can be cited.
- **Answer-first results** — a plain-language explanation of the disagreement, a ranked
  "what's driving the difference" panel (primary / also differs / ruled out), a verification
  summary, a collapsible full comparison, and bounded "not reported by either" observations.
- **Retrieval** — PubMed/PMC client with full-text-to-abstract fallback, source-depth tagging,
  and DOI-to-PMID resolution.
- **PDF upload** — pure-JS server-side text extraction, so full papers give richer cards.
- **Web app** — single-file dashboard with a streaming pipeline view and per-paper
  PMID/DOI · Upload PDF · Paste inputs; the API key stays server-side.
- **CLI** and two offline worked examples (mouse-model inflammation; resveratrol/SIRT1).
- **Production hardening** — per-IP rate limiting, a daily live-call cap, result caching,
  security headers, and a request-size limit.

[Unreleased]: https://github.com/nickjlamb/studydiff/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nickjlamb/studydiff/releases/tag/v0.2.0
[0.1.0]: https://github.com/nickjlamb/studydiff/releases/tag/v0.1.0
