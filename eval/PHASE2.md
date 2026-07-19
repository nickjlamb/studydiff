# Phase 2 — pre-registration

**Written before any measurement or fix. Committed before the code that tests it.**

The 15-case benchmark was built blind, which is the only reason 13.3% means anything.
Phase 2 changes get measured against that same set, so the set can be burned — quietly
and irreversibly — by tuning against it. This document is the guard.

## The rules for Phase 2

1. **Fix on principle, never by search.** Each change must be justified by the
   *diagnosis* (`npm run eval:diagnose`) and by first principles, not by trying
   variants and keeping the one that scores best. No thresholds tuned by looking.
2. **One look per fix.** Run `npm run eval` once after a fix. Report the result
   whether it helps, does nothing, or hurts.
3. **Predictions are written here first.** If a prediction is wrong, it stays in this
   file, marked wrong. That is the whole point.
4. **After Phase 2, the number is weaker than 13.3%.** Even with this discipline, the
   set has now been looked at. Post-fix accuracy must be reported as
   *"development-set accuracy after N pre-registered changes"* — not as a clean
   blind measurement. Only a fresh held-out set can restore that, and building one
   is a Phase 5 decision.

---

## What the Phase 1 measurement established

| | |
|---|---|
| Top-1 (strict) | 13.3% [2/15] — **identical** to "always guess assay", 0/15 discordant |
| Oracle ceiling | 33.3% [5/15] |
| Labelled dimension divergent in raw extraction | **12/15** |
| Lost to grounding | **7/15** |
| Full-text arm ceiling | 35.7% — moving to 10-20x more text changed nothing |
| Extraction variance | assay string differs on ~90% of re-runs; driver changes 1/3 pairs |

The ranker is not the bottleneck. Grounding is. More text does not help.

---

## Hypothesis 1 — grounding's rejections are mostly false positives

**Claim.** Of the 29 fields grounding downgraded, the majority are values that the
source text *does* support, rejected for mechanical reasons rather than because the
claim was unfounded.

**Predicted causes**, from the diagnosis (in expected order of frequency):

1. **Quote is not a literal substring** (18 of 29 rejections were this class).
   Sub-causes predicted: the model inserts an ellipsis to join non-contiguous spans
   (`"potent activator resveratrol ... lowers the Michaelis constant"`); light
   reformatting or re-casing; reordering a list.
2. **Alphanumeric identifiers parsed as numeric claims** (11 rejections were
   number-failures). `"5-HTTLPR"` contains `5`; `checkGrounding` treats it as a
   number to verify and fails when the source never writes it. Predicted to also
   affect `SIRT1`, `p53`, `Foxp3`, `PGC-1alpha`, `SARS-CoV-2`, `IL-6`.
3. **Spelled-out numbers.** Source says `"Thirty-six percent"`; value says `"36%"`.
   The digit is absent from the context, so it fails.

**Falsifiable predictions:**

- **P1.1** — **>50%** of the 29 rejections will adjudicate as false positives.
- **P1.2** — **At least one** rejection will adjudicate as a TRUE catch. (Already
  near-certain: the OSC card claims `"97% of originals"` and `97` appears nowhere in
  that abstract. Grounding caught a real fabrication. Any fix must keep catching it.)
- **P1.3** — Alphanumeric-identifier false positives will be **>=3** of the 11
  number-failures.

**What would falsify H1:** if most rejections turn out to be values the source
genuinely does not support, then grounding is working correctly, the 7/15 loss is
*extraction's* fault for producing unsupportable values, and Phase 2 should target
extraction instead. That is a live possibility and it would be a better finding.

## Hypothesis 2 — grounding's false-negative rate is low but non-zero

**Claim.** Grounding accepts some values it should not.

- **P2.1** — In a sample of accepted fields, the false-negative rate will be **<10%**.
- **P2.2** — Any false negatives found will be *unquantified paraphrase*: a value with
  no numbers, whose quote is real, but which overstates or re-interprets the quote.
  Numbers are checked; prose is only checked for quote-existence, so prose is where
  an unsupported claim can hide.

