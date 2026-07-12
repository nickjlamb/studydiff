# StudyDiff — 3-Minute Demo Video Script

**Runtime target:** ~180s · **Record on:** `https://studydiff.pharmatools.ai` (prod) · **Example:** cached "Treg lineage stability" chip (instant, reliable, no API cost)

**Tone note:** Honesty is the product. Nothing in the voiceover claims a winner, a confidence score, or that anything is verified unless it traces to a verbatim quote. Lean on the real signals: ranked drivers, "ruled out," "0 invented," "not reported — never guessed," deterministic re-runs.

---

## Storyboard at a glance

| # | Beat | Time | On screen |
|---|------|------|-----------|
| 1 | Hook / problem | 0:00–0:20 | Two paper title cards side by side; opposite conclusions highlighted |
| 2 | Input | 0:20–0:40 | StudyDiff landing (hero + "Why trust this" rail); click the Treg example chip; 5-step pipeline lights up |
| 3 | The answer | 0:40–1:35 | "Why these studies differ" card — verdict → most likely reason → each conclusion |
| 4 | Trust moment | 1:35–2:15 | Expand a field to reveal verbatim quote + ✓; verification tiles in right rail |
| 5 | Depth | 2:15–2:40 | Ranked drivers, "What would resolve this?", full comparison, export |
| 6 | Claude + close | 2:40–3:00 | Five-step pipeline recap; tagline |

---

## Beat 1 — Hook / problem (0:00–0:20)

**On screen:** `demo/hook-card.html` — two paper **titles** side by side, nothing else. Reading order is left → right, and the VO follows it:

> **Study A** (teal, left) — Zhou et al. 2009, *Nat Immunol* — **Instability** of the transcription factor Foxp3 leads to the generation of pathogenic memory T cells *in vivo*
> **Study B** (purple, right) — Rubtsov et al. 2010, *Science* — **Stability** of the regulatory T cell lineage *in vivo*

Three clicks, driven live to match the narration: card plain → **click 1** highlights *Instability* / *Stability* → **click 2** drops in "Same question. Opposite conclusions."

**Voiceover:**
> You're a bench scientist planning an experiment. You find two credible, peer-reviewed papers on regulatory T cells — from two of the best labs in the field — and they reach opposite conclusions.
> *[click 1 — highlights land]* One finds the T-reg lineage is **unstable**: cells lose Foxp3 and turn pathogenic. The other finds it's **stable**.
> *[click 2 — framing line]* Same question. Opposite answers. Before you commit reagents and months of work, you need to know: *why* do they disagree?

**Note:** titles only — nobody reads a paragraph of abstract in twenty seconds, but *Instability / Stability* lands in two. Save the abstract text for Beat 4, where it's the receipt rather than the hook. Read A before B so the VO tracks the eye across the screen; don't describe the stable paper first while the viewer is looking at the unstable one.

---

## Beat 2 — Input (0:20–0:40)

**On screen:** The StudyDiff landing screen. Let the hero sit for a beat — headline *"Why do these two studies disagree?"* and subhead *"The difference is usually in the methods. StudyDiff finds it."* The **"Why trust this"** rail is visible from the start (Every claim verified · No LLM-as-judge · Source-first · Honest by design). Cursor clicks the **"Treg lineage stability"** example chip. The five-step pipeline lights up: **Add studies → Extract evidence → Verify claims → Compare → Explain why.**

**Voiceover:**
> Here's the premise, and it's right on the page: the difference is usually in the methods — StudyDiff finds it. Two well-run papers often disagree not because one is wrong, but because of a design choice buried in the methods section. Drop in two papers, or start from a worked example, and StudyDiff runs five steps: extract each study's design, verify every claim against the source, compare, and explain why.

---

## Beat 3 — The answer (0:40–1:35)

**On screen:** The **"Why these studies differ"** card fills the main column. Read top to bottom: the verdict line ("These studies reach different conclusions"), then **Most likely reason** with a Study A line (teal) and a Study B line (purple), then **Their conclusions** — each study's finding. The subtle caption at the foot: "✓ Every claim above is verified against the source."

**Voiceover:**
> Here's the answer. Same question, opposite conclusions — and StudyDiff points to the most likely reason: the two labs used different **fate-mapping methods** to track whether Treg cells kept their identity over time. That methodological choice, buried in the methods section, is what most plausibly drives the disagreement. Not that one lab was wrong — that they measured the same thing two different ways.

---

## Beat 4 — Trust moment (1:35–2:15)

**On screen:** Expand the **Main finding** field in the study-by-study comparison to reveal the **verbatim quote** from each source with a green **✓**. These are the exact sentences on screen — highlight *these*, not any other copy of the abstract:

> A (Zhou): *"a substantial percentage of cells had transient or unstable expression of the transcription factor Foxp3"*
> B (Rubtsov): *"we have demonstrated notable stability of this cell population under physiologic and inflammatory conditions"*

Then pan to the right rail's **Verification** tiles: *N claims verified against the source · M fields not reported · 0 invented*, and the line "Deterministic — no LLM-as-judge. Re-run and you get identical drivers."

**⚠ Source-text discipline:** any abstract text shown on screen must be the **final published version** (as in `fixtures/treg-stability.json` / PubMed) — *not* the PMC author-manuscript wording, which differs ("remarkable" vs "notable", "significant…exhibited" vs "substantial…had"). If the highlighted sentence doesn't match the quote beside the ✓, the one claim the whole product rests on looks broken.

**Voiceover:**
> This is the part that matters. Every field traces back to a verbatim quote from the paper — you can see the exact sentence, checked with a green tick. The grounding step is deterministic: it's not a language model grading itself. Every quote has to be a real substring of the source; every number has to trace back. If a paper doesn't report something, StudyDiff says "not reported" — it never guesses. Zero invented claims. Run it again, you get the same drivers.

---

## Beat 5 — Depth (2:15–2:40)

**On screen:** Scroll the ranked drivers — **Primary driver** (dominant), **Also differs**, **Ruled out** (identical in both → not the cause). Open **"What would resolve this?"**, then the **Full study-by-study comparison**. Click **Export** → Markdown/PDF.

**Voiceover:**
> Underneath, drivers are ranked: the primary one, others that also differ, and the factors that are *identical* in both papers — ruled out, so you know they're not the cause. It suggests what evidence would actually resolve the conflict, shows the full dimension-by-dimension comparison, and exports the whole thing as a report you can take to your team.

---

## Beat 6 — Claude + close (2:40–3:00)

**On screen:** The five-step pipeline recaps. Closing card with the tagline.

**Voiceover:**
> Under the hood: Claude turns each paper into a structured study card through forced tool-use, returning a verbatim quote for every field. A deterministic grounding check verifies it. Then StudyDiff compares only the evidence that passed. The result isn't a summary — it's an explanation of *why* two papers conflict, grounded in the text, and it never picks a winner. That's StudyDiff.

---

## Recording checklist

- Record against **prod** with the cached **Treg** chip — instant, no live wait, no API cost.
- Have the **Mouse models & inflammation** example (Seok 2013 vs Takao 2015) ready as a backup "same data, opposite conclusions" beat if you want a second example.
- Keep cursor movements deliberate at the trust moment (Beat 4) — the verbatim quote + ✓ is the differentiator; let it breathe.
- Do not add any on-screen text implying a confidence percentage, a winner, or a driver-strength bar. If a lower-third is needed, use the honest signals only.
