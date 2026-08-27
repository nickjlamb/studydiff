Held-out set — candidate shortlist (awaiting sign-off)
======================================================

Status: **not yet built**. Every PMID below was retrieved from PubMed and every title is as
PubMed returned it. Verbatim spans have been collected but not yet finalised into the schema —
that happens after sign-off, followed by an independent adversarial re-verification pass.

Selection was made on structure alone: a documented contradiction, an adjudicating source with a
PMID and a quotable establishing sentence, and a cause that maps to one design dimension. No case
was chosen or rejected on any expectation of how StudyDiff would score it.

The 15
------

| # | id | dimension | papers (PMIDs) | adjudicator | visible | confidence |
|---|----|-----------|----------------|-------------|---------|------------|
| 1 | hydroxychloroquine-cell-line | model | 32150618 / 33031652 | 32698190 Hoffmann 2020 Nature | partial | established |
| 2 | placenta-microbiome-controls | assay | 24848255 / 31367035 | 27338728 Lauder 2016 Microbiome | partial | established |
| 3 | obesity-microbiome-power | sampleSize | 17183309 / 19498350 | 27555308 Sze & Schloss 2016 mBio | partial | established |
| 4 | omega3-placebo-comparator | intervention | 30415628 / 33190147 | 34455435 Doi 2021 Eur Heart J | partial | contested |
| 5 | hypothermia-control-temperature | intervention | 11856793 / 24237006 | 22520518 Nielsen 2012 Am Heart J | partial | established |
| 6 | remdesivir-endpoint-choice | endpoint | 32445440 / 33264556 | 34259182 Bose 2021 Lung India | yes | contested |
| 7 | ocean-acidification-fish-behaviour | sampleSize | 19188596 / 31915382 | 35113875 Clements 2022 PLoS Biol | no | contested |
| 8 | glycaemic-control-nutrition | intervention | 11794168 / 19318384 | 20018803 Marik & Preiser 2010 Chest | no | contested |
| 9 | tumour-microbiome-pipeline | statistic | 32214244 / 37811944 | 37555750 Gihawi 2023 Microb Genom | partial | established |
| 10 | thalidomide-species-sensitivity | species | 594913 / 14207455 | 26903378 Kazuki 2016 Sci Rep | yes | established |
| 11 | aflatoxin-species-susceptibility | species | 24662598 / 15019083 | 8042848 Eaton & Gallagher 1994 | partial | established |
| 12 | convalescent-plasma-timing | timing | 33406353 / 34000257 | 36809473 Levine 2023 Clin Infect Dis | yes | contested |
| 13 | sodium-measurement-method | assay | 25119607 / 24415713 | 31352828 He 2019 Hypertension | yes | contested |
| 14 | ego-depletion-replication | sampleSize | 9599441 / 27474142 | 25126083 Carter 2014 Front Psychol | partial | established |
| 15 | vitamin-c-route-exposure | dose | 279931 / 384241 | 15068981 Padayatty 2004 Ann Intern Med | no | contested |

Composition against the pre-registered constraints
--------------------------------------------------
* **9 distinct dimensions** (assay, model, intervention, dose, timing, endpoint, species,
  sampleSize, statistic) — every dimension the scorer can emit is represented. Constraint: ≥4.
* **assay = 2/15 (13.3%)** — constraint: ≤ 1/3.
* **Visibility: 4 `yes` · 8 `partial` · 3 `no`.** A priori ceiling ≤ 80%. The three `no` cases are
  kept deliberately; they are the basis of the ceiling and excluding them would flatter the number.
* **Confidence: 8 established · 7 contested.** Higher contested share than the dev set. This is a
  real property of the material, not a shortcut: for many modern contradictions the adjudicating
  literature offers a leading explanation that the original authors still dispute. Contested cases
  score identically; the flag exists so the number can be subset honestly.
* **No dev-set paper or contradiction reused.** Checked against all 15 dev ids.

Twenty candidates were verified; five were dropped
--------------------------------------------------
Recorded because what failed is part of the method:

* **cell-line-pharmacogenomics** (CCLE vs GDSC drug-response discordance) — dropped: no adjudicator
  abstract establishes the assay explanation. The closest, Hatzis 2014, hedges it as "possibly due
  to differences in the experimental protocols"; the Safikhani re-analyses argue the discordance is
  *real*, not a metric artefact. Labelling it would have meant sourcing a cause the literature has
  not settled.
* **crispr-off-target-genetic-background** (Schaefer 2017 vs Iyer 2018) — dropped: Schaefer has no
  PubMed abstract at all, and all five rebuttal Correspondences are likewise abstract-less. The only
  abstract stating the cause is Iyer's own, which would be circular.
* **bevacizumab-breast-endpoint** — dropped: E2100 and RIBBON-1 do not actually contradict each
  other. Both report a PFS gain and no OS gain; the discordance is *internal* to each paper. Not a
  contradiction pair.