**Why this matters more than H1.** H1 is about cases the tool *loses*. H2 is about
claims the tool *asserts wrongly* — brand damage, not just missed accuracy. **A fix
that lowers the FP rate while raising the FN rate is a bad trade at any accuracy
gain.** Both rates get reported after the fix, not just the one that improved.

## Hypothesis 3 — the divergence test is why the prior always fires

**Claim.** `diverges = norm(av) !== norm(bv)` in `compare.mjs` registers every
paraphrase as full divergence, so `assay` is a candidate in essentially every pair,
so `DRIVER_RANK` — which ranks assay first — always fires.

**Evidence already in hand:** the assay string differs on ~90% of re-runs, yet the
top driver is stable; and the as-retrieved arm predicted assay **14/14 (100%)**,
*more* degenerate than the abstract arm's 13/15, because more text means more ways for
two strings to differ.

**Planned change:** replace the string inequality with graded token overlap
(Jaccard on normalised content tokens), with a threshold set **from the data's
structure, not tuned for score** — i.e. two values count as divergent only when they
share little content. Stays deterministic; no LLM judgment enters the ranker.

**Falsifiable predictions:**

- **P3.1** — Fixing divergence **alone**, without fixing grounding, will **not**
  meaningfully raise top-1 accuracy. Reason: 7/15 cases have had their labelled
  dimension deleted by grounding before ranking runs, so suppressing a spurious
  `assay` candidate merely promotes a *different wrong* dimension. Predicted top-1
  after divergence-only fix: **still within the 3.7-37.9% CI, and still not beating
  the baseline by more than 1-2 cases.**
- **P3.2** — Fixing divergence alone **will** reduce the share of `assay` predictions
  from 13/15 to **<10/15**.
