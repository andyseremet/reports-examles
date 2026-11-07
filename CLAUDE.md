# CLAUDE.md

Property Location Check: a free report on a home's location in England, Wales, Scotland and Northern Ireland from official open data, for non-technical
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
- **Wales:** land use, coast, noise, air, planning and nature use DataMapWales (`datamap.gov.wales`, paced in
  `PACED_HOSTS`): `getWalesSites`, `getWalesNoise`, `getWalesCoast`, `getCoalTips` in `js/data.js`, and `isWales(R)`
  branches in the checks. England-only fetches return early for Wales instead of asking England's servers.
- **Scotland:** the same topics plus crime use Historic Environment Scotland, NatureScot (`ogc.nature.scot`, also Dynamic
  Coast), SEPA, the Scottish Government and the Scottish Air Quality database: `getScotlandSites` (same shape as
  `getWalesSites`), `getScotlandNoise`, `getScotlandCoast`, `getWasteSites`, `getSimdCrime`, and `isScotland(R)`.
  `checkPlanningDevolved`/`checkNatureDevolved` serve Wales, Scotland and Northern Ireland (`sitesKey(R)`).
- **Northern Ireland:** planning, nature, noise and coast use the Department for Communities (Historic Environment
  Division) and DAERA (`gis.daera-ni.gov.uk`): `getNISites`, `getNINoise`, `getNICoast`, and `isNI(R)`. Use the official
  HED service, not the NIE Networks copies on ArcGIS Online. Flood maps, radon, landslides and coal are not open there.
- **Backups:** when planning.data.gov.uk fails, `withBackup`/`planningBackup` (`js/data.js`) ask Historic England and
  Natural England for heritage and nature, and the Environment Agency for the flood zone at the pin (England only, never on a normal day). The answer rides on the failure as
  `R[key].backup`; only `checkPlanning`/`checkNature`/`checkFlood` read it (`backupFor`, `planningList`). Any topic whose service
  fails shows the place's last saved answer, dated (`savedInstead` in `js/app.js`).
- `status.html` + `js/status.js`: the data service status page, separate from the app (its own script). It reads
  `status.json` from the `status` branch, which the daily workflow publishes (`tests/publish-status.mjs`). A new row
  in `SERVICES` (`tests/live-check.mjs`) also needs its report topics in `SERVICE_TOPICS`.

## Commands

- Serve locally: `python3 -m http.server 8080` (the app needs http, not `file://`).
- Syntax check: `node tests/syntax-check.mjs` (all `js/` files together in load order, then `sw.js`). A project hook
  (`.claude/settings.json`, `.claude/hooks/syntax-check.sh`) runs it after every edit to `index.html` or a `.js` file.
  Fix any error it reports before going on.
- Full test: `npm install --no-save playwright@1.49.1 && npx playwright install chromium` (in a cloud session use the
  preinstalled browser instead: `npm install --no-save playwright@$(node -p "require('/opt/node-tools/node_modules/playwright/package.json').version")`), then
  `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 node tests/live-check.mjs` (local copy) or `QUIET=1 node
  tests/live-check.mjs` (live site, about 5 minutes). `QUIET=1` prints only warnings, failures and the total.
- **Saving tokens:** run tests with `QUIET=1`. On a failed GitHub check, read its annotations (one per failed
  check) or `get_job_logs` with a small `tail_lines`, not the whole log. Search files instead of reading them whole.
- There is no way to run one test step. To check one behaviour, write a short Playwright script outside the repo,
  and answer `https://environment.data.gov.uk/spatialdata/**` with `{"features":[]}` so the report finishes fast.
- After a merge: `bash tests/after-merge.sh` (restarts the branch from `origin/main` and pushes it, waits for Pages to
  serve the new `APP_VERSION`/`CACHE`, runs the live check). Run it in the background; it can take 20 minutes. A stop
  hook "unpushed commit" warning while it runs is a timing clash: check with `git fetch` + `git rev-list --count
  origin/<branch>..HEAD` before pushing anything.
