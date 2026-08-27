# Changelog

All notable changes to StudyDiff are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Added

- **Source viewer.** Every grounded value in the full comparison is now a button — click
  it to open the paper's own text with the supporting sentence highlighted in place, in
  surrounding context. This closes the last gap between *"we verified this"* and *"see for
  yourself"*: the reader no longer takes on faith that the quoted sentence sits in a real
  paper and wasn't assembled.

  The highlight ranges are computed **server-side by the same matcher that earns the ✓
  badge** (`locateQuote` in `src/grounding.mjs`, which `containsAllowingEllipsis` is now
  derived from). The viewer renders those ranges; it never re-matches. So the highlight
  cannot drift from the badge — a viewer that said "sentence not found" beside a ✓ would be
  the worst bug this product could ship, and this design makes it structurally impossible.
  Ellipsis-joined quotes highlight each fragment (not the gap between them); the guards
  that stop ellipsis-joining becoming a fabrication licence are unchanged, and both true
  catches in `eval:normtest` still reject.

  Plumbing: `buildResult` now returns each paper's normalised source text (`sources`) and
  per-field match spans (on `grounding.*.results[dim].spans`) in the payload. The text is
  carried in the result payload rather than a second endpoint — it is small (extraction is
  capped at 18 KB; the in-memory result cache is LRU 200 / 6 h), so a leaner payload wasn't
  worth a second cache key and rate-limit surface. Purely additive: CLI, Markdown/HTML
  exports and the MCP server are unaffected.

### Removed

- **The primary driver.** StudyDiff no longer nominates one divergent dimension as the
  likely cause of a disagreement, anywhere: web answer card, Markdown and HTML exports,
  CLI, and MCP. It presents the divergent dimensions **unranked**, in schema order.

  This is a measured decision, not a stylistic one. The ordering came from a fixed prior
  (`DRIVER_RANK`) in which `assay` outranked everything. Benchmarked against 15 documented
  contradictions with cited labels, it scored **13.3% [2/15]** — identical to always
  guessing `assay`, **discordant on 0 of 15 cases**, and **0/13** on non-assay-labelled
  cases. Fixing grounding first (recovering 20 of 26 false-positive rejections) doubled the
  oracle ceiling from 33% to 67% and top-1 accuracy did not move at all: handed the right
  answer five more times, the prior took none of them.

  What survived intact: which dimensions differ, which are identical (*ruled out*), and the
  verbatim sentence behind every value. None of it depended on the ranking.

### Added

- **Held-out benchmark set** (`eval/cases-heldout.json`): a second, blind set of 15 documented
  contradictions, curated to a protocol written and committed *before any case was selected*
  (`eval/HELDOUT-PROTOCOL.md`) by a curator kept blind to the dev set's per-case failures, then
  fetched and scored on the pre-registered abstract arm. Deliberately different fields —
  microbiome, marine ecology, toxicology, psychology, critical care, oncology, infectious
  disease — with no paper or contradiction shared with `cases.json`, enforced by `selftest`
  rather than trusted to memory.

  It exists because the original 15 had been read across two phases, which makes every
  post-fix figure from them *development-set* accuracy. The blind result:

  ```
  Top-1 accuracy (strict)      13.3%  (95% CI 3.7-37.9%)   [2/15]
  Baseline "always say assay"  20.0%  (95% CI 7.0-45.2%)   [3/15]
  Oracle ceiling (reachable)   73.3%  (95% CI 48.0-89.1%)  [11/15]
  Non-assay-labelled cases      0.0%  (95% CI 0.0-24.3%)   [0/12]
  ```

  On unseen data the retired prior scores *below* the constant guess, by one case out of
  fifteen; the intervals overlap almost entirely, so it remains indistinguishable from
  guessing `assay` every time rather than demonstrably worse. Across both sets it identified
  **0 of 25** contradictions whose established cause was not `assay`. The ceiling is *higher*
  here than on the dev set (73.3% vs 66.7%) — extraction surfaced the right answer more often
  and the prior took it no more often, which is the Phase 1-2 conclusion reproduced on data
  the development loop never saw.

  Reported separately from the dev-set number and never pooled: an "n=30" figure would
  relaunder read data as blind data. Nothing in `src/` was changed on the basis of it.
  An adversarial verification pass over all 45 abstracts before scoring confirmed 45/45 spans
  verbatim and corrected 16 defects in the interpretive fields — including one inverted
  mechanism and one derived number presented as a paper's finding — all recorded in the file's
  `provenance.verificationHistory` rather than quietly absorbed.

- **`--set dev|heldout` throughout the eval harness.** Each set has its own cases file *and*
  its own cache directory, so the two can never be pooled by a forgotten filter; cache entries
  carry their set and the reader refuses a mismatch, as it already did for depth arms.
  `selftest` gained contamination checks (no shared ids or PMIDs with the dev set, no paper in
  two cases, no label cited to one of its own papers) and a warning if a set contains no
  hard-visibility cases. Dev-set paths are byte-identical, and `npm run eval` still prints
  13.3% [2/15]. New scripts: `eval:heldout`, `eval:fetch:heldout`, `eval:selftest:heldout`.

- **Driver-ranking benchmark** (`eval/`): 15 documented contradictions, each label carrying
  its own citation; scorer with Wilson 95% intervals, a constant-guess baseline, an oracle
  ceiling and a confusion matrix. `npm run eval` regenerates the published numbers offline
  from committed cache — no API key, nothing taken on faith.
- **"Does it work?" section in the README** reporting the result, including the parts that
  reflect badly on the tool.
- `RETIRED_DRIVER_PRIOR` / `rankByRetiredPrior` in `src/compare.mjs`, exported solely so the
  benchmark can keep scoring its own subject. Not applied to anything a user sees.

### Fixed

- Grounding false positives: guarded ellipsis handling, thousands separators, spelled-out
  numbers via a closed lexicon. FP rate on rejected fields fell from 90% to 21% while both
  true catches were preserved (`npm run eval:normtest` fails loudly if either starts passing).
- Divergence is now graded (Jaccard over content tokens, threshold 0.5) rather than string
  inequality — scoped to design dimensions only, because token overlap is blind to antonyms
  and applying it to `finding` broke contradiction detection.
- The synthesis paragraph no longer states a count of differing dimensions: a tally is a
  number appearing in neither paper, so grounding correctly rejected the whole paragraph.

### Planned

- Source viewer that highlights each grounded quote in the original text.
- Raising the oracle ceiling through better extraction — the only thing that can now move
  accuracy, since re-ranking provably cannot.
- Keyword search with a results picker (currently PMID/DOI only).

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
