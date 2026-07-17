# StudyDiff driver-ranking benchmark

**What this measures:** how often StudyDiff's top-ranked driver is the cause the
literature actually established for a documented contradiction — and whether that
beats guessing `"assay"` every single time.

**Why it exists:** `src/compare.mjs` ranks candidate drivers with a hardcoded
constant (`DRIVER_RANK`). If `assay` diverges at all, it is always ranked first.
There is no per-pair reasoning. The prior may well be a good one — but it has
never been measured, and all three shipped examples were believed to be
assay-driven, so it had never been tested on a case it could get wrong.

---

## The rule

> If the eval says the ranker adds nothing over "always guess assay" — **publish that.**

A tool that knows its own accuracy is rarer and more valuable than one that claims
to be trustworthy. Do not tune the set until the number looks good. If you change
the set after seeing the number, say so in the changelog and say why.

---

## Running it

```bash
npm run eval:selftest   # offline, no API key — validates harness maths + set integrity
npm run eval:fetch      # ONE-OFF: needs ANTHROPIC_API_KEY + NCBI. Populates eval/cache/
npm run eval            # offline, free — prints the numbers
npm run eval:variance   # needs API key. Extraction stability over repeat runs

# secondary arm (see "Source depth" below) — reported, never the headline
npm run eval:fetch -- --depth as-retrieved
npm run eval -- --depth as-retrieved
```

`.env` is read automatically (same minimal loader as `src/server.mjs` — no dotenv
dependency, no `--env-file` to remember). Real environment variables win over it.

---

## Source depth: a pre-registered choice

**This was decided before any accuracy number existed.** It is recorded here so it
cannot be mistaken for a post-hoc choice made once the numbers were visible.

`src/ncbi.mjs`'s `fetchPaper` opportunistically upgrades to PMC full text whenever
a paper happens to sit in the Open Access subset. The first exploratory fetch showed
what that does to a benchmark:

- 9 of 30 papers came back as full text, 21 as abstracts.
- **3 pairs became asymmetric.** `vitamin-d-bolus-falls` compared a 2,443-char
  abstract against a 44,776-char full text.
- 6 full texts exceeded `MAX_EXTRACT_CHARS` (18,000) and were **silently truncated**.

Asymmetry is not a neutral inconvenience. The shallower side returns "not reported"
for dimensions the deeper side reports; `compareCards` treats a dimension as
comparable only when *both* papers report it, so those dimensions are dropped from
the candidate set entirely. Which dimensions survive is therefore decided partly by
**journal licensing** — an accident of who put what in the OA subset — rather than
by the papers.

The primary arm is therefore **`abstract`**, for three reasons:

1. **Reproducibility.** PMC OA membership *changes over time*. An as-retrieved
   number would drift for reasons that have nothing to do with the ranker. Abstracts
   are stable, so the published number stays regenerable.
2. **Symmetry.** Both papers are read at the same depth, always. No licensing confound.
3. **Validity.** Every `causeVisibleInSource` annotation was judged against abstracts,
   so the oracle ceiling is only meaningful against abstracts.

The `as-retrieved` arm is available and reported alongside — it is closer to what the
live tool does — but it is **not the headline**, and `npm run eval` prints a warning
listing every asymmetric pair. Source depth is part of the cache key, so the two arms
can coexist and the scorer refuses to mix them.

The split is deliberate. `eval:fetch` is the only part that costs money or needs
the network. Once `eval/cache/` is populated **and committed**, anyone can
regenerate the published number with `npm run eval` — no API key, no NCBI, no
trust required. That is the point: the number is reproducible from artefacts in
the repo rather than taken on faith.

`eval/cache/` is committed on purpose. It is not build output; it is evidence.

---

## What gets reported

| Number | Meaning |
|---|---|
| **Top-1 accuracy (strict)** | Top-ranked driver == the case's single primary label. **This is the headline.** |
| **Baseline "always say assay"** | Accuracy of a constant guess. If strict ties this, the ranker adds nothing. |
| Lenient accuracy | Credits any *documented contributing* dimension (`alsoAcceptable`), not just the primary. Reported alongside, never as the headline. |
| **Oracle ceiling** | How often the established cause is even a *candidate* driver. Re-ranking cannot beat this — only better extraction can. |
| Accuracy among reachable | The ranking problem in isolation, with extraction failures excluded. |

All proportions carry **Wilson 95% intervals**, because n is 15. A point estimate
from 15 cases without an interval is exactly the unearned precision this project
exists to avoid: 60% from n=15 is compatible with a true rate of roughly 36–80%.
The intervals are computed from observed counts — they are not confidence scores
anyone invented.

