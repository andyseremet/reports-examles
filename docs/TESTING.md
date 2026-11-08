# Testing

How to run the tests, what CI does, and how to handle a failed check. Read this before running tests, reading a
failed check, or changing `tests/` or the workflow.

## Which test to run (owner, 8 November 2026)

| Change | Test |
|---|---|
| Documents only | None |
| Wording, styles, layout, moving code | Pull-request-style test: `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 DATA_SERVICES=0 REPLAY=https://raw.githubusercontent.com/andyseremet/reports-examles/status/recordings.json node tests/live-check.mjs` (about 1.5 minutes; until the first daily recording exists, leave out `REPLAY` and it asks live), plus the accessibility re-check for visual changes |
| A data source, a topic, a backup, or anything that sends requests | Full test (about 4 minutes) |

The syntax check runs after every code edit whatever the change. GitHub (on the pull request) and the after-merge
check still run the whole test, so the owner's merge is always covered.

## Running the tests

- **Syntax check:** `node tests/syntax-check.mjs` (all `js/` files together in load order, then `sw.js`). A project
  hook (`.claude/settings.json`, `.claude/hooks/syntax-check.sh`) runs it after every edit to `index.html` or a `.js`
  file. Fix any error it reports before going on.
- **Full test:** `npm install --no-save playwright@1.49.1 && npx playwright install chromium` (in a cloud session use
  the preinstalled browser instead: `npm install --no-save playwright@$(node -p "require('/opt/node-tools/node_modules/playwright/package.json').version")`),
  then `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 node tests/live-check.mjs` (local copy, about 6 minutes) or
  `QUIET=1 node tests/live-check.mjs` (live site). Do not edit files while it runs: a mixed run fails at random.
- **Saving tokens:** `QUIET=1` prints only warnings, failures and the total; `node tests/digest.mjs [results.json]`
  prints the failures and the 5 slowest steps of a finished run (each result records its time). On a failed GitHub
  check, read its annotations or `get_job_logs` with a small `tail_lines`, not the whole log. Search files instead of
  reading them whole.
- **One behaviour:** there is no way to run one test step. Write a short Playwright script outside the repo, and
  answer `https://environment.data.gov.uk/spatialdata/**` with `{"features":[]}` so the report finishes fast.
- **Accessibility re-check** (by hand, after visual changes; not in CI): `npm install --no-save axe-core`, then
  `node tests/a11y-check.mjs` with the local server running (about 3 minutes). It scans WCAG 2.2 AA on the start
  page, a report, `status.html` and `glossary.html` in 4 combinations (`COMBOS`: every width, colour scheme and text
  size, including 320 px with A+ text), and checks sideways scrolling before and after using each control in its
  `ACTIONS` list: add each new or changed control there. Also Tab through every control and check none is hidden.

## After a merge

`bash tests/after-merge.sh`, in the background. It restarts the branch from `origin/main` and pushes it. If the merge
changed no app files, it stops there (seconds). Otherwise it waits for Pages to serve the new `APP_VERSION`/`CACHE`
and runs the live check: every data service live, the report pages from the daily recording (about 5 minutes), or
all live with pauses if there is no recording yet. It then asks each failed data service again (`ONLY_SERVICES`) and
prints "answers now" (an outage on their side) or "still down". Edit nothing while it runs. A stop hook "unpushed
commit" warning meanwhile is a timing clash: check with `git fetch` + `git rev-list --count origin/<branch>..HEAD`
before pushing anything.

## CI

- `.github/workflows/live-check.yml` runs `tests/live-check.mjs` daily at 05:17 UTC, by hand, and on pull requests
  that change `index.html`, `status.html`, `glossary.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest`, `tests/`
  or the workflow. A failed daily or manual run opens or updates a "Live check failed" issue; a full run (data
  services included) that passes closes it.
- **Daily and manual runs** check everything live. On `main` they then publish to the `status` branch: `status.json`
  (the status page) and `recordings.json` (the report pages' outside answers, `RECORD=1`; merged by
  `tests/merge-recordings.mjs`, each answer kept up to 14 days).
- **Pull requests** (at the owner's request) leave out the 44 report data services (`DATA_SERVICES=0`; the list is
  `data/data-services.csv`; they run daily, and by hand with the "Check the report data services" box, ticked by
  default). Their report pages are answered from `recordings.json` (`REPLAY`), so an outside outage cannot turn them
  red; a question never recorded (for example a new topic) is asked live and named in the "Report data from the daily
  recording" result. A test step's own stub (`page.route`) always comes first.

## Writing test steps

- Steps that only test data functions (no screen layout) belong in `testCountryData()` in `tests/live-check.mjs`:
  they run once, during the first pause, and must send nothing to the Environment Agency map server.
- Steps that check the page stay in `testDevice()`: a step that does not depend on the screen size uses `desktopStep`
  (runs once); a layout step uses `step` (runs on every device).
- Wait for the page (`until`, `scrolled`), not the clock. With `REPLAY` loaded, the pauses between reports are skipped
  until a question missing from the recording has to ask the Environment Agency live.
- Never skip, remove or loosen a test step to get a pass. The only allowed non-pass is a `"warn"` for the Environment
  Agency map server refusing GitHub's machines with HTTP 403.

## Outside outages

Outside services (BGS, Environment Agency, Open-Meteo, data.police.uk) have outages. Before changing code for a
failed check, ask the service directly whether the fault is theirs. If a service refuses GitHub's machines but
answers directly (HM Land Registry sometimes does; check with `curl` from the session), re-run the job once and
comment once on the PR; changing what a test accepts needs the owner.
