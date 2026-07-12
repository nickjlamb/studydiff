# StudyDiff — Submission Summary

*Built with Claude: Life Sciences hackathon · Builder track*

## Description (100–200 words)

Two well-run papers often disagree — not because one is wrong, but because of a methodological difference buried in the methods. StudyDiff is a contradiction explorer for bench scientists: give it two papers and it explains why they reach different conclusions, grounding every claim in the source text.

Claude (`claude-sonnet-5`), through forced tool-use, turns each paper into a fixed study-card schema, returning a verbatim supporting quote for every field. A deterministic OpenGATE grounding check then verifies it — every quote must be a real substring of the source, and every number must trace back. No LLM-as-judge. Ungrounded fields are downgraded to "not reported" before they can be cited. StudyDiff compares only the verified evidence, ranks the design dimensions that most plausibly drive the disagreement, and suggests what evidence would resolve it.

It never invents a confidence score, never picks a winner, and never guesses — if a paper doesn't report something, it says so. Most literature tools help you read a paper. StudyDiff explains why two papers conflict: an explanation, not a summary.

---

## Submission fields

**Team:** Nick Lamb

**Demo video:** _[paste link once recorded]_

**Links:**
- Repository: https://github.com/nickjlamb/studydiff (branch `main`, public, MIT)
- Live app: https://studydiff.pharmatools.ai
- Embedded at: https://pharmatools.ai/studydiff

---

*Word count of the Description above: 173 words (within the 100–200 target).*
