# Code

How the app's code is laid out and the rules for changing it. Read this before changing `js/`, `index.html`,
`status.html`, `glossary.html`, `sw.js` or `data/`, and before adding a topic.

## Layout

- `index.html` (the page), `css/app.css` (all styles), `sw.js` (offline support), `data/` (fixed data saved with the
  app). The README table "How the code is organised" says what each file holds.
- `js/`: JavaScript modules (since 2.4.0, still no build step). Each file starts with `import { … } from "./file.js"`
  for what it uses from other files and ends with `export { … }` for what other files use; a name only one file uses
  stays private to it. A variable that changes (`let`) lives in the one file that changes it (other files only read
  it). `index.html` loads only `main.js` (2.7.2), which loads the main app's parts in this order (the topics load
  through their list, `topics/index.js`):
  1. `core.js` (links, settings, `APP_VERSION`, helpers such as `term()` and `GLOSSARY`) → `api.js` (`API`,
     `PACED_HOSTS`, `fetchJSON`, `arcgisRequest`) → `store.js` (`store` for browser storage, `reportKey`)
  2. `data.js` (shared fetch helpers: the place, map queries, planning.data.gov.uk, flood maps for Scotland and Wales)
     → `backups.js` → `data-wales.js` → `data-scotland.js` → `data-ni.js` (each country's shared helpers and
     heritage and nature lists) → `national.js` (`NATIONAL`) → `sources.js` (`SHARED_DATA`: data several topics read)
  3. `topics/helpers.js` (helpers the topics share: `unavailable`, backup notes, country tests, flood zone wording) →
     one file per topic, `topics/<id>.js` (below) → `topics/index.js` (`CHECKS` in report order, `GROUPS`, and
     `TOPIC_ICONS`, `VIEWING_LOOK` and `COVERAGE` read from the topics) → `tasks.js` (`TASK_ORDER`, `TASKS`, `TASK_FN`)
  4. `coverage.js` (`topicShown`, `shownChecks()`, `notCoveredNote()`) → `runner.js` (the runner, below)
  Not on `index.html`: `card.js` (a plain topic card for other apps) and `kit.js` (what other apps load: `checkPlace`
  and the `<plc-topic>` tag; `docs/KIT.md`). The demo page is `kit/index.html`; fixed copies are `kit/v<N>/`.
  5. `map.js` → `search.js` → `saved.js` (saved properties, compare, guide) → `run.js` (the report on the page:
     starting a check, drawing each topic as it arrives, Try again, saved reports) → `summary.js` (verdict, topic grid, why box) → `report.js` (topic
     cards, layout, sources) → `next-steps.js` → `navigation.js` → `print.js` (share, download, print) → `app.js`
     (larger text, install, start-up)

  One job per file (owner, 8 November 2026). Code that runs at load time (outside a function) may only use what an
  earlier file defines, as before: two files that import each other are allowed, but only for use inside functions.
  A new JS file is imported by the file that uses it (a main-app part that only adds listeners goes in `main.js`),
  and goes in `SHELL` in `sw.js`; the syntax check names any file missing from `SHELL`.
  `js/page-names.js` puts the app names the daily check reads from the page on `window` (modules keep names to
  themselves); a test that reads a new name needs it listed there.
- **The runner** (`js/runner.js`, 2.5.0): runs the checks for one place and never touches the page.
  `startRun(loc, { checks, previous, onUpdate })` asks only the data tasks the chosen topics need (all topics by
  default), tries a failed task once more, shows a recent answer after 8 seconds and stops waiting at 45 seconds.
  After each task settles it calls `onUpdate({ key, changed, done })`; `js/run.js` draws what changed. Try again is
  `clearForRetry(id)` then `restartTasks(keys)`. The runner and the files it imports (`core`, `store`, `api`, the
  data files, `sources`, `topics/`, `tasks`, `coverage`) must not use `document` or the page's elements. Runs from
  other apps pass `main: false` and run beside the main report; every runner function takes its run.
- **Paths from the file, never the page** (2.7.0): a file the kit loads finds its neighbours with
  `new URL("../data/…", import.meta.url)`, because inside another app the page's address is that app's.
