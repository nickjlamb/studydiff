StudyDiff held-out benchmark — pre-registration
===============================================

**Registered 2026-08-27, before any candidate was selected and before any extraction was run.**
Nothing below was written after seeing a held-out score, because no held-out score exists yet.

This document is committed deliberately. A held-out number is only worth the discipline that
produced it, and that discipline has to be inspectable — otherwise "we pre-registered it" is
itself an unsourced claim, which is the exact failure mode this project exists to avoid.

Why this set exists
-------------------
`eval/cases.json` (15 documented contradictions) was built blind and did its job: it killed the
driver ranking (top-1 13.3% [2/15], identical to always guessing `assay`) and, after the Phase 2
grounding fixes, raised the oracle ceiling from 33% to 67%.

But those 15 cases have now been read across two phases — failures analysed, spans re-audited.
Every post-fix figure is therefore **development-set** accuracy. A held-out set, curated to fixed
criteria and measured **once**, is the only way back to a blind number.

1. What is fixed before curation
--------------------------------
* **n = 15**, mirroring the dev set so the two numbers are directly comparable. Not a target to
  hit by relaxing standards: if fewer than 15 contradictions clear the provenance bar, the set
  ships smaller and says so. Cases are never added after scoring.
* **Primary metric:** strict top-1 accuracy of the retired driver prior, reported with its Wilson
  interval and the always-guess-`assay` baseline beside it — identical treatment to the dev set.
* **Secondary, reported alongside:** lenient accuracy, oracle ceiling (reachability), accuracy
  among reachable.
* **Depth arm:** `abstract` (primary, matching the dev set's pre-registered arm). All
  `causeVisibleInSource` judgements are made against abstracts, so the ceiling is only meaningful
  against abstracts.
* **The number is reported as-is, once.** Including if it is worse than the dev set. A held-out
  number below 13.3% is a legitimate result about extraction difficulty, not a regression to
  paper over.

2. Selection criteria (structural only)
---------------------------------------
A contradiction is eligible if and only if:

a. **Two papers, published, both indexed in PubMed, both answering the same biological question**
   with conclusions that genuinely conflict in direction or magnitude.
b. **The reason they disagree is documented by a third source** — a review, pooled analysis,
   reanalysis, commentary or replication study — with a PMID, containing a verbatim sentence that
   establishes the cause. *No label without a source.*
c. **The established cause maps to exactly one primary design dimension** from `SCORED_DIMENSIONS`
   (assay, model, intervention, dose, timing, endpoint, species, sampleSize, statistic). `finding`
   and `limitations` are not design dimensions and cannot be labels.
d. **No overlap with the dev set** — none of its 15 contradictions and none of its papers.
e. **Not a fraud or data-fabrication case.** Fabrication is not a design dimension; such a pair
   would be unlabelable under (c) and would measure nothing about extraction.

Explicitly **not** a criterion: whether StudyDiff is expected to get the case right. Selection
reasoning of the form "this one will pass because…" is contamination. If it occurs, the case is
dropped and the reasoning recorded here.

3. Composition constraints (fixed in advance)
---------------------------------------------
* `assay` labels ≤ 1/3 of the set (≤ 5 of 15) — enforced by `selftest`, so the set can distinguish
  the tool from a constant guess.
* ≥ 4 distinct dimensions represented; aiming wider, since the dev set's own distribution is not
  a target to imitate.
* **`causeVisibleInSource` assessed honestly, `no` and `partial` included and kept.** Cases whose
  cause appears in neither abstract are unwinnable by construction and are part of the headline —
  they are the basis of the oracle ceiling. A held-out set with zero `no`/`partial` cases is
  evidence that selection drifted toward easy wins, and would be rebuilt.
* Domain mix deliberately widened beyond the dev set's supplement/clinical-trial weighting.

4. The no-tuning rule
---------------------
* Nothing in `src/` — prompts, thresholds, schema, matching — is changed because of the held-out
  number. Improvements are developed and measured on the dev set, and only then confirmed **once**
  against held-out data.
* The two sets are reported **separately, always**. They are never summed into an "n=30" figure;
  pooling would relaunder the dev set as blind data.
* `npm run eval` (dev set) must continue to print 13.3% [2/15]. If it moves, the sets have bled
  into each other and that is fixed before any held-out number is believed.
* Curation was performed without reading `eval/README.md` or `eval/PHASE2.md` beyond method and
  schema — both carry per-case dev-set pass/fail and a failure taxonomy. Knowing where the current
  system fails is precisely what a curator must not know.

5. Implementation shape (decided in advance)
--------------------------------------------
**A parallel file, `eval/cases-heldout.json`, selected by `--set heldout`.** Chosen over a
`split:` field inside one file because separation should be structural rather than remembered: a
distinct file and a distinct cache key make it impossible to pool the two sets by accident, and
the held-out result is visibly its own artifact. The `split:` alternative needs every reporting
path to filter correctly and stay filtered — a discipline that survives only as long as no one
forgets it.

6. What would invalidate this set
---------------------------------
Recorded now, so it cannot be rationalised later:

* Any `src/` change made because the held-out number was disappointing.
* Any case added, removed or relabelled after the set was scored.
* A second fetch of the same arm after seeing the first result.
* Reporting a pooled n=30 figure anywhere.

If any of these happens, the set is a second development set and must be described as one.