**On the ceiling.** Two cases (`hrt-timing-hypothesis`, `selenium-baseline-status`)
have an established cause that appears in *neither* abstract. StudyDiff reads text,
so it cannot win them. They are **kept in the headline anyway** and scored as
misses, because excluding them would flatter the number. The ceiling is reported
separately so the two failure modes stay distinguishable:

- *the ranker chose wrong* — fixable by ranking (Phase 2)
- *the evidence was never in the text* — not fixable by ranking, at all

A tool that confidently "detects" the selenium story from those two abstracts is
hallucinating, not reading.

---

## Result (first run, abstract arm)

```
Top-1 accuracy (strict)      13.3%  (95% CI 3.7-37.9%)  [2/15]
Baseline "always say assay"  13.3%  (95% CI 3.7-37.9%)  [2/15]
                             -> the two disagree on 0/15 cases
Oracle ceiling (reachable)   33.3%  (95% CI 15.2-58.3%) [5/15]
```

**The ranker adds nothing over a constant guess.** This is not "ties on average" —
it is behaviourally identical on every one of the 15 cases. The ranker predicted
`assay` 13/15 times; its only two deviations (`model` on HRT, `species` on
ivermectin) were both wrong. The two hits are exactly the two assay-labelled cases.
A paired comparison with **0 discordant pairs** is far stronger evidence than the
two wide marginal CIs suggest: there is no case on this set where the ranker and the
constant guess behave differently.

**Read the 13.3% correctly.** It is low *by set design*: assay is deliberately only
2/15, so "always guess assay" can only score 2/15. The finding is the **tie**, not the
absolute number. On a set with assay at 1/3, both numbers would rise together.

### The secondary arm settles the cause

The `as-retrieved` arm (full text wherever PMC OA has it — 9 of 30 papers, 10-20x more
text) was **pre-registered before any number existed**, with a stated prediction: if
the ceiling stays ~33%, thin abstracts are exonerated and grounding is the bottleneck.

```
                            abstract arm      as-retrieved arm
Top-1 (strict)              13.3%  [2/15]     14.3%  [2/14]
Baseline "always assay"     13.3%  [2/15]     14.3%  [2/14]
Discordant pairs            0/15              0/14
Oracle ceiling              33.3%  [5/15]     35.7%  [5/14]
Predicted `assay`           13/15  (87%)      14/14  (100%)
```

**The prediction held.** Reading 10-20x more text moved the ceiling by a single case.
Abstracts were never the problem.

**And an unpredicted finding: more text makes the ranker MORE degenerate.** On
abstracts it deviated from "always assay" twice (both wrong). On full text it deviated
**zero** times — it is not merely tied with the constant guess, it *is* the constant
guess, exactly. The mechanism is the one the variance run exposed: more text means more
ways for two assay strings to differ, and `norm(av) !== norm(bv)` fires every time.
Reading more makes it worse.

**On this arm, both hits are cases where the tool asserts no contradiction at all**
(`resveratrol`, `treg` both appear in the no-conflict list). Requiring
`findingsConflict` before crediting a driver puts as-retrieved strict accuracy at
**0/14 (0.0%)**.

