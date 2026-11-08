# Testing

How to run the tests, what CI does, and how to handle a failed check. Read this before running tests, reading a
failed check, or changing `tests/` or the workflow.

## Which test to run (owner, 8 November 2026)

| Change | Test |
|---|---|
| Documents only | None |
| Wording, styles, layout, moving code | Pull-request-style test: `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 DATA_SERVICES=0 REPLAY=daily node tests/live-check.mjs` (under a minute), plus the accessibility re-check for visual changes |
| A data source, a topic, a backup, or anything that sends requests | Full test with `REPLAY=daily` (under a minute; every data service is still asked live, and a question missing from the recording, such as a new topic's, goes live) |

`REPLAY=daily` uses the daily recording on the `status` branch. With none (before the first daily run, or if it
cannot be read) everything is asked live, one report at a time, each a minute after the last request to the
Environment Agency map server: 4 to 7 minutes, more during outages.
Measured on 8 November 2026: pull-request-style test 37 s and full test 47 s with a recording (515 s live, during an Environment Agency outage); the
after-merge check's quick run 51 s; the accessibility check 44 s.

The syntax check runs after every code edit whatever the change. GitHub (on the pull request) and the after-merge
check still run the whole test, so the owner's merge is always covered.

## Running the tests

- **Syntax check:** `node tests/syntax-check.mjs` (all `js/` files together in load order, then `sw.js`). A project
  hook (`.claude/settings.json`, `.claude/hooks/syntax-check.sh`) runs it after every edit to `index.html` or a `.js`
  file. Fix any error it reports before going on.
- **Full test:** `npm install --no-save playwright@1.63.0 && npx playwright install chromium` (in a cloud session use
  the preinstalled browser instead: `npm install --no-save playwright@$(node -p "require('/opt/node-tools/node_modules/playwright/package.json').version")`),
  then `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 REPLAY=daily node tests/live-check.mjs` (local copy) or
  `QUIET=1 REPLAY=daily node tests/live-check.mjs` (live site). Do not edit files while it runs: a mixed run fails at
  random.
- **How it saves time** (owner, 8 November 2026; no step dropped): the data services are asked 6 at a time (the
  Environment Agency map server's one at a time), and a service that hangs gives up after 15 s, then has a second
  try. With a recording, the services, the country data and the three devices run at the same time. The phone and
  tablet get blank map pictures at once (the desktop loads and checks the real ones). Screenshots are JPEG.
- **Saving tokens:** `QUIET=1` prints only warnings, failures and the total; `node tests/digest.mjs [results.json]`
  prints the failures and the 5 slowest steps of a finished run (each result records its time). On a failed GitHub
  check, read its annotations or `get_job_logs` with a small `tail_lines`, not the whole log. Search files instead of
  reading them whole.
- **Run one part, to find a fault** (owner, 8 November 2026; never used by the workflow): `ONLY=services,country,desktop,phone,tablet`
  runs only those parts; `STEP="name|name"` runs only the steps whose name contains one of these (any case). On a
  device, open, search and the report always run, because every later step needs them; a step that relies on an
  earlier one (a saved property, notes) needs that one named too. A partial run is named in its results ("Partial
  run") and saves no recording. Example, about 15 s: `BASE=http://localhost:8080/ PAUSE_MS=0 REPLAY=daily ONLY=desktop STEP="Try again" node tests/live-check.mjs`.
  Run the whole test before a pull request.
- **Accessibility re-check** (by hand, after visual changes; GitHub also runs it on every pull request): `npm install --no-save axe-core`, then
  `node tests/a11y-check.mjs` with the local server running (under a minute). It scans WCAG 2.2 AA on the start
  page, a report, `status.html` and `glossary.html` in 4 combinations at the same time (`COMBOS`: every width, colour
  scheme and text size, including 320 px with A+ text), and checks sideways scrolling before and after using each control in its
  `ACTIONS` list: add each new or changed control there. Also Tab through every control and check none is hidden.

## After a merge

`bash tests/after-merge.sh`, in the background. It restarts the branch from `origin/main` and pushes it. If the merge
changed no app files, it stops there (seconds). Otherwise it waits for Pages to serve the new `APP_VERSION`/`CACHE`
and runs a quick live check (`QUICK=1`, owner, 8 November 2026): every data service live, and every desktop step with
one full report, from the daily recording (about a minute), or live after a pause if there is no recording yet. The
pull request check already ran every step on the same code, and the daily run still does. It then asks each failed data service again (`ONLY_SERVICES`) and
prints "answers now" (an outage on their side) or "still down". Edit nothing while it runs. A stop hook "unpushed
commit" warning meanwhile is a timing clash: check with `git fetch` + `git rev-list --count origin/<branch>..HEAD`
before pushing anything.

## CI

- `.github/workflows/live-check.yml` runs `tests/live-check.mjs` daily at 05:17 UTC, by hand, and on pull requests
  that change `index.html`, `status.html`, `glossary.html`, `css/`, `js/`, `data/`, `sw.js`, `manifest.webmanifest`,
  `tests/` or the workflow. The test is `tests/live-check.mjs`, which runs the parts in `tests/live/` (its header
  lists them; split on 8 November 2026, same steps).
- **Two issues** (owner, 8 November 2026): a daily or manual run comments on "Live check failed" when an app step
  fails, and on "Data services down" when an outside service did not answer (each opened if not open yet). Each
  closes after a run in which its own part passed; "Data services down" only after a run that checked the data
  services. The test writes both texts to `issues.json` (the "In short" line and that part's table); the workflow
  adds the run link. Pull requests open no issue. The pass rules are unchanged: an outage still fails the run.
- **Accessibility on pull requests:** a second job (`accessibility`) runs `tests/a11y-check.mjs` on its own machine
  at the same time as the live check, so the check takes no longer. A data service that is down does not fail it.
- **Same versions as locally:** the workflow's `env` sets `PLAYWRIGHT` (1.63.0) and `AXE` (4.14.0). Change them
  together with the local install line above; the saved browser is downloaded again once.
- **Stopping runs:** a new push to a pull request stops its older check. Daily and manual runs on `main` are never
  stopped (each publishes the status page): a second one waits for the first.
- **Before the long check**, the syntax check and `node --check` on every `tests/*.mjs` and `tests/live/*.mjs` file
  run, so a typing mistake fails in a second.
- **The "In short" line** in every summary (and in the console after a failure) tells an outside outage from an app
  fault: "Every app step passed; 6 data service(s) did not answer: …", or how many app steps failed, noting when
  they name a service that did not answer. The pass rules are the same either way.
- **Where the time goes:** each run's summary page lists the 10 slowest test steps under the results table. Each
  step of the `check` job shows its own time; a gap between log time stamps is a pause (on daily runs, each report
  waits until a minute after the last request to the Environment Agency map server, and says so unless `QUIET=1`). To see more, download `live-check-results` and run `node tests/digest.mjs results.json 20`, or use
  "Re-run jobs" with "Enable debug logging".
- **Daily and manual runs** check everything live. On `main` they then publish to the `status` branch: `status.json`
  (the status page) and `recordings.json` (the report pages' outside answers, `RECORD=1`; merged by
  `tests/merge-recordings.mjs`, each answer kept up to 14 days).
- **Pull requests** (at the owner's request) leave out the 44 report data services (`DATA_SERVICES=0`; the list is
  `data/data-services.csv`; they run daily, and by hand with the "Check the report data services" box, ticked by
  default). Their report pages are answered from `recordings.json` (`REPLAY`), so an outside outage cannot turn them
  red; a question never recorded (for example a new topic) is asked live and named in the "Report data from the daily
  recording" result. A test step's own stub (`page.route`) always comes first.

## Writing test steps

- Steps that only test data functions (no screen layout) belong in `testCountryData()` in `tests/live/country.mjs`:
  they run once (at the same time as the devices when replaying, otherwise beside the data services), and must send
  nothing to the Environment Agency map server.
- Steps that check the page stay in `testDevice()` (`tests/live/devices.mjs`): a step that does not depend on the screen size uses `desktopStep`
  (runs once); a layout step uses `step` (runs on every device).
- Wait for the page (`until`, `scrolled`), not the clock; where the app itself waits (the 8 s retry, the 8 s slow note), move
  the page's clock on (`page.clock.fastForward`, as in the Try again and Slow report steps). With `REPLAY` loaded the three devices run at the
  same time, so a step must not depend on another device's steps.
- Never skip, remove or loosen a test step to get a pass. The only allowed non-pass is a `"warn"` for the Environment
  Agency map server refusing GitHub's machines with HTTP 403.

## Outside outages

Outside services (BGS, Environment Agency, Open-Meteo, data.police.uk) have outages. Before changing code for a
failed check, ask the service directly whether the fault is theirs. If a service refuses GitHub's machines but
answers directly (HM Land Registry sometimes does; check with `curl` from the session), re-run the job once and
comment once on the PR; changing what a test accepts needs the owner.
