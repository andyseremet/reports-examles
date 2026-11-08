# Code

How the app's code is laid out and the rules for changing it. Read this before changing `js/`, `index.html`,
`status.html`, `glossary.html`, `sw.js` or `data/`, and before adding a topic.

## Layout

- `index.html` (the page), `css/app.css` (all styles), `sw.js` (offline support), `data/` (fixed data saved with the
  app). The README table "How the code is organised" says what each file holds.
- `js/`: plain scripts sharing one global scope (no modules), loaded by `index.html` in this order:
  1. `core.js`: sources, links, settings, `APP_VERSION`, helpers (`term()`, `GLOSSARY`)
  2. `data.js`: fetch functions, backups, `TASKS`
  3. `checks/flood.js`, `ground.js`, `living.js`, `planning.js`: one per report section
  4. `checks/index.js`: shared check helpers, `CHECKS`, `TOPIC_ICONS`, `COVERAGE`
  5. `search.js` (map, search) → `saved.js` (`store`, saved properties, compare, guide) → `report.js` (running the
     checks, recent answers, the report) → `print.js` (share, download, print) → `app.js` (larger text, install, start-up)

  Code that runs at load time may only use what an earlier file defines. A new JS file goes in `index.html` and in
  `SHELL` in `sw.js`.
- `glossary.html`: "What the words mean", plain HTML with no script. `term()` links a word to it through `GLOSSARY`
  (word → id); every id needs its `<dt id>` on the page (the daily check compares them).
- `status.html` + `js/status.js`: the data service status page, separate from the app (its own script). It reads
  `status.json` from the `status` branch, which the daily workflow publishes (`tests/publish-status.mjs`). A new row
  in `SERVICES` (`tests/live-check.mjs`) also needs its report topics in `SERVICE_TOPICS`.

## Countries

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

## Backups

Used only when a service fails, never on a normal day.

- planning.data.gov.uk (England): `withBackup`/`planningBackup` (`js/data.js`) ask Historic England (heritage,
  conservation areas), Natural England (nature) and the Environment Agency (flood zone at the pin). The answer rides
  on the failure as `R[key].backup`; only `checkPlanning`/`checkNature`/`checkFlood` read it (`backupFor`, `planningList`).
- Environment Agency map server, old landfill (England): `getLandfill` asks Defra's copy of the same register on
  ArcGIS Online (`API.landfillBackup`); the answer rides on the failure as `R.landfill.backup`, read by `checkLanduse`.
  Surface water, coast and noise have no trustworthy copy (checked 8 November 2026: only older or unofficial ones).
- postcodes.io: `placeFromOsm` gives the country and place from OpenStreetMap. Nominatim address search: Photon
  (`searchPhoton`, `js/search.js`).
- Any service: each task's answer is kept 7 days per place (`rememberAnswer`/`recentAnswer`, `js/report.js`), and the
  topic shows the place's last saved answer, dated (`savedInstead`).

## Data rules

- **Missing data is never good news:** when a source has published nothing (a police force, a council dataset, an
  empty national dataset), rate the topic `"manual"` (Check yourself), not `"low"` (No issue found). See
  `policeDataMissing` and `checkLanduse`.
- **Outside data stays live.** Save a copy in `data/` only for a finished official dataset that will never be
  revised (for example Census 2021), and ask the owner first. Say in `README.md` how the file was made.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): it refuses addresses that send more than
  about 15 requests a minute. Do not add requests to it, and keep its pacing in `PACED_HOSTS`. The one agreed exception
  (owner, 7 November 2026): the flood zone backup (`floodZoneBackup`), one request, only when planning.data.gov.uk fails.

## Adding a topic

A fetch function and its row in `TASKS` (`js/data.js`), the check in its section's `js/checks/` file, rows in
`CHECKS`, `TOPIC_ICONS` and `COVERAGE` (if it does not cover all of England, Wales and Scotland) in
`js/checks/index.js`, `SERVICES` and `SERVICE_TOPICS` in `tests/live-check.mjs`, and `data/data-services.csv`.

## Releases

Run `/release` (`.claude/skills/release/SKILL.md`). Any change to `index.html`, `status.html`, `glossary.html`, `css/`,
`js/`, `sw.js` or `data/` raises `APP_VERSION` (`js/core.js`) and `CACHE` (`sw.js`, `plc-vN`) together. In the same
commit, update `README.md`, and move the shipped items in `ROADMAP.md` into Part 1.
