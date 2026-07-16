# Roadmap

Directions for StudyDiff. Every item must preserve the core guarantee: **no claim is
shown unless it's grounded in the source.** Suggestions welcome via
[issues](https://github.com/nickjlamb/studydiff/issues).

## Next

- **Measure the driver ranking.** Today the drivers are ordered by a *fixed prior* over
  design dimensions (assay > model > intervention > … > statistic), not by an assessment of
  the specific pair — so if the assay differs at all, it is always the primary driver. The
  prior is a reasonable default, but nobody has checked it. Build a benchmark of documented
  contradictions whose cause the literature has since established (each label carrying its
  own citation), and report two numbers: how often the top-ranked dimension is the
  established cause, and how that compares to the trivial baseline of *always* guessing
  assay. The set must include plenty of non-assay-driven cases or it measures nothing.
  Publish the result either way, and publish the benchmark.
- **Source viewer.** Click any grounded field to open the paper text with the supporting
  sentence highlighted — make the verification tangible.
- **Quantify extraction variance.** The same paper can yield differently-worded values for a
  field across runs, which can change the ranking. Measure how often, and report it.

## Later

- **Degree of divergence, not binary.** Divergence is currently a string inequality. Two
  assay values sharing "flow cytometry" are less divergent than "flow cytometry" vs
  "bisulfite sequencing"; even token overlap would be an improvement, and stays
  deterministic.
- **Finer dimensions.** "Assay / method" is coarse — the Treg case turns on the
  *fate-mapping strategy*, a sub-property of the assay. A finer schema may make the real
  driver visible.
- **Keyword search + results picker.** Today a paper is added by PMID, DOI, PDF, or pasted
  text. Add free-text PubMed search that returns candidates to choose from.

## Later

- **Exportable report** — a shareable, cited summary (Markdown / PDF) of a comparison.
- **More than two papers** — compare a small set and cluster by methodology.
- **Full-text emphasis** — when full text is available, prioritise methods/results sections
  during extraction for deeper cards.
- **Domain packs** — tuned dimension sets for clinical trials vs. bench vs. omics studies.

## Considering

- A grounded, clearly-labelled "why this difference matters" interpretation layer (opt-in,
  separated from verified facts).
- Retraction / expression-of-concern flags on retrieved papers.

## Explicitly out of scope

- Deciding which paper is "right." StudyDiff explains *why* they differ; it does not
  adjudicate truth.
- Any fabricated confidence score or percentage that isn't computed from real signals.