- **Fixed kit copies** (`kit/v<N>/`, owner, 8 November 2026): made by `node tests/freeze-kit.mjs v<N>` at a release
  and never changed afterwards, except by hand to follow an outside service that changed its address (noted in
  `docs/KIT.md`). A change to what the kit offers makes a new version folder. `v1` is the code of 2.7.1.
- **Modular plan** (owner, 8 November 2026; `ROADMAP.md`, Part 2): step by step, each topic becomes one file that
  other small apps can use on its own. Step 1 (2.4.0) is the switch to modules, step 2 (2.5.0) the runner, step 3
  (2.6.0) one file per topic, step 4 (2.7.0) the plain card, the kit and `<plc-topic>`, step 5 (2.7.1) the guide
  for other apps, `docs/KIT.md`.
- `glossary.html`: "What the words mean", plain HTML with no script. `term()` links a word to it through `GLOSSARY`
  (word → id); every id needs its `<dt id>` on the page (the daily check compares them).
- `status.html` + `js/status.js`: the data service status page, separate from the app (its own script). It reads
  `status.json` from the `status` branch, which the daily workflow publishes (`tests/publish-status.mjs`). A new row
  in `SERVICES` (`tests/live/services.mjs`) also needs its report topics in `SERVICE_TOPICS`.

## Countries

- **Which country:** fetches ask `inWales`, `inScotland` and `inNI` (`js/data.js`), from postcodes.io, or
  OpenStreetMap when it has no postcode within 2 km or does not answer. Inside a country's box, a place whose country
  cannot be found throws ("the country of this place could not be found right now"), so the topic says it could not
  be checked: never England data for a pin that may be in Wales or Scotland (code review, 2.3.3).
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

Each topic is one file, `js/topics/<id>.js` (2.6.0), holding everything about it: the fetch functions only it uses,
how it is rated and worded (its build function and helpers), and at the end one object, `<id>Topic`:

```js
const radonTopic = {
  id: "radon", group: "ground", title: "Radon gas",
  countries: ["England", "Wales", "Scotland"],      // leave out for all four countries
  data: { radon: ["Radon gas", getRadon, "British Geological Survey"] },   // its own data tasks
  deps: ["radon"],                                  // all the data it reads, shared data included ("place" is added)
  build: checkRadon,
  icon: ['<path …/>', "Radon"],                     // 24 × 24 line drawing and its short name
  viewing: ["A radon sump or a small vent pipe outside, …"]   // optional
};
```

To add one (2.7.2):

1. Write `js/topics/<id>.js`, copying a similar topic (the file name is the topic's id).
2. In `js/topics/index.js`, import `<id>Topic` and put it in `CHECKS` where it goes in the report.
3. Run `node tests/syntax-check.mjs` and do what it lists: the file's line in `SHELL` (`sw.js`), and its data service
   in `SERVICES` and `SERVICE_TOPICS` (`tests/live/services.mjs`) and `data/data-services.csv`. It says "Syntax OK"
   when nothing is missing. Optionally, add its data keys to `TASK_ORDER` in `js/tasks.js` (a key not listed starts
   last).

To remove one: delete its file, take it out of `js/topics/index.js`, remove its test steps (`tests/live/`), then run
the syntax check and do what it lists (its line in `SHELL`, its names in `js/page-names.js`). Data that
several topics read goes once in `SHARED_DATA` (`js/sources.js`), with its fetch function in the country's
`js/data*.js` file. The daily check's "Topic files" step checks that every topic has the same parts and that each data
task is defined once and read by some topic.

**Countries a topic does not cover** (owner, 8 November 2026): the topic is left out of that country's reports.
`buildCheck` returns nothing, the card leaves the report, the grid, progress count and compare table count only
`shownChecks()`, and the country note in the summary names the left-out topics with links (`notCoveredNote()`,
`NATIONAL`). Missing data inside a covered country is still rated "Check yourself".

## Releases

Run `/release` (`.claude/skills/release/SKILL.md`). Any change to `index.html`, `status.html`, `glossary.html`, `css/`,
`js/`, `sw.js` or `data/` raises `APP_VERSION` (`js/core.js`) and `CACHE` (`sw.js`, `plc-vN`) together. In the same
commit, update `README.md`, and move the shipped items in `ROADMAP.md` into Part 1.