- Accessibility re-check (by hand, after visual changes; not in CI): `npm install --no-save axe-core`, then
  `node tests/a11y-check.mjs` with the local server running (about 10 minutes). It scans WCAG 2.2 AA on the start
  page, a report and `status.html` at 1280 px, 320 px and phone, light and dark, normal and A+ text, and checks
  sideways scrolling before and after using each control in its `ACTIONS` list: add each new or changed control
  there. Also Tab through every control and check none is hidden.

## Rules

- **User-facing text:** plain English, short sentences. Explain any technical term with `term()`. Rate topics only
  with the five labels in `STATUS_LABEL`.
- **Missing data is never good news:** when a source has published nothing (a police force, a council dataset, an
  empty national dataset), rate the topic `"manual"` (Check yourself), not `"low"` (No issue found). See
  `policeDataMissing` and `checkLanduse`.
- **Outside data stays live.** Save a copy in `data/` only for a finished official dataset that will never be
  revised (for example Census 2021), and ask the owner first. Say in `README.md` how the file was made.
- **Sticky bars:** keep focus clear of them with the `:focus` `scroll-margin` rule and `--sticky-top`/`--bottom-clear`
  in `css/app.css`. Never use `html { scroll-padding }`: it stops the section bar's smooth scroll.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): it refuses addresses that send more than
  about 15 requests a minute. Do not add requests to it, and keep its pacing in `PACED_HOSTS`. The one agreed exception
  (owner, 7 November 2026): the flood zone backup (`floodZoneBackup`), one request, only when planning.data.gov.uk fails.
- **Adding a topic:** a fetch function and its row in `TASKS` (`js/data.js`), the check in its section's
  `js/checks/` file, rows in `CHECKS`, `TOPIC_ICONS` and `COVERAGE` (if it does not cover all of England, Wales and
  Scotland) in `js/checks/index.js`, and `SERVICES` in `tests/live-check.mjs`.
- **Releases** (run `/release`, see `.claude/skills/release/SKILL.md`): any change to `index.html`, `status.html`, `css/`,
  `js/`, `sw.js` or `data/` raises `APP_VERSION` (`js/core.js`) and `CACHE` (`sw.js`, `plc-vN`) together. In the same commit, update `README.md`, and move the shipped items in `ROADMAP.md`
  into Part 1.

## Interface habits

- Buttons show an icon and a word; never an icon alone (a first-time user may not know the icon).
- Undo, not "Are you sure?": an action that deletes something offers Undo for about 10 seconds.
- Short messages ("Saved ✓", "Copied", "Removed …") sit in a `role="status"` or `aria-live="polite"` element.
- A control's spoken name (`aria-label`) starts with its visible words (WCAG 2.5.3, voice control).
- In-page jumps land below the sticky bars: give the target `scroll-margin-top` (see the rule in `css/app.css`).

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
  Daily and manual runs on `main` then publish `status.json` to the `status` branch for the status page.
  **Pull requests leave out the 38 report data services** (`DATA_SERVICES=0`; the list is `data/data-services.csv`),
  at the owner's request: they run daily, and by hand with the "Check the report data services" box (ticked by default).
  The report steps still use the live services, so an outage can still fail a pull request. A failed daily or manual run
  opens or updates a "Live check failed" issue.
- Steps that only test data functions (no screen layout) belong in `testCountryData()` in `tests/live-check.mjs`:
  they run once, during the first pause, and must send nothing to the Environment Agency map server. Steps that
  check the page on a phone, tablet or desktop stay in `testDevice()`.
- Never skip, remove or loosen a test step to get a pass. The only allowed `"warn"` result is the Environment Agency
  map server refusing GitHub's machines with HTTP 403.
- Outside services (BGS, Environment Agency, Open-Meteo, data.police.uk) have outages. Before changing code for a
  failed check, ask the service directly whether the fault is theirs. If a service refuses GitHub's machines but
  answers directly (HM Land Registry sometimes does; check with `curl` from the session), re-run the job once and
  comment once on the PR; changing what a test accepts needs the owner.
