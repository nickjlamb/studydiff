# StudyDiff

**Why do these two papers disagree?** StudyDiff is a contradiction explorer for bench scientists. Give it two papers that reach opposing conclusions and it extracts each study's design, isolates the methodological differences that most plausibly explain the conflict, and — critically — grounds every claim in the source text so it never invents a finding.

Built for the *Built with Claude: Life Sciences* hackathon (Builder track). Named user: a lab scientist deciding which of two conflicting papers to trust before planning an experiment.

## The idea in one screen

```
npm install
npm run demo                        # fully offline — no API key, no network
npm run demo -- resveratrol-sirt1   # a second real contradiction
```

The default demo runs on a famous contradiction: two PNAS papers that analysed the **same datasets** and reached opposite conclusions about whether mouse models mimic human inflammation ([Seok 2013](https://pubmed.ncbi.nlm.nih.gov/23401516/) vs [Takao & Miyakawa 2015](https://pubmed.ncbi.nlm.nih.gov/25092317/)). StudyDiff shows the design side-by-side, flags where they diverge, and points to the single driver: the **gene-selection criterion**.

The second (`resveratrol-sirt1`) is a classic bench assay artifact — [Howitz 2003](https://pubmed.ncbi.nlm.nih.gov/12939617/) vs [Beher 2009](https://pubmed.ncbi.nlm.nih.gov/19843076/) — where StudyDiff traces the disagreement to the **substrate used to assay SIRT1** (a fluorogenic peptide whose signal was later shown to be an artifact).

## How it works

```
 PubMed / PMC          Claude              deterministic          OpenGATE
 retrieval    ─▶  study-card       ─▶   comparison &       ─▶   grounding
 (full-text→        extraction          gap detection            check
  abstract          (strict schema,     (which design            (every quote in
  fallback)         "not reported"      dimensions differ?)      source; every
                     default)                                    number traceable)
```

1. **Retrieve** (`src/ncbi.mjs`) — fresh PubMed E-utilities client. Tries PMC full text, falls back to the abstract when a paper isn't in the Open Access subset, and tags each paper's `sourceDepth` so the tool never pretends to have read a methods section it couldn't access.
2. **Extract** (`src/extract.mjs`) — Claude turns each paper into a fixed **study card** (species, model, assay, dose, timing, endpoint, sample size, statistic, finding, limitations). Every field carries a **verbatim supporting quote**, and any field the text doesn't state is `not reported` — never guessed.
3. **Compare** (`src/compare.mjs`) — deterministic: which dimensions agree, which diverge, and the divergent *design* dimensions ranked as candidate reasons for the disagreement.
4. **Bounded gaps** (`src/gaps.mjs`) — only claims scoped to the papers in front of it (“all compared studies share X”, “none reports Y”). Never “nobody has ever studied this.”
5. **Ground** (`src/grounding.mjs`) — [OpenGATE](https://github.com/nickjlamb/opengate)’s deterministic `checkGrounding` (no LLM judge) verifies every value’s quote really appears in the source and every number traces back to it. Anything that fails is downgraded, not shown as fact.

## Web app

```bash
cp .env.example .env      # add ANTHROPIC_API_KEY for live mode
npm run serve             # http://localhost:4173
```

Open the page and either run a built-in **example** (cached abstracts, no key needed), compare two **PMIDs** live, **upload two PDFs** of the full papers, or **paste** two abstracts. Uploaded PDFs are text-extracted server-side (pure JS, no system deps), which gives richer study cards than an abstract — fewer fields come back "not reported". The pipeline streams each step as it runs — retrieve → extract A → extract B → verify → explain — and the key stays server-side, never in the browser.

## Live CLI

```bash
node src/cli.mjs --q "Does resveratrol activate SIRT1?" 12939617 19843076
```

## Provenance / hackathon rules

All application code in this repository was written from scratch during the hackathon. [OpenGATE](https://www.npmjs.com/package/@pharmatools/opengate) is used only as a published npm dependency for the grounding check. Retrieval hits public NCBI E-utilities; extraction uses the Claude API. Open-sourced under MIT.

## Status

Day-one skeleton: retrieval, extraction, comparison, bounded gaps, and grounding all working, with an offline demo on the flagship pair. Next: a second demo pair (resveratrol/SIRT1 assay artifact), a web UI with the streaming pipeline view, and paste-in of PDF methods text for deeper grounding.
