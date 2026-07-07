# Deploying StudyDiff (Railway + pharmatools.ai)

The app is a Node server (it calls Claude and PubMed server-side so the API key
never reaches the browser). It deploys to Railway and is reached at
`studydiff.pharmatools.ai`, linked from a `pharmatools.ai/studydiff` page on Webflow.

## 1. Deploy to Railway

1. Push this repo to GitHub (done: `github.com/nickjlamb/studydiff`).
2. At [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → pick `studydiff`.
3. Railway auto-detects Node (Nixpacks) and runs `npm start` (see `railway.json`). No Dockerfile needed.
4. **Variables** tab → add:
   - `ANTHROPIC_API_KEY` = your key (this is the secret; it stays server-side).
   - `NCBI_EMAIL` = your email (NCBI etiquette; raises reliability).
   - *(optional)* `NCBI_API_KEY`, `RATE_LIMIT_PER_HOUR` (default 30), `DAILY_LIVE_CAP` (default 300).
   - Do **not** set `PORT` — Railway injects it; the server reads `process.env.PORT`.
5. Deploy. Open the generated `*.up.railway.app` URL and test the examples + a live PMID pair.

## 2. Custom domain

1. Railway → your service → **Settings → Networking → Custom Domain** → add `studydiff.pharmatools.ai`.
2. Railway shows a **CNAME target** (e.g. `xxxx.up.railway.app`).
3. In your DNS provider for `pharmatools.ai`, add a **CNAME**: `studydiff` → that target.
4. Wait for DNS + Railway's automatic TLS to go green.

## 3. Surface it at pharmatools.ai/studydiff (Webflow)

Webflow can't run the Node app, so make a Webflow page at `/studydiff` that either:
- **Links** to `https://studydiff.pharmatools.ai` with a prominent "Launch StudyDiff" button, or
- **Embeds** it: add an Embed element with
  `<iframe src="https://studydiff.pharmatools.ai" style="width:100%;height:90vh;border:0"></iframe>`.
  The app already sets `frame-ancestors` to allow `pharmatools.ai`, so the iframe will load.

## Cost & abuse protection

- Each live comparison = two Claude extraction calls. Identical comparisons are cached (6 h).
- Per-IP limit: 30 requests/hour. Global live cap: 300/day (tune via env vars).
- The built-in examples run from cached fixtures — **zero API cost** — so demos never spend credits.
