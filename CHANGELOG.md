# Changelog

All notable changes to StudyDiff are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

- Keyword search with a results picker (currently PMID/DOI only).
- Source viewer that highlights each grounded quote in the original text.

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

[Unreleased]: https://github.com/nickjlamb/studydiff/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nickjlamb/studydiff/releases/tag/v0.1.0
