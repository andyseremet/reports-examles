# Review instructions

Property Location Check is a static site with no build step, used by non-technical home buyers. The rules behind
these checks are in `CLAUDE.md` and `docs/`.

## What Important means here

Reserve Important for findings that would mislead a buyer, break the app, leak data or overload a data service:

- **A wrong rating:** missing or failed data rated "No issue found" (`"low"`) instead of "Check yourself"
  (`"manual"`), a rating outside the five labels in `STATUS_LABEL`, or a backup or saved answer shown as current.
- **A broken report:** a topic that never finishes, a script error, code run at load time that uses something a
  later file defines (load order in `index.html`), a name used but not imported (modules, since 2.4.0), a `let`
  variable changed outside the file that declares it, a test reading an app name missing from `js/page-names.js`,
  or a printout that drops the map or the findings.
- **Data leaving the device:** saved properties, notes or searches sent to any outside service, or the owner's email
  address used anywhere.
- **Extra load on outside services:** a new request to the Environment Agency map server
  (`environment.data.gov.uk/spatialdata`), pacing removed from `PACED_HOSTS`, a backup that runs on a normal day, or
  a public relay service.
- **A mixed update:** a change to `index.html`, `status.html`, `glossary.html`, `css/`, `js/`, `sw.js` or `data/`
  without raising `APP_VERSION` and `CACHE` together, or a new JS file missing from `SHELL` in `sw.js`.
- **A weakened test:** a test step skipped, removed or loosened to get a pass.

Wording, naming, style and refactoring suggestions are Nit at most.

## Cap the nits

Report at most five Nits per review.

## Do not report

- Anything the project's checks already catch: syntax errors (`tests/syntax-check.mjs`, run after every edit) and
  page errors (the "No page errors" step in `tests/live/devices.mjs`).
- Fixed data saved with the app: `data/census2021-msoa-residents.json` and `data/rail-stations.json`.
- Files the daily workflow writes to the `status` branch (`status.json`, `recordings.json`) and test output in
  `test-results/`.
- Test-only stubs in `tests/` (`page.route`, a service made to fail on purpose), which break production rules on
  purpose.
- Failures caused by an outside service's outage (for example planning.data.gov.uk answering HTTP 503).

## Always check

- Missing data is rated "Check yourself", never "No issue found" (see `policeDataMissing` and `checkLanduse`).
- User-facing text is plain English in short sentences, and every technical word goes through `term()`, with its
  `<dt id>` in `glossary.html`.
- A new topic has all its parts: fetch function and `TASKS` row, check, `CHECKS`, `TOPIC_ICONS`, `COVERAGE` (if not
  UK-wide; the topic is then left out elsewhere), `SERVICES` and `SERVICE_TOPICS` in `tests/live/services.mjs`, and
  `data/data-services.csv`. A topic count uses `shownChecks()`, not `CHECKS.length`.
- New behaviour has a step in `tests/live/` (`devices.mjs` or `country.mjs`), and a new or changed control is in `ACTIONS` in
  `tests/a11y-check.mjs`.
- Test parts that run at the same time (`Promise.all` in `tests/live-check.mjs`) never send Nominatim two requests at
  once: every live request to it (pages and service checks) goes through `nominatimTurn()` in `tests/live/recording.mjs`
  (`docs/TESTING.md`, "One Nominatim request at a time").
- Buttons show an icon and a word, a control's `aria-label` starts with its visible words, and short messages sit in
  a `role="status"` or `aria-live="polite"` element.
- A release updates `README.md` and moves the shipped items into Part 1 of `ROADMAP.md`.
