# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Property Location Check: a free, plain-English report on a house or land location (mainly England) built from
official open data. It is a static site with no build step, served by GitHub Pages from `main` at
https://andyseremet.github.io/reports-examles/. The app is meant for non-technical home buyers, so user-facing text
stays plain English and jargon-free (ratings: Look into this / Worth checking / No issue found / For information /
Check yourself).

## Commands

There is no build, linter or package.json. Playwright is installed only for testing.

```bash
# Serve locally (the service worker and fetch() of data/*.json need http, not file://)
python3 -m http.server 8080

# Quick syntax check of the app script and the service worker
node -e "new Function(require('fs').readFileSync('index.html','utf8').split('<script>').slice(-1)[0].split('</script>')[0])"
node --check sw.js

# Full end-to-end check (the same one GitHub runs daily and on pull requests)
npm install --no-save playwright@1.49.1 && npx playwright install chromium
BASE=http://localhost:8080/ PAUSE_MS=0 node tests/live-check.mjs   # local copy, no pauses
node tests/live-check.mjs                                          # the live site
```

The live check takes about 6 minutes with the default pauses. There is no way to run a single step: to check one
behaviour, write a short Playwright script in a scratch folder, and route
`https://environment.data.gov.uk/spatialdata/**` to an empty answer so it finishes fast. Environment variables:
- `BASE`: the address to test.
- `OUT`: the folder for screenshots and results (default `test-results/`, gitignored).
- `PAUSE_MS`: the wait before each report (default 60000).

## Architecture

All app code is in `index.html` (HTML, CSS and one `<script>`), split into banner-commented sections: DATA
SOURCES, HELPERS, MAP, SEARCH, DATA RETRIEVAL, CHECKS, STORAGE, RUN THE CHECKS, REPORT, SAVED PROPERTIES AND
COMPARE, SHARE/EXPORT/PRINT, COMFORT, START. Leaflet 1.9.4 (unpkg) is the only outside library.

**The report pipeline is a two-stage dependency graph:**
- `API` holds every outside endpoint. `LINKS` holds human-facing links.
- `TASKS` is `[key, label, fetchFn]`. Each fetch function takes `loc` (`{name, lat, lon, radius}`) and returns raw
  data. `startTask` runs every task in parallel and stores `run.R[key] = {ok, value | error}`.
- `CHECKS` is `{id, group, title, deps:[taskKeys], build}`. When a task settles, `onTaskSettled` builds every check
  whose `deps` are all ready. `build(R)` returns a result object
  `{id, group, title, status, found, details, meaning, actions[], seller[], conveyancer[], source:{name,url}, dataDate}`.
  Use `unavailable(base, R, key)` for a failed data task.
- `COVERAGE` restricts topics to countries (England / Wales / Scotland). Topics not covered become
  "Check yourself" with a link to the national service.
- Results render into slots as they arrive. `renderSummary()` (counts, the topic icon strip, the tap-to-see-why
  box, "Start here") re-renders on every settle. `finishRun()` runs when every task has settled. It saves the
  property, a snapshot of the results, and the checklist and sources.
- Adding a topic means: a fetch function, a `TASKS` row, a `CHECKS` row, a `TOPIC_ICONS` entry, a `COVERAGE` entry
  if it is national, and a service row in `tests/live-check.mjs`.

**Network behaviour (deliberate, keep it):**
- `fetchJSON` has per-host pacing via `PACED_HOSTS`. The Environment Agency `spatialdata` server allows at most 2
  requests at a time with a 300 ms gap, a 35 s timeout and retries on 403 or timeout. That server refuses addresses
  that send more than about 15 requests a minute.
- `startTask` retries a failed task once by itself: after 20 s, or when the device comes back online. A manual
  "Try again" (`[data-retry]`) does not retry automatically again.
- When the device is offline, `runChecks` queues the run (`queuedRun`) and the `online` event starts it.

**State is in the browser only, with no backend.** `store` wraps localStorage and shows `#storageBar` when a write
fails. Keys:
- `plc-saved-v1`: the saved list, at most 20 entries; starred entries are always kept.
- `plc-snap:<key>`: saved results, so a saved property reopens instantly.
- `plc-notes:<key>` and `plc-ticks:<key>`: per-property notes and checklist ticks.
- `plc-backup-at` and `plc-backup-later`: backup reminder dates.

`reportKey(loc)` is `lat,lon,radius` to 5 decimals. Shareable links use `?lat=&lon=&name=&r=`. Export/import moves
all of the above as one JSON file.

**Fixed data saved with the app (`data/`):**
- `rail-stations.json` (NaPTAN): saved because the service cannot be read by web pages.
- `census2021-msoa-residents.json`: Census 2021 residents per MSOA. It never changes.

The owner's rule: store outside data locally only when it is certain never to change. Everything else (flood,
radon, coal, landfill, landslides, noise, crime, air, planning) stays a live request. The README explains how each
file was made.

Never turn missing outside data into good news. A police force that publishes nothing, or a council that has not
published a dataset, must show as "Check yourself", not "No issue found" (see `policeDataMissing`, `checkTrees` and
`checkLanduse`).

**Service worker (`sw.js`):**
- The page is network-first. The `SHELL` files (page, icons, Leaflet, rail stations) are cache-first.
- `FIXED_DATA` (the census file) is cached the first time it is used.
- Live data and map tiles are never cached.

## Release conventions

Every user-visible change bumps two things together:
- `APP_VERSION` in `index.html`, shown in the footer, for example `1.12.0`.
- `CACHE` in `sw.js` (`plc-vN`), so phones pick up the new page.

Update `README.md` (feature list and "Automatic testing") in the same change.

## Testing and CI

`tests/live-check.mjs` checks every outside service (the `SERVICES` list) and both saved data files. It then runs
the same steps on three `DEVICES`:
- Desktop: S70 2TA
- iPhone 13: CF11 7HW (Wales)
- iPad: a random English postcode

The steps are search, full-screen map, offline queue, a full report, the topic strip and why box, data dates,
Back/Forward, saved snapshot with notes, print/download, saved list readability, no sideways scroll, and no page
errors. `record()` statuses:
- pass
- fail
- `"warn"`: only for the EA map server refusing GitHub's machines with 403. A warning does not fail the run.

A failed report topic gets one "Try again" click before it counts as a failure. Never weaken or skip a step to get
a green run.

`.github/workflows/live-check.yml` runs this test:
- daily at 05:17 UTC
- on `workflow_dispatch`
- on pull requests: it serves the PR's version on `localhost:8080`

A failed scheduled or manual run opens or updates a "Live check failed" issue. Outside services (BGS, EA, Open-Meteo)
have occasional outages. Before changing code because of a failure, query the service directly to see whether the
fault is theirs.