- **P3.3** — The `treg` case (labelled `assay`, where both papers genuinely say "flow
  cytometry") is **at risk of flipping from hit to miss** under token overlap, because
  the two assay strings share real content. Losing a currently-correct case would be
  the honest cost of the fix, and it will be reported, not hidden.

**Ordering follows from P3.1:** grounding first, divergence second. If we did
divergence first and accuracy did not move, we would learn nothing about *why*.

---

## Success criteria — set in advance

Phase 2 is a **success** if:

- grounding's FP and FN rates are **measured and published**, whatever they are; and
- each change's effect is reported against the prediction above, hit or miss.

Phase 2 is **not** conditional on accuracy going up. If the fixes raise the ceiling
and accuracy still ties the baseline, that is a stronger finding than a number that
went up: it would say ranking-by-fixed-prior cannot work *even with clean inputs* —
which is the argument for the labelled-inference layer, and it would be earned rather
than assumed.

**The failure mode to avoid:** a Phase 2 that reports "13.3% -> 47%" with no mention
of how many looks it took to get there.

---

## Results

*(filled in as each pre-registered step completes — predictions above are not edited
after the fact)*

| Step | Prediction | Result | Verdict |
|---|---|---|---|
| P1.1 grounding FP rate | >50% of 29 are FPs | **26/29 = 89.7%** | **HIT** (and I under-predicted) |
| P1.2 true catch exists | >=1 | **2** (Lippman `~8800 per group`; Border `5-HTTLPR`) | **HIT — but my justification was WRONG** |
| P1.3 identifier-as-number FPs | >=3 of the 11 number-failures | **0** | **WRONG — and backwards** |
| P2.1 FN rate | <10% | **1/30 = 3.3%** (4.8% of non-vacuous) | **HIT** |
| P2.2 FNs are unquantified paraphrase | yes | **yes** — Berry hedge-drop | **HIT** |
| Fix 1-4 effect | FP rate 90% -> ~17%; FN unchanged | **FPs 26 -> 6 of 29 = 20.7%**; FN unchanged | **HIT** |
| Fix 1-4 ceiling | rises toward 12/15 = 80% | **33.3% -> 66.7%** (5/15 -> 10/15) | **PARTIAL** — right direction, short of 80% |
| Fix 1-4 top-1 | "not predicted to reach the ceiling" | **13.3% -> 13.3%, unchanged** | **HIT — emphatically** |
| P3.1 divergence alone | no real accuracy gain | **13.3% -> 13.3%, zero movement** | **HIT** |
| P3.2 assay share | drops below 10/15 | **13/15** | **WRONG** |
| P3.3 treg | at risk of flipping to miss | **still a hit; did not flip** | **WRONG** |

---

## THE ONE LOOK — result of fixes 1-4

```
                        before      after
rejections              29          8
  of which FALSE POS    26          6
  of which TRUE CATCH   2           2      <- both preserved
oracle ceiling          33.3%       66.7%   [5/15 -> 10/15]
no-conflict cases       5/15        2/15
Top-1 (strict)          13.3%       13.3%   <- UNCHANGED
Baseline                13.3%       13.3%
discordant pairs        0/15        0/15
accuracy among reachable 40% [2/5]  20% [2/10]
```

**The fixes did exactly what was predicted. The accuracy did not move at all.**

The ceiling **doubled**. The pipeline now detects a contradiction in 13/15 cases
instead of 10/15. The established cause is now an available candidate in **10 of 15**
cases instead of 5. And the ranker still scores **13.3%**, still ties "always guess
assay", still 0/15 discordant — because it now says `assay` **14/15** times.

Note the direction of *accuracy among reachable*: it **fell**, 40% -> 20%. That is not
a regression; it is the point. The denominator doubled while the numerator stayed at 2.
The ranker was handed the right answer in five more cases and took none of them.

### Why the ceiling stopped at 66.7% and not 80%

The 2 cases still lost to grounding are **exactly the two refusals pre-registered
above** — no more, no less:

- `hrt-timing-hypothesis` / timing — DERIVED ARITHMETIC (`"1976 to 1996 (20 years)"`).
  Refusing this is what preserves true catch #1: `1996-1976=20` and `35,533/4~8800` are
  the same operation.
- `selenium-baseline-status` / model — REWORDED. Refusing this is what preserves the
  verbatim guarantee, and what stops the Berry hedge-drop from scoring as a match.

Both losses were bought deliberately, and the receipt is `eval/normalize.test.mjs`,
which fails loudly if either true catch ever starts passing.

### What this settles

**The fixed prior does not work even with clean inputs.** This was the open question
after Phase 1 — the ranker might have looked useless only because grounding was
starving it. It wasn't. Given the right answer as an available candidate in 10/15
cases, `DRIVER_RANK` selects it in 2, because `assay` outranks everything and `assay`
always appears to diverge.

That is now a measured claim rather than an argument, and it is the strongest evidence
yet for the remaining question: whether ranking needs judgment a fixed prior cannot
supply. **Do not conclude that yet** — P3.2 says the divergence test is why `assay`
always appears to diverge, and that has not been tested. Fix that first, then re-ask.

---

## THE SECOND LOOK — divergence test (P3.2, P3.3 both WRONG)

Replaced `norm(av) !== norm(bv)` with Jaccard token overlap, threshold 0.5 (the
midpoint of the scale — never searched against the benchmark).

```
                  before      after
Top-1             13.3%       13.3%     <- P3.1 HIT: zero movement
assay share       14/15       13/15     <- P3.2 WRONG: predicted <10/15
treg              hit         hit       <- P3.3 WRONG: predicted at risk of flipping
oracle ceiling    66.7%       66.7%
```

**P3.2 was wrong, and the reason is instructive.** I assumed `assay` always diverges
because paraphrases produce different strings. Token overlap shows the assay values
genuinely *are* different content — "Clinical outcome scales (NIHSS, Barthel, Rankin)"
vs "Modified Rankin Scale assessment at 90 days" shares one token out of thirteen. Two
papers really do use somewhat different methods, every time. So `assay` legitimately
diverges in nearly every pair, and a fixed prior that ranks it first will fire in
nearly every pair. **The string inequality was not the cause. The prior is the cause.**

**P3.3 was wrong for the same reason.** I expected `treg` to flip to a miss because
both papers "say flow cytometry". They share exactly 2 tokens of 17 (Jaccard 0.12) —
the rest is fate-mapping vs bisulfite sequencing. The values are genuinely divergent;
my characterisation of them as near-identical was wrong.

### Unpredicted harm, caught by the look

Applying overlap to **every** dimension broke contradiction detection: undetected
conflicts went **2/15 -> 4/15**. `diverges` also drives `finding`, and:

```
"Mouse models POORLY mimic human inflammatory diseases"
"Mouse models GREATLY mimic human inflammatory diseases"
```

~0.7 Jaccard — maximal semantic opposition, minimal token difference. **Token overlap
is blind to antonyms.** Scoping the overlap test to design dimensions only, and
leaving `finding`/`limitations` on strict inequality, restored 2/15. That is a
principled distinction (a conclusion's *polarity* matters; a method list's *content*
matters), not a score tweak — the top-1 was 13.3% before and after.

### A bug the benchmark could never have found

`eval:selftest` failed on "timing surfaces when assay does not diverge". Cause:
content tokens were filtered at `length > 1`, which drops single digits — so
`"3 hours"` and `"6 hours"` both reduced to `{hours}`, scored similarity 1.0, and
stopped counting as divergent. That silently destroys `timing` and `dose`, and the
thrombolysis case *is* 3 h vs 6 h. A unit test caught what a 15-case accuracy number
never would have: top-1 was 13.3% with the bug and 13.3% without it.

---

## Phase 2 outcome

```
                 Phase 1     after grounding    after divergence
Top-1             13.3%          13.3%              13.3%
baseline          13.3%          13.3%              13.3%
discordant         0/15           0/15               0/15
oracle ceiling    33.3%          66.7%              66.7%
undetected confl.  5/15           2/15               2/15
assay share       13/15          14/15              13/15
```

**Honest accounting of looks.** The rule was "one look per fix". It took **four**:
(1) grounding fixes, (2) divergence as pre-registered, (3) divergence scoped to design
fields after it regressed, (4) after the digit-token bugfix. Looks 3 and 4 were
repairs of defects that look 2 exposed, not attempts to move the score.

**The mitigating fact: the number was 13.3% at every single look.** It never moved, so
there was nothing to tune toward and no opportunity to select a favourable variant.
Had it oscillated, this set would now be burned. It is intact — but the honest
description of the post-Phase-2 figure remains *"development-set accuracy after four
looks"*, not a blind measurement.

## Re-measured after the fixes (both stale numbers refreshed)

Two Phase-1 numbers were taken before the fixes and had to be re-run:

**Extraction variance (3 pairs x 5 runs), post-fix:** `0/3` pairs changed their top
driver, down from `1/3`. The extracted assay STRING is still unstable (mean 4.5
distinct values per 5 runs; 3 slots differ every run) — extraction is as noisy as
ever — but the graded divergence test now absorbs that noise: two papers share little
assay content however the methods are paraphrased, so `assay` diverges on every run and
the prior fires on every run. **The driver stability is real, and it is still the
stability of a prior that always picks assay because assay genuinely almost always
differs.** Stable and wrong. (The Phase-1 script text claiming a "string inequality"
was describing code that no longer exists; corrected.)

**As-retrieved arm, post-fix:** top-1 `21.4%` [3/14] vs baseline `14.3%` [2/14] — the
ranker appears to "beat" baseline for the first time. **This is one discordant case**
(`beta-carotene` -> `model`), on the secondary/confounded arm, with 3 asymmetric pairs,
and the harness's own guard applies: the CIs overlap almost entirely, so a 1-case gap
is unresolved, not an effect. It is a footnote, not a result: the divergence fix let a
non-assay cause win *once*. The headline remains the abstract arm, 13.3%, tied, 0/15
discordant.

## What Phase 2 established

1. **Grounding was broken, and fixing it doubled the ceiling** (33.3% -> 66.7%) at no
   cost to the false-negative rate, with both true catches preserved. The largest
   single cause was a retrieval bug — undecoded HTML entities — not a strictness
   policy.
2. **The ranker is not starving. It is wrong.** Handed the established cause as an
   available candidate in 10/15 cases, `DRIVER_RANK` selects it in 2.
3. **The string-inequality theory was wrong.** Assay values are genuinely divergent
   content, not paraphrases. Fixing the divergence test changed the score by nothing.
   The prior itself is the problem — there is no remaining mechanical excuse for it.
4. **A fixed prior over design dimensions cannot do this job.** Two independent fixes,
   a doubled ceiling, and four looks produced exactly zero movement against a constant
   guess. This is no longer an argument; it is a measurement.

**Phase 2 succeeded on its pre-registered criteria** — the FP/FN rates are measured and
published, and every prediction is reported hit or miss (3 hits, 2 wrong, 1 partial).
It did not raise accuracy, which was explicitly not the success condition.

## What this licenses for Phase 3

The `PLAN.md` option "an explicit, separated interpretation layer" is now the only
hypothesis left standing, and it has been *earned* rather than assumed: the
information is present (10/15 reachable), it is clean (grounding fixed), the
divergence test is fair, and a deterministic prior still cannot select it. Choosing
which of several real design differences explains a specific disagreement appears to
require judgment about *this pair*.

If that layer is built, the brand rule from `PLAN.md` holds absolutely: opt-in,
labelled as inference and not verified fact, never folded into the grounded evidence,
and **measured on this same benchmark against the 13.3% baseline** — which is now a
well-characterised control rather than a guess.

### P1.2 — right answer, wrong reason. Recorded in full.

I predicted at least one true catch and called it "already near-certain", citing the
OSC card's `"97% of originals"` as a fabrication because "97 appears nowhere in that
abstract".

**That was false.** The abstract reads *"**Ninety-seven percent** of original studies
had statistically significant results."* The number is spelled out. The value is an
accurate restatement of two consecutive sentences, and grounding rejected it because
it scans for digits only. It is a **false positive** — and it is the *same* example I
used to define the SPELLED_OUT_NUMBER false-positive category two paragraphs earlier.

The prediction survived only because two *genuine* true catches exist elsewhere, which
I had not identified:

- **Lippman / sampleSize** — value `"35,533 men total, ~8800 per group"`. `8800` and
  `"per group"` appear nowhere; the model divided 35,533 by 4 and invented the framing.
- **Border / finding** — value `"No evidence 5-HTTLPR moderates..."`. That abstract
  never names 5-HTTLPR (it says "18 candidate genes"). The term was imported from the
  eval's own *question* text.

**The error mattered.** That claim was published in `eval/README.md`, printed by
`eval:diagnose`, and used as the central argument against loosening grounding. The
argument survives on the two real catches, but the flagship evidence for it was wrong.
The same digit-only scan that produced the false positive produced my description of it.

### P1.3 — wrong, and exactly inverted

I predicted >=3 false positives from alphanumeric identifiers (`5-HTTLPR`, `p53`,
`SIRT1`) being parsed as numeric claims. **Actual: zero.** Worse, the one rejection
that *did* fire on an identifier parse (Border, `5-HTTLPR` -> digit `5`) was a **true
catch**. An allowlist for gene names — the fix I was heading toward — would have
fixed nothing and let a genuinely unsupported value through.

### The cause I did not predict at all

**38% of all false positives (10/26) are one bug, and it is not in grounding.**
`src/ncbi.mjs` strips XML tags but never decodes HTML entities, so `sourceText` stores
`2&#xa0;h post infection`, `&#x2265;`, `&#xd7;`, `&gt;`, `&#xf2;`. The model reads that
text and sensibly writes the quote decoded (`2 h post infection`); the substring check
then fails against the encoded source. The whole ivermectin case (5 of 6 fields) died
to a non-breaking space.

Grounding is not too strict. **It is being fed corrupted text and correctly refusing
to verify against it.** This is a retrieval bug wearing a trust-layer costume — the
same shape as the Phase 1 finding that vitamin E was "a statistics dispute wearing a
dose costume".

---

## Measured, before any fix

| | |
|---|---|
| fields asserting a value | 372 |
| rejected by grounding | 29 |
| **false positives** | **26 / 29 = 89.7%** |
| true catches | 2 / 29 = 6.9% |
| borderline | 1 / 29 = 3.4% |
| **false negatives** | **1 / 30 sampled = 3.3%** |

**False-positive causes:**

| Cause | n | Share | Safe to fix? |
|---|---|---|---|
| UNIT_OR_FORMAT (10 of these are HTML entities) | 11 | 42% | **Yes — zero FN risk** |
| SPELLED_OUT_NUMBER | 6 | 23% | Yes, with a closed lexicon + adjacency guard |
| ELLIPSIS | 4 | 15% | Only with guards (ordered fragments, max gap, min length) |
| REWORDED | 3 | 12% | **No — fix extraction instead** |
| OTHER (derived arithmetic, count shorthand) | 2 | 8% | **No — would destroy true catch #1** |
| IDENTIFIER_AS_NUMBER | 0 | 0% | n/a — predicted, does not exist |

## The fix plan the measurement supports

Pre-registered before implementation, in this order:

1. **Decode HTML entities + NFC-normalise in `src/ncbi.mjs`.** ~40% of FPs, zero FN
   risk (post-decode the strings are identical; no new semantic surface).
2. **Strip thousands separators before numeric comparison.** 1 FP. Must NOT normalise
   decimal points — `16.608` must never match `16608`.
3. **Spelled-out numbers via a closed lexicon** (zero-ninety-nine, hundred/thousand/
   million), requiring adjacency to a unit/`percent`/noun so that bare articles
   ("*a* single addition", "*one* or two copies") are not read as the numeral 1.
4. **Guarded ellipsis:** split on `...`, require every fragment to be a literal
   substring **in source order**, with a max gap (~200 chars) and min fragment length
   (>=25 chars). Unguarded, this is the next false negative — the Howitz quote already
   spans SIRT1 (human) and Sir2 (yeast) machinery.

**Explicitly NOT doing**, despite the FP cost:

- **Fuzzy/semantic quote matching** (3 FPs). Abandons the verbatim guarantee, which is
  the only reason the `quote` field exists — and would score the Berry hedge-drop
  ("unlikely to affect" -> "does not affect") as a near-perfect match. That is the one
  confirmed false negative. Fix at extraction: all 3 cases are the model *retyping* a
  span from memory instead of copying it.
- **Derived arithmetic** (1 FP). `1996 - 1976 = 20` and `35,533 / 4 ~ 8800` are the
  same operation, and the second is true catch #1. No rule admits one and excludes the
  other. Cost of not fixing: 1 FP. Worth it.
- **Identifier allowlist.** Predicted, measured at zero, would break a true catch.

**Predicted effect of fixes 1-4** (pre-registered): FP rate falls from **90% to
~17%** (21 of 26 recovered), FN rate **unchanged at 3.3%**. Ceiling should rise from
33.3% toward the 12/15 = 80% that raw extraction already reaches. Top-1 accuracy is
**not** predicted to reach that — the ranker still has to choose correctly, and P3.1
says it won't.

## The gap no loosening will close

Grounding is **structurally blind to prose overstatement.** A value with no numbers and
a real quote passes unconditionally, so hedge-dropping is invisible: 3 hedge/
interpretation slips across 59 adjudicated fields (Berry confirmed; Miller near-miss;
beta-carotene editorial). Every fix above makes this marginally worse and none makes it
better. Catching it needs a different check — entailment of `value` from `quote` — not
a looser substring test. Out of scope for Phase 2; recorded so it is not forgotten.

## Known defect in the audit itself

The accepted-field sample was **30% padding**: 9 of 30 entries were vacuous
(`not reported - nothing to verify` on non-dimension keys `pmid`/`citation`/
`sourceDepth`, which `audit-grounding.mjs` iterated by mistake). They inflate the
denominator and test nothing. The 3.3% FN rate is therefore better read as **1/21 =
4.8%** over fields that actually assert something. Fixed in the script; the corrected
figure is the one to quote.