* **egdt-usual-care-comparator** (Rivers 2001 vs ProCESS 2014) — dropped: neither proposed
  adjudicator states the comparator-drift cause in its abstract, and PRISM's hospital-propensity
  subgroup result argues against it. The only source that does state it is Rivers-coauthored.
* **neonicotinoid-field-realistic-dose** — dropped as primary: the natural adjudicator (Carreck &
  Ratnieks 2014) is not indexed in PubMed, and the indexed substitute establishes the lab/field dose
  pattern generically without naming either paper. Held as a reserve.

Also dropped at the paper level, then rescued by substitution:
* Wang 2020 Cell Res and Liu 2020 Cell Discov (both chloroquine in vitro) have **no PubMed
  abstracts** — case 1 uses Yao 2020 Clin Infect Dis instead, whose abstract names the Vero cell
  system verbatim.
* The 1960s thalidomide literature (Somers, Lenz, Fratta) has no abstracts and McBride 1961 is not
  indexed — case 10 uses Scott 1977 (failure to reproduce in rats and mice) against Delahunt 1964
  (thalidomide syndrome in monkeys).

Known weaknesses, stated rather than buried
-------------------------------------------
1. **Case 5 (hypothermia)** — the adjudicator is the TTM trial's own rationale-and-design paper, not
   an independent review. It states the control-arm difference plainly ("did not treat hyperthermia
   in the control groups") but it is the trialists' own framing. An independent 2022 systematic
   review (36434649) corroborates the "32-34 °C compared with fever prevention" contrast and can be
   carried as a second citation.
2. **Case 6 (remdesivir)** — the endpoint account is one of several explanations, and Solidarity's
   own abstract reports no benefit on hospitalisation duration either, which cuts against a pure
   endpoint story. Proposed handling: label `endpoint`, `alsoAcceptable: ["timing"]`, confidence
   contested, with the tension recorded in the note.
3. **Case 15 (vitamin C)** — the weakest. The route/exposure cause is invisible in both abstracts,
   which both state the same 10 g/day dose, so a reader of the abstracts would conclude the studies
   tested identical exposure. Worse, Cameron & Pauling used matched historical controls against
   Creagan's randomised double-blind design — a confound fully sufficient on its own. Proposed
   handling: label `dose`, `alsoAcceptable: ["statistic", "model"]`, confidence contested,
   visibility `no`, confound stated in the note. **Alternative:** swap in the neonicotinoid case to
   keep the `dose` slot, accepting a generic adjudicator instead of a confounded pair. Both options
   are weak in different places; one dimension would be lost if neither is used.
4. **Case 9 (tumour microbiome)** — paper A was retracted by Nature in 2024. Included because the
   retraction followed from the analytical error the case is labelled on, which is a design cause,
   not fabrication. Flagging it because the protocol excludes fraud cases and the line is worth
   Nick's eye.
5. **Case 14 (ego depletion)** — the replication used the Sripada letter-crossing paradigm rather
   than Baumeister's radish/emotion-suppression tasks, so paradigm change competes with sample size.
   Stated verbatim in the replication's abstract, so it is recoverable; proposed
   `alsoAcceptable: ["intervention"]`.

Reserves, if any of the 15 is rejected
--------------------------------------
* **steroids-septic-shock-cointervention** (ADRENAL 29347874 vs APROCCHSS 29490185; adjudicator
  30851043) — intervention. Held back because the adjudicator's attribution is mixed across regimen
  and baseline severity, and calls the fludrocortisone contribution "unclear".
* **neonicotinoid-field-realistic-dose** (22461500 / 17598537; adjudicator 22350105) — dose, generic
  adjudicator as described above.

Post-audit changes (applied after sign-off, before any fetch)
-------------------------------------------------------------
An adversarial verification pass over the built `cases-heldout.json` re-fetched all 45 abstracts and
checked every span character-by-character. All 45 spans held. Sixteen defects in the interpretive
fields were corrected; the full list lives in `eval/cases-heldout.json` > provenance >
verificationHistory, and the reviewed change log was delivered as a Word document.

Two changes alter the table above:

* **tumour-microbiome-pipeline** is now labelled `assay` (was `statistic`), because its adjudicating
  sentence is an unranked four-item list naming contamination first, and paper B's own re-analysis
  finding is misclassified reads. `statistic` becomes alsoAcceptable — and, since this was the only
  `statistic` case, the set now carries eight primary dimensions rather than nine. Correcting a label
  to match its source was preferred over preserving coverage.
* **thalidomide-species-sensitivity** visibility is now `partial` (was `yes`), graded on the same test
  as the sibling aflatoxin case. The a priori ceiling is unchanged at 80%.

Final composition: assay 3 · sampleSize 3 · intervention 3 · species 2 · model 1 · endpoint 1 ·
timing 1 · dose 1. Visibility 3 yes / 9 partial / 3 no. Confidence 8 established / 7 contested.
