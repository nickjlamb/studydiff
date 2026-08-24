# StudyDiff — 3-Minute Demo Video Script

> **Historical — July 2026.** This is the script for the hackathon submission video, kept
> as a record of what was recorded. **It is out of date on one substantive point:** Beats 3
> and 4 narrate a "most likely driver" and a "primary driver", because at the time
> StudyDiff ranked the divergent dimensions and nominated the top one.
>
> That ranking has since been benchmarked against 15 documented contradictions and
> [retired](https://github.com/nickjlamb/studydiff#does-it-work-a-measured-answer) — it
> scored 13.3%, identical to always guessing "assay". The app now presents the divergent
> dimensions unranked. Any future recording should drop the primary-driver framing and
> lead with the evidence instead: what differs, what's ruled out, and the sentence behind
> every value.

**Runtime:** ~180s (VO ≈ 2m10s–2m30s spoken, leaving headroom for pauses and the live pipeline run)
**Record on:** `https://studydiff.pharmatools.ai` · **Papers:** Zhou 2009 vs Rubtsov 2010, uploaded as PDFs (final journal versions)

**Shape:** one continuous downward scroll. Hook → run the pipeline → the answer → what's driving it → the receipt → close. The camera never travels back up the page.

**Tone:** honesty is the product. No confidence scores, no winner, nothing called verified that isn't traced to a verbatim quote.

---

## Storyboard at a glance

| # | Beat | Time | On screen |
|---|------|------|-----------|
| 1 | Hook | 0:00–0:25 | `demo/hook-card.html` — two titles, *Instability* vs *Stability* |
| 2 | Run it | 0:25–0:50 | StudyDiff landing → drop both PDFs → 5 steps run live |
| 3 | The answer | 0:50–1:20 | "Why these studies differ" card |
| 4 | What's driving it | 1:20–1:50 | Ranked drivers: primary · also differs · ruled out · what would resolve this |
| 5 | The receipt | 1:50–2:35 | Full comparison — verbatim quotes + ✓ · verification tiles · export |
| 6 | Close | 2:35–3:00 | Pipeline recap; tagline |

---

## Beat 1 — Hook (0:00–0:25)

**On screen:** `demo/hook-card.html`. Two titles, left to right; the VO follows the eye. Study A (teal) = Zhou = **Instability**. Study B (purple) = Rubtsov = **Stability**.

**Voiceover:**
> You're a bench scientist planning an experiment. You find two papers from leading labs. They ask the same question about regulatory T cells, but reach opposite conclusions.
> *[click 1 — highlights land]* One says the T-reg lineage is unstable. The other says it's stable.
> *[click 2 — framing line]* Before you spend months in the lab, you need to answer one question: **why do these studies disagree?**
> That's what StudyDiff does.

---

## Beat 2 — Run it (0:25–0:50)

**On screen:** Switch tabs to StudyDiff. Hero sits for a beat — *"The difference is usually in the methods. StudyDiff finds it."* — with the **Why trust this** rail already visible. Drop both PDFs on the drop zone. The five steps run **live**: Add studies → Extract evidence → Verify claims → Compare → Explain why.

**Voiceover:**
> Just drop in the two PDFs. Claude reads each paper and fills a fixed schema — a quote required for every field — turning it into a structured study card where every extracted finding is linked to a verbatim quote from the source.
> Before anything is compared, a deterministic grounding check verifies every quote against the original paper.

**Note:** don't cut the wait — it's your only on-screen proof Claude is doing real work, and this paragraph is ≈18s of speech against a ≈11s run. Make sure the cache is cold (push a commit to restart the dyno) or the tracker will snap straight to done.

---

## Beat 3 — The answer (0:50–1:20)

**On screen:** The **"Why these studies differ"** card. Verdict → **Most likely reason** (Study A teal / Study B purple) → **Their conclusions**. Caption at the foot: *"✓ Every claim above is verified against the source."*

**Voiceover:**
> Here's the result.
> StudyDiff identifies the most likely driver of the disagreement: the two studies used different **fate-mapping methods** to track whether T-reg cells retained their identity over time.
> The difference isn't that one lab was wrong. It's that they measured the same biological question in different ways — and the methodology changed the conclusion.

---

## Beat 4 — What's driving it (1:20–1:50)

**On screen:** Scroll to **"What's driving the difference."** Ranked: **Primary driver** (dominant), **Also differs**, **Ruled out (identical in both)**. Then open **"What would resolve this?"**

**Voiceover:**
> Below that, StudyDiff ranks the evidence. It highlights the primary methodological difference, shows the factors that also differ, and rules out variables that are identical across both studies — so you can focus on what actually explains the disagreement.
> It even suggests what evidence would resolve it: apply both fate-mapping methods to the same experimental system, and see whether the difference remains.

---

## Beat 5 — The receipt (1:50–2:35)

**On screen:** Open **Full study-by-study comparison**. Every value shows its **supporting sentence in full**, in a quote block beside a green **✓ verified** — teal A, purple B. Land on **Main finding**. These are the exact sentences displayed:

> A (Zhou): *"a substantial percentage of cells had transient or unstable expression of the transcription factor Foxp3"*
> B (Rubtsov): *"we have demonstrated notable stability of this cell population under physiologic and inflammatory conditions"*

Scroll past the **not reported** rows. Then the right rail: **Verification** tiles (*N verified · M not reported · **0 invented***) and *"Deterministic — no LLM-as-judge."* Finish on **Export**.

**Voiceover:**
> But the most important part is trust.
> Every finding links back to the exact sentence it came from. Not a paraphrase. The original sentence.
> Verification is deterministic: every quote must exist as an exact substring of the paper. This isn't a language model grading its own homework.
> If a paper doesn't report something, StudyDiff simply says "not reported." It never fills in the gaps. **Zero invented claims.**
> Same evidence in, same drivers out — no randomness, no model grading another model. Then export the report and take it straight into your lab meeting.

**⚠ Source-text discipline:** any abstract text you highlight on screen must be the **final published wording** — not the PMC author-manuscript version, which differs ("notable" vs "remarkable"). If a highlight doesn't match the quote beside the ✓, the one claim the product rests on looks broken.

---

## Beat 6 — Close (2:35–3:00)

**On screen:** Pipeline recap; closing card.

**Voiceover:**
> Claude structures the evidence. Deterministic verification checks every claim. StudyDiff compares only what survives.
> It never tells scientists which paper is right. It helps them understand why the papers reached different conclusions.
> Most AI tools summarize papers. StudyDiff explains why they disagree.

---

## Recording checklist

- **One continuous take.** Start on the hook card tab, switch to StudyDiff, scroll straight down. No splicing — Screen Studio can't append takes.
- **Record silent, add VO after** via imported audio. Screen Studio can't record voiceover in the editor.
- **Cold cache**: push a commit (restarts the dyno) so the five steps actually animate. Don't rehearse the same PDFs on prod right before the keeper take.
- **Pronunciation**: T-reg (*tee-reg*, never "treg") · Foxp3 (*fox-pee-three*) · Rubtsov (*ROOB-tsov*) · Zhou (*joe*) · *in vivo* (*in VEE-voh*).
- **Never** put a confidence score, a percentage, a driver-strength bar, or a "winner" on screen. The honest signals carry it.
- **Don't say** "run it again tomorrow and you'll get the same answer" — the extraction is an LLM call and the cache expires after 6 hours. Determinism is scoped to grounding, ranking and comparison. Say *"same evidence in, same drivers out."*