The two arms also disagree about *which* 5 cases fail to conflict, and about which
are reachable (`5httlpr` lost reachability, `ivermectin` gained it — full text supplies
Caly's concentration, as annotated). That churn is the extraction variance, showing up
again at the case level.

(1 case, `hrt-timing-hypothesis`, failed to fetch on this arm and is excluded from its
n. It does not affect the conclusion — it was an unreachable miss on the abstract arm.)

### The bigger finding: the ranker is not the bottleneck

`npm run eval:diagnose` splits the loss by stage:

```
labelled dimension divergent in raw extraction   12/15
still a candidate after grounding                 5/15
LOST TO GROUNDING                                 7/15
```

Extraction **found the right dimension in 12 of 15 cases**. The grounding step then
downgraded it to "not reported" in 7 of them, so the ranker never saw it. That is
what caps the ceiling at 33% — not thin abstracts, and not the prior.

This reorders Phase 2. Fixing `DRIVER_RANK` can buy **at most +20 points** (13.3% ->
33.3% ceiling). The grounding false-positive rate is worth roughly twice that — and the
as-retrieved arm confirms it cannot be bought with more text either.

Phase 2, in the order the measurement supports:

1. **Measure grounding's false-positive / false-negative rate.** It costs 7/15 cases.
   Some rejections are correct (it caught a fabricated "97%"). Do not touch it until
   both rates are known — this is the trust layer, and loosening it by feel trades a
   measured FP rate for an unmeasured FN rate.
2. **Replace the string-inequality divergence test.** Even crude token overlap would
   beat `norm(av) !== norm(bv)` and stays deterministic. The variance run shows the
   current test registers every paraphrase as full divergence, which is *why* the prior
   always fires and why more text makes it worse.
3. **Only then, `DRIVER_RANK`.** It is the smallest of the three.

Grounding rejected 29 fields across the set (8.8% of all fields), for two reasons:

| Cause | n |
|---|---|
| quote not an exact substring of source | 18 |
| a number in the value did not trace | 11 |

> **CORRECTION (Phase 2 audit).** An earlier version of this file claimed the OSC card's
> `"97% of originals"` was a true catch because "97 appears nowhere in that abstract".
> **That was wrong.** The abstract says *"Ninety-seven percent of original studies had
> statistically significant results"* — spelled out. The value is a faithful
> restatement; grounding rejected it because it scans for digits only. It is a
> **false positive**, and it was the flagship example used to argue against loosening
> grounding. A second claim — that `"5-HTTLPR"` being parsed as the digit `5` was a
> false positive — was also **backwards**: that rejection was a **true catch**. Both
> errors were found by independent adjudication and are corrected below. See
> `PHASE2.md` for the pre-registered predictions this falsified.

The rejections were adjudicated individually against the source text (Phase 2, step 1).
See "Grounding audit" below for the measured rates.

**Do not loosen grounding by feel.** It is the trust layer; relaxing it trades a
*measured* false-positive rate for an *unmeasured* false-negative rate. So both rates
were measured before anything was touched.

### Extraction variance (3 pairs x 5 identical runs)

```
pair                          modal driver  driver agree  distinct assay strings
thrombolysis-time-window      assay         100%          4 / 4  of 5
mouse-models-gene-selection   assay          80%          4 / 5  of 5
treg-lineage-fate-mapping     assay         100%          5 / 5  of 5
```

**1/3 pairs changed their top-ranked driver across 5 identical runs.** That is the
number nobody in this space publishes, and it is non-zero.

But the summary line understates it. The *extracted assay string* differed on roughly
**90% of re-runs** — mean ~4.5 distinct values per 5 runs across 6 paper-slots, with
two slots producing a different string every single time. One slot
(`mouse-models` study B) flipped between `"not reported"` and four different real
values on identical input.

**Why the driver looks stable anyway — this is the finding.** `compare.mjs` decides
divergence with a string inequality, `norm(av) !== norm(bv)`. Every paraphrase is a
new string, so `assay` "diverges" regardless of what the model wrote. **The ranking is
stable because the divergence test is trivially satisfied, not because extraction is
reliable.** It is stably wrong.

The Treg pair demonstrates it exactly:

```
A: "Flow cytometry, ICS, bisulfite sequencing of TSDR methylation, adoptive transfer"
B: "Genetic fate-mapping with inducible Cre-lox YFP labeling and flow cytometry"
```

Both say flow cytometry. Scored as *fully* divergent. This is the known weakness from
`PLAN.md` — now measured rather than suspected.

### A caveat that cuts against the tool

The pipeline **failed to detect conflicting findings in 5/15 documented
contradictions**, because grounding downgraded the `finding` field itself. In those
cases `synthesize` states that "no contradiction is asserted" — the tool would not
have surfaced drivers at all. One of the two hits (`resveratrol-sirt1-substrate`) is
such a case, so it is scored generously here. Requiring `findingsConflict` for a hit
would put strict accuracy at **1/15 (6.7%)**, still tied with the baseline on
discordance. Both readings are reported rather than the flattering one chosen.

---

## The set

15 documented contradictions. Every case carries:

- two papers (PMIDs)
- the established cause, in one sentence
- the StudyDiff dimension it maps to (**primary label**)
- `alsoAcceptable` — other dimensions documented sources show contribute
- **a citation for the label** — the review, commentary, pooled analysis or
  reanalysis that established it. *No label without a source.*
- `confidence` — `established` or `contested`. Some "established" causes are still
  argued over; the flag says so rather than pretending.
- `causeVisibleInSource` — `yes` / `partial` / `no`. Whether the causal difference
  is actually stated in both abstracts.
- `evidence` — verbatim spans from each abstract

### Label distribution

| Dimension | n |
|---|---|
| statistic | 4 |
| dose | 3 |
| timing | 2 |
| model | 2 |
| assay | 2 |
| endpoint | 1 |
| sampleSize | 1 |

**assay = 2/15 (13.3%)**, well under the 1/3 ceiling. This is the constraint that
makes the eval meaningful: if most cases were assay-driven, the fixed prior would
score well by construction and the benchmark would measure nothing. It is
asserted in `eval:selftest`, so it cannot drift silently.

### Sourcing

The set is deliberately weighted toward **clinical and pharmacology** contradictions.
Bench biology skews assay-driven; dose- and population-driven reversals are far
easier to find in the clinical literature, and that is where most of the non-assay
cases came from.

---

## Verification

Every PMID in `cases.json` — 46 unique, including those cited only in prose — was
retrieved from PubMed and checked against its claimed title, first author, year
and journal. Every quoted span was checked against the retrieved abstract.

That pass was run adversarially, tasked with finding errors rather than confirming.
It found **zero wrong PMIDs and zero wrong citation strings**, and eight real
defects, all since corrected. The most serious is worth recording because it is
the same class of error this project exists to catch:

> Two `evidence` spans for the resveratrol case were **fabricated** — copied from a
> repo fixture's card *values* (which are descriptions written by a human) into a
> field whose schema promises *verbatim quotes from the abstract*. A description of
> a source is not a quote from it.

Also corrected: two overstated `causeVisibleInSource` values (`yes` → `partial`, on
the two cases sourced from fixtures rather than fresh retrieval — which lowered the
a priori ceiling), one interpolation inside quotation marks ("Vitamin A" misquoted
as "vitamin A/beta-carotene"), and two unmarked elisions. See
`provenance.verificationHistory` in `cases.json`.

A second guard lives in `lib.mjs`: the scorer **refuses** cache entries that did not
come from a real extraction run. This is not hypothetical — while smoke-testing the
reporter, the cache was seeded from the repo's hand-written fixture cards. Scoring
those would have measured the ranker against idealised human-authored extractions
and reported it as the tool's accuracy.

---

## Known limitations

1. **Abstract-based, by choice.** The primary arm reads abstracts only (see above).
   This caps the ceiling and is reported, not hidden. It also means the headline
   number *understates* what the live tool does when full text happens to be
   available — the `as-retrieved` arm exists to show that, with its confound flagged.
2. **n = 15.** Wide intervals. The eval can detect a large gap from the baseline;
   it cannot resolve a small one. Do not report a 7-point difference as an effect.
3. **`alsoAcceptable` is a judgement call.** It is drawn from what the cited sources
   say contributes, but the boundary is soft. That is why the *strict* score is the
   headline.
4. **Label sources are sometimes the reanalysing paper itself.** Unavoidable for
   same-data disputes (Seok/Takao, Miller/Berry, Gilbert/OSC): the paper that
   demonstrates the cause *is* the paper that disagrees. Flagged per-case. The
   5-HTTLPR case is the honourable exception — Karg et al. ran the discriminating
   test (re-restricting to the prior study set) rather than merely asserting the cause.
5. **Two cases are unwinnable by construction** (see the ceiling, above).
6. **Contested cases are scored the same as established ones.** The flag exists so
   readers can subset; the headline does not exclude them.
7. **One question was reworded after a real extraction failure.** `candidate-gene-power`
   originally asked "Do candidate gene polymorphisms *predict* major depression?" —
   a main-effect question. Caspi et al. report a gene-by-environment *moderation*
   effect and claim no main effect, so extraction correctly returned "not reported"
   for `finding` three times and the pipeline refused to emit a blank card. The
   benchmark had asked both papers something only one of them answers. The question
   was fixed; the incident is recorded in `questionNote` rather than quietly erased,
   because "the eval asked a bad question" is a failure mode worth knowing about —
   and because the pipeline failing loudly here is the "not reported, never guessed"
   discipline working, not a bug.

---

## A finding that predates the first run

The handoff assumed all three shipped examples were assay-driven. That is not quite
right, and the exception matters.

`mouse-inflammation` is Seok vs Takao: the **same datasets**, opposite conclusions,
cause = *gene selection*. That is an analytic choice — `statistic`, not `assay`. But
the fixture's example extraction files it under the assay field:

```
assay: "Compared murine orthologs of genes changed significantly in humans"
```

So the ranker calls it `assay` and appears to get it right — for the wrong reason.
The genuine assay cases are resveratrol (Fluor de Lys substrate artifact) and Treg
(fate-mapping). In the benchmark this pair is labelled `statistic`, and in the
smoke test the ranker missed it.

This is also a hint about Phase 2: `assay` may be absorbing dimensions that are not
assays. Do not act on it until the eval says so.
