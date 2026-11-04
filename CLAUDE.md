# CLAUDE.md

Property Location Check: a free report on a home's location in England from official open data, for non-technical
home buyers. Static site with no build step: all app code is in `index.html`, plus `sw.js` and `data/`. GitHub Pages
serves `main` at https://andyseremet.github.io/reports-examles/.

## Commands

- Serve locally: `python3 -m http.server 8080` (the app needs http, not `file://`).
- Syntax check:
  `node -e "new Function(require('fs').readFileSync('index.html','utf8').split('<script>').slice(-1)[0].split('</script>')[0])" && node --check sw.js`
- Full test: `npm install --no-save playwright@1.49.1 && npx playwright install chromium`, then
  `BASE=http://localhost:8080/ PAUSE_MS=0 node tests/live-check.mjs` (local copy) or `node tests/live-check.mjs`
  (live site, about 6 minutes).
- There is no way to run one test step. To check one behaviour, write a short Playwright script outside the repo,
  and answer `https://environment.data.gov.uk/spatialdata/**` with `{"features":[]}` so the report finishes fast.

## Rules

- **User-facing text:** plain English, short sentences. Explain any technical term with `term()`. Rate topics only
  with the five labels in `STATUS_LABEL`.
- **Missing data is never good news:** when a source has published nothing (a police force, a council dataset, an
  empty national dataset), rate the topic `"manual"` (Check yourself), not `"low"` (No issue found). See
  `policeDataMissing`, `checkTrees` and `checkLanduse`.
- **Outside data stays live.** Save a copy in `data/` only for a finished official dataset that will never be
  revised (for example Census 2021), and ask the owner first. Say in `README.md` how the file was made.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): it refuses addresses that send more than
  about 15 requests a minute. Do not add requests to it, and keep its pacing in `PACED_HOSTS`.
- **Adding a topic:** a fetch function, then rows in `TASKS`, `CHECKS`, `TOPIC_ICONS`, `COVERAGE` (if it does not
  cover all of England, Wales and Scotland), and `SERVICES` in `tests/live-check.mjs`.
- **Releases:** any change to `index.html`, `sw.js` or `data/` raises `APP_VERSION` (`index.html`) and `CACHE`
  (`sw.js`, `plc-vN`) together. In the same commit, update `README.md`, and move the shipped items in `ROADMAP.md`
  into Part 1.

## Tests and CI

- `.github/workflows/live-check.yml` runs `tests/live-check.mjs` daily at 05:17 UTC, by hand, and on pull requests
  that change `index.html`, `sw.js`, `manifest.webmanifest`, `tests/` or the workflow. A failed daily or manual run
  opens or updates a "Live check failed" issue.
- Never skip, remove or loosen a test step to get a pass. The only allowed `"warn"` result is the Environment Agency
  map server refusing GitHub's machines with HTTP 403.
- Outside services (BGS, Environment Agency, Open-Meteo, data.police.uk) have outages. Before changing code for a
  failed check, ask the service directly whether the fault is theirs.
