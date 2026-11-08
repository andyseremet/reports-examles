# Code

How the app's code is laid out and the rules for changing it. Read this before changing `js/`, `index.html`,
`status.html`, `glossary.html`, `sw.js` or `data/`, and before adding a topic.

## Layout

- `index.html` (the page), `css/app.css` (all styles), `sw.js` (offline support), `data/` (fixed data saved with the
  app). The README table "How the code is organised" says what each file holds.
- `js/`: plain scripts sharing one global scope (no modules), loaded by `index.html` in this order:
  1. `core.js` (links, settings, `APP_VERSION`, helpers such as `term()` and `GLOSSARY`) → `api.js` (`API`,
     `PACED_HOSTS`, `fetchJSON`, `arcgisRequest`)
  2. `data.js` (England and shared fetch helpers) → `backups.js` → `data-wales.js` → `data-scotland.js` →
     `data-ni.js` → `tasks.js` (`TASKS`, which names every fetch function, so it comes after them)
  3. `checks/flood.js`, `ground.js`, `living.js`, `planning.js`: one per report section
  4. `checks/index.js` (shared check helpers, `CHECKS`, `TOPIC_ICONS`) → `coverage.js` (`COVERAGE`, `topicShown`,
     `shownChecks()`, `notCoveredNote()`)
  5. `map.js` → `search.js` → `saved.js` (`store`, saved properties, compare, guide) → `run.js` (running the checks,
     Try again, recent answers, saved reports) → `summary.js` (verdict, topic grid, why box) → `report.js` (topic
     cards, layout, sources) → `next-steps.js` → `navigation.js` → `print.js` (share, download, print) → `app.js`
     (larger text, install, start-up)

  One job per file (owner, 8 November 2026). Code that runs at load time may only use what an earlier file defines.
  A new JS file goes in `index.html` and in `SHELL` in `sw.js`.
- `glossary.html`: "What the words mean", plain HTML with no script. `term()` links a word to it through `GLOSSARY`
  (word → id); every id needs its `<dt id>` on the page (the daily check compares them).
- `status.html` + `js/status.js`: the data service status page, separate from the app (its own script). It reads
  `status.json` from the `status` branch, which the daily workflow publishes (`tests/publish-status.mjs`). A new row
  in `SERVICES` (`tests/live/services.mjs`) also needs its report topics in `SERVICE_TOPICS`.

## Countries

- **Wales:** land use, coast, noise, air, planning and nature use DataMapWales (`datamap.gov.wales`, paced in
  `PACED_HOSTS`): `getWalesSites`, `getWalesNoise`, `getWalesCoast`, `getCoalTips` in `js/data-wales.js`, and `isWales(R)`
  branches in the checks. England-only fetches return early for Wales instead of asking England's servers.
- **Scotland:** the same topics plus crime use Historic Environment Scotland, NatureScot (`ogc.nature.scot`, also Dynamic
  Coast), SEPA, the Scottish Government and the Scottish Air Quality database: `getScotlandSites` (same shape as
  `getWalesSites`), `getScotlandNoise`, `getScotlandCoast`, `getWasteSites`, `getSimdCrime`, and `isScotland(R)`.
  `checkPlanningDevolved`/`checkNatureDevolved` serve Wales, Scotland and Northern Ireland (`sitesKey(R)`).
- **Northern Ireland:** planning, nature, noise and coast use the Department for Communities (Historic Environment
  Division) and DAERA (`gis.daera-ni.gov.uk`): `getNISites`, `getNINoise`, `getNICoast`, and `isNI(R)`. Use the official
  HED service, not the NIE Networks copies on ArcGIS Online. Flood maps, radon, landslides and coal are not open there.

## Backups

Used only when a service fails, never on a normal day.

- planning.data.gov.uk (England): `withBackup`/`planningBackup` (`js/backups.js`) ask Historic England (heritage,
  conservation areas), Natural England (nature) and Defra's copy of the Environment Agency Flood Map for Planning (flood
  zones at the pin and nearby, since 2.3.2). The answer rides
  on the failure as `R[key].backup`; only `checkPlanning`/`checkNature`/`checkFlood` read it (`backupFor`, `planningList`).
- Environment Agency map server, old landfill (England): `getLandfill` asks Defra's copy of the same register on
  ArcGIS Online (`API.landfillBackup`); the answer rides on the failure as `R.landfill.backup`, read by `checkLanduse`.
  Surface water, coast and noise have no trustworthy copy (checked 8 November 2026: only older or unofficial ones).
- postcodes.io: `placeFromOsm` gives the country and place from OpenStreetMap. Nominatim address search: Photon
  (`searchPhoton`, `js/search.js`).
- Any service: each task's answer is kept 7 days per place (`rememberAnswer`/`recentAnswer`, `js/run.js`), and the
  topic shows the place's last saved answer, dated (`savedInstead`).

## Data rules

- **Missing data is never good news:** when a source has published nothing (a police force, a council dataset, an
  empty national dataset), rate the topic `"manual"` (Check yourself), not `"low"` (No issue found). See
  `policeDataMissing` and `checkLanduse`.
- **Outside data stays live.** Save a copy in `data/` only for a finished official dataset that will never be
  revised (for example Census 2021), and ask the owner first. Say in `README.md` how the file was made.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): it refuses addresses that send more than
  about 15 requests a minute. Do not add requests to it, and keep its pacing in `PACED_HOSTS`. Backups use Defra's copies
  on ArcGIS Online instead: since 2.3.2 the flood zone backup (`floodZoneBackup`) too, which was the one exception before
  (owner, 7 November 2026; moved in the quiz of 8 November 2026).

## Adding a topic

A fetch function (in the country's `js/data*.js` file) and its row in `TASKS` (`js/tasks.js`), the check in its
section's `js/checks/` file, rows in `CHECKS` and `TOPIC_ICONS` (`js/checks/index.js`), `COVERAGE` (`js/coverage.js`)
if it does not cover all four countries, `SERVICES` and `SERVICE_TOPICS` in `tests/live/services.mjs`, and
`data/data-services.csv`.

**Countries a topic does not cover** (owner, 8 November 2026): the topic is left out of that country's reports.
`buildCheck` returns nothing, the card leaves the report, the grid, progress count and compare table count only
`shownChecks()`, and the country note in the summary names the left-out topics with links (`notCoveredNote()`,
`NATIONAL`). Missing data inside a covered country is still rated "Check yourself".

## Releases

Run `/release` (`.claude/skills/release/SKILL.md`). Any change to `index.html`, `status.html`, `glossary.html`, `css/`,
`js/`, `sw.js` or `data/` raises `APP_VERSION` (`js/core.js`) and `CACHE` (`sw.js`, `plc-vN`) together. In the same
commit, update `README.md`, and move the shipped items in `ROADMAP.md` into Part 1.
