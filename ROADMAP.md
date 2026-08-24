# Roadmap

Directions for StudyDiff. Every item must preserve the core guarantee: **no claim is
shown unless it's grounded in the source.** Suggestions welcome via
[issues](https://github.com/nickjlamb/studydiff/issues).

## Done

- ~~**Measure the driver ranking.**~~ Built ([`eval/`](eval/)) and answered: the fixed prior
  scored **13.3% [2/15]**, identical to always guessing `assay`, discordant on 0 of 15 cases,
  and 0/13 on non-assay-labelled cases. Fixing grounding first doubled the oracle ceiling
  (33% → 67%) and top-1 did not move. **The ranking has been retired** — the app now presents
  divergent dimensions unranked. Method and every wrong prediction: [`eval/README.md`](eval/README.md),
  [`eval/PHASE2.md`](eval/PHASE2.md).
- ~~**Quantify extraction variance.**~~ Measured (`npm run eval:variance`): the extracted
  assay string differs on ~90% of re-runs, and the top-ranked driver changed on 1 pair in 3.
  A contributing reason the ranking was never as stable as it looked.

## Next

- **Source viewer.** Click any grounded field to open the paper text with the supporting
  sentence highlighted — make the verification tangible. Now the highest-value UI work,
  since verification is what survived the benchmark intact.
- **Raise the ceiling, not the ranking.** The established cause is a candidate in 10/15
  cases; in the other 5 it is absent from the extraction (2 of those are absent from the
  abstracts entirely and are unwinnable by construction). Better extraction is the only
  thing that can move that number — re-ranking provably cannot.
- **Entailment check on `value` vs `quote`.** Grounding is structurally blind to prose
  overstatement: a value with no numbers and a real quote passes unconditionally, so
  hedge-dropping is invisible (3 slips across 59 adjudicated fields). A looser substring
  test cannot catch this; a different check is needed. See `eval/PHASE2.md`.
- **A held-out set.** The 15 cases have now been looked at across two phases, so post-fix
  numbers are development-set accuracy, not a blind measurement. Only a fresh set can
  restore that.

## Later

- **Finer dimensions.** "Assay / method" is coarse — the Treg case turns on the
  *fate-mapping strategy*, a sub-property of the assay. A finer schema may make the real
  difference visible where the current one flattens it.
- **Keyword search + results picker.** Today a paper is added by PMID, DOI, PDF, or pasted
  text. Add free-text PubMed search that returns candidates to choose from.
- **More than two papers** — compare a small set and cluster by methodology.
- **Domain packs** — tuned dimension sets for clinical trials vs. bench vs. omics studies.

## Tried, didn't work

Kept here so they don't get proposed again as if they were new ideas.

- **Degree of divergence instead of string inequality.** Implemented (Jaccard over content
  tokens, threshold 0.5, now shipped because it is *more correct*) — but it moved accuracy
  by exactly zero. The assumption behind it was wrong: assay values in real pairs genuinely
  share little content, so `assay` was diverging legitimately, not through paraphrase noise.
  Also had to be scoped away from `finding`, where token overlap is blind to antonyms
  ("poorly mimic" vs "greatly mimic" ≈ 0.7 similarity).
- **Full-text over abstracts.** The as-retrieved arm reaches a 35.7% ceiling against the
  abstract arm's 33.3% — 10–20× more text, no meaningful change. It also introduces
  asymmetry decided by journal licensing rather than by the papers.

## Considering

- A grounded, clearly-labelled "why this difference matters" interpretation layer (opt-in,
  separated from verified facts).
- Retraction / expression-of-concern flags on retrieved papers.

## Explicitly out of scope

- Deciding which paper is "right." StudyDiff explains *why* they differ; it does not
  adjudicate truth.
- Any fabricated confidence score or percentage that isn't computed from real signals.
