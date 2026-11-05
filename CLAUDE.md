# CLAUDE.md

Property Location Check: a free report on a home's location in England from official open data, for non-technical
home buyers. Static site with no build step. GitHub Pages serves `main` at https://andyseremet.github.io/reports-examles/.

## Code layout

- `index.html` (the page), `css/app.css` (all styles), `sw.js` (offline support), `data/` (fixed data saved with the
  app). The README table "How the code is organised" says what each file holds.
- `js/`: plain scripts that share one global scope (no modules, no build step), loaded by `index.html` in this order:
  `core.js` (sources, links, settings, `APP_VERSION`, helpers) → `data.js` (fetch functions, `TASKS`) →
  `checks/flood.js`, `ground.js`, `living.js`, `planning.js` (one per report section) → `checks/index.js` (shared
  check helpers, `CHECKS`, `TOPIC_ICONS`, `COVERAGE`) → `app.js` (map, search, run, report, saved, share, start).
  Code that runs at load time may only use what an earlier file defines. A new JS file must be added to `index.html`
  and to `SHELL` in `sw.js`.
- `status.html` + `js/status.js`: the data service status page, separate from the app (its own script). It reads
  `status.json` from the `status` branch, which the daily workflow publishes (`tests/publish-status.mjs`). A new row
  in `SERVICES` (`tests/live-check.mjs`) also needs its report topics in `SERVICE_TOPICS`.

## Commands

- Serve locally: `python3 -m http.server 8080` (the app needs http, not `file://`).
- Syntax check: `node tests/syntax-check.mjs` (all `js/` files together in load order, then `sw.js`). A project hook
  (`.claude/settings.json`, `.claude/hooks/syntax-check.sh`) runs it after every edit to `index.html` or a `.js` file.
  Fix any error it reports before going on.
- Full test: `npm install --no-save playwright@1.49.1 && npx playwright install chromium`, then
  `BASE=http://localhost:8080/ PAUSE_MS=0 node tests/live-check.mjs` (local copy) or `node tests/live-check.mjs`
  (live site, about 6 minutes).
- There is no way to run one test step. To check one behaviour, write a short Playwright script outside the repo,
  and answer `https://environment.data.gov.uk/spatialdata/**` with `{"features":[]}` so the report finishes fast.
- After a merge: `bash tests/after-merge.sh` (restarts the branch from `origin/main`, waits for Pages to serve the new
  `APP_VERSION`/`CACHE`, runs the live check). Run it in the background; it can take 20 minutes.
- Accessibility re-check (by hand, after visual changes; not in CI): `npm install --no-save axe-core` in the scratchpad,
  scan WCAG 2.2 AA tags on the start page, a full report (Open all, sources open), and `status.html`, at 1280 px,
  320 px and phone, light and dark, normal and A+ text; also Tab through every control and check none is hidden. At
  320 px, check for sideways scrolling both before and after using each new or changed control (a button can change
  its own size or its neighbours' once pressed).

## Rules

- **User-facing text:** plain English, short sentences. Explain any technical term with `term()`. Rate topics only
  with the five labels in `STATUS_LABEL`.
- **Missing data is never good news:** when a source has published nothing (a police force, a council dataset, an
  empty national dataset), rate the topic `"manual"` (Check yourself), not `"low"` (No issue found). See
  `policeDataMissing`, `checkTrees` and `checkLanduse`.
- **Outside data stays live.** Save a copy in `data/` only for a finished official dataset that will never be
  revised (for example Census 2021), and ask the owner first. Say in `README.md` how the file was made.
- **Sticky bars:** keep focus clear of them with the `:focus` `scroll-margin` rule and `--sticky-top`/`--bottom-clear`
  in `css/app.css`. Never use `html { scroll-padding }`: it stops the section bar's smooth scroll.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): it refuses addresses that send more than
  about 15 requests a minute. Do not add requests to it, and keep its pacing in `PACED_HOSTS`.
- **Adding a topic:** a fetch function and its row in `TASKS` (`js/data.js`), the check in its section's
  `js/checks/` file, rows in `CHECKS`, `TOPIC_ICONS` and `COVERAGE` (if it does not cover all of England, Wales and
  Scotland) in `js/checks/index.js`, and `SERVICES` in `tests/live-check.mjs`.
- **Releases** (run `/release`, see `.claude/skills/release/SKILL.md`): any change to `index.html`, `status.html`, `css/`,
  `js/`, `sw.js` or `data/` raises `APP_VERSION` (`js/core.js`) and `CACHE` (`sw.js`, `plc-vN`) together. In the same commit, update `README.md`, and move the shipped items in `ROADMAP.md`
  into Part 1.

## Working with the owner

- **Plan first for larger work:** before a new topic, a new version, or a change across several files, give a short
  plan and ask quiz-style questions (with a recommended answer). Small fixes need no quiz.
- **Free for everyone:** every feature stays free. Never add a paywall, forced payment, adverts or accounts. Support
  for the app's development is always voluntary, and only ever as a separate optional module that the app reaches
  through hooks, so the app works the same without it (see `MONETISATION.md`).
- **Steady changes:** improve in small steps; no redesigns, new libraries or build step without asking. English only.
- **Small commits:** one change per commit, with a clear message.
- **Pull requests:** open one only when asked, and never merge or approve; the owner merges. Then watch it
  (`subscribe_pr_activity` plus one 50-minute safety check-in). After the merge: cancel the check-in and run
  `tests/after-merge.sh`.
- **Check the live page after every merge** (`tests/after-merge.sh`) and report the pass count in plain English; an
  Environment Agency HTTP 403 "warn" is the only allowed non-pass. If Pages has not published within about 10
  minutes (no new "pages build and deployment" run), ask the owner to press Save in Settings → Pages.
- **Default branch stays `main`:** scheduled runs use the default branch, and the status page publishes only from `main`.
- **Keep this file current:** at the end of a task, suggest any instruction the owner repeated as a new rule here.

## Tests and CI

- `.github/workflows/live-check.yml` runs `tests/live-check.mjs` daily at 05:17 UTC, by hand, and on pull requests
  that change `index.html`, `status.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest`, `tests/` or the workflow.
  Daily and manual runs on `main` then publish `status.json` to the `status` branch for the status page. A failed daily or manual run
  opens or updates a "Live check failed" issue.
- Never skip, remove or loosen a test step to get a pass. The only allowed `"warn"` result is the Environment Agency
  map server refusing GitHub's machines with HTTP 403.
- Outside services (BGS, Environment Agency, Open-Meteo, data.police.uk) have outages. Before changing code for a
  failed check, ask the service directly whether the fault is theirs. If a service refuses GitHub's machines but
  answers directly (HM Land Registry did, once), re-run the job once and comment once on the PR; changing what a test
  accepts needs the owner.
