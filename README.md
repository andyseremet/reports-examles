# Property Location Check

A free, single-page tool for anyone buying a house or land in
England. Pick a location on the map and it checks official data for:

| Check | Source |
|---|---|
| Flooding from rivers and the sea (Flood Zones 1–3) | Environment Agency, via planning.data.gov.uk; SEPA (Scotland); Natural Resources Wales |
| Flooding from heavy rain (surface water) | Environment Agency (2025); SEPA (Scotland); Natural Resources Wales |
| Radon gas | BGS / UKHSA Radon Indicative Atlas |
| Coal mining | Mining Remediation Authority (formerly the Coal Authority) |
| Road traffic noise (day and night) | Defra strategic noise mapping, Round 4 |
| Air quality | Council Air Quality Management Areas; Copernicus CAMS model via Open-Meteo |
| Past use of the land: old landfill, brownfield sites, and contaminated land or major hazard (COMAH) sites where published | Environment Agency Historic Landfill Sites; planning.data.gov.uk |
| Landslides | BGS National Landslide Database |
| Coastal erosion by 2055 and 2105, and the shoreline plan for the coast nearby | Environment Agency National Coastal Erosion Risk Map (NCERM 2024) |
| Planning restrictions and heritage | planning.data.gov.uk |
| Protected trees (Tree Preservation Orders) and Article 4 areas, and whether the council publishes this data | Councils, via planning.data.gov.uk |
| Protected nature sites | Natural England, via planning.data.gov.uk |
| Reported crime, and crime per 1,000 residents compared with England and Wales (where the police force publishes its data) | data.police.uk; ONS boundaries; Census 2021 residents (saved in `data/census2021-msoa-residents.json`); ONS crime and population figures |
| Recent sale prices of homes within 500 m in the last 3 years: median price by type and the 10 most recent sales (England and Wales) | HM Land Registry Price Paid Data (Open Government Licence; contains HM Land Registry data © Crown copyright and database right) |
| Schools, GP surgeries, pharmacies, railway stations, tram and bus stops | Department for Education and NaPTAN (via planning.data.gov.uk); NHS Organisation Data Service; NaPTAN rail stations (saved in `data/rail-stations.json`) |

Each result is given a plain-English rating (Look into this / Worth checking /
No issue found / For information / Check yourself), with what it means and what
to do next. Topics without free live data (surface water flooding, rail and
aircraft noise, Japanese knotweed and others) are listed with links to the
official checkers.

## How to use

1. Open the live page: https://andyseremet.github.io/reports-examles/
   (or serve a copy with `python3 -m http.server 8080` and open http://localhost:8080/; no installation needed).
2. Type a postcode, address or place. Pick a suggestion, or press Enter.
3. Check the pin is on the right property (drag it if not), then press
   **Check this property**.
4. Read the report: a verdict, a "Start here" list of things to look into, and a
   "Where we could not give an answer" box listing topics with no answer and who to ask instead, then results grouped into
   Flooding, Ground and land, Living environment, and Planning and
   surroundings, ending with a checklist for the seller and conveyancer.
5. Press **Share** to copy or send the link, or **Save or print** to download the report, print a summary, or
   print / save the full report as a PDF.

## Features for easy use

- **Map:** on phones, scroll the page with one finger and move the map with two; on computers, use Ctrl (⌘ on Mac)
  + scroll to zoom. Full-screen map button, "my location" button, satellite and street backgrounds.
- **Report:** results appear topic by topic as the data arrives. A topic whose data fails is tried once more by itself
  after 20 seconds; if it fails again, it shows a **Try again** button.
  A section bar stays at the top while scrolling, with **Open all / Close all** and a back-to-top button.
- **Save and share:** every report is saved on your device (nothing is sent anywhere). Reopen saved properties,
  **compare two side by side**, tick off the checklist (remembered per property), and share with the phone's share menu.
- **Clear at a glance:** a row of topic icons shows every result's colour; tap one to see the reason in one line,
  with a link to the full section. On phones, tables become easy-to-read cards and
  "Check this property" stays at the bottom of the screen until pressed.
- **Back button:** returns from a report to the search and map, and closes the full-screen map.
- **How current the data is:** each topic shows a **Data:** line, for example "Crimes reported in September 2026" or
  "Noise maps published by Defra in 2022". Saved results older than 3 months are marked, with a suggestion to refresh.
- **Accessibility:** checked against WCAG 2.2 AA with the axe-core checker (light and dark mode, phone and desktop,
  normal and larger text, down to 320 px wide), plus keyboard focus, focus never hidden behind sticky bars, and tap
  target sizes (at least 24 × 24 pixels). Last re-checked on 5 November 2026 (version 1.19.0).
- **Send to my conveyancer:** one button opens your email app with the report link, the topics to look into, and the
  searches and questions from the checklist. **Copy as text** does the same for web email or messaging apps. Nothing
  passes through the app.
- **Honest gaps:** where a council has not published its protected trees or Article 4 areas, the report says so and
  rates the topic "Check yourself", instead of "No issue found".
- **Fair ratings:** old landfill and landslides are rated by distance (very close sites stand out; distant ones are for information).
  Road and railway noise is flagged only when loud (a 24-hour average of 65 dB or more, or 55 dB at night); moderate
  levels above the WHO recommendation are shown for information.
- **No false "all clear":** where a police force has not published crime data (Greater Manchester Police since March
  2025), the crime topic says so and links to the force. Contaminated land is not published nationally, so the app
  never reports it as clear. If part of a topic fails (for example the school search), it is tried again and, if still
  missing, named in the topic's summary line.
- **Privacy:** no account, cookies or tracking; see "Privacy: what is sent where" at the bottom of the page.
- **Saved properties:** reopen instantly from saved results (with a refresh button), private notes, a starred shortlist,
  and export/import to move the list to another device. Saved properties live only in the browser, so the app asks the
  browser to keep them, says plainly if something could not be saved (for example, storage full or a private window),
  and suggests **Download a backup** once you have 5 or more saved properties and no backup in the last 30 days.
- **No signal:** the app still opens and saved properties still open. A check asked for while offline waits, with a
  message at the top, and starts by itself when the signal returns.
- **Save or print:** one menu with Download report, Print summary (the summary, notes and checklist) and Print full
  report, each with a one-line description.
- **Comfort:** dark mode follows your device setting; **A+** makes text larger; **install as an app** on your phone's
  home screen (on iPhone: Share, then Add to Home Screen).

### Shareable links

- `?postcode=S70%202TA` runs the report for a postcode.
- `?lat=53.5542&lon=-1.4827&name=My%20house&r=1000` runs it for an exact
  point (`r` is the nearby search distance in metres: 250, 500, 1000 or 2000).

## Road map

See [ROADMAP.md](ROADMAP.md) for the full feature list and the planned next versions. The app is free for everyone; how voluntary
support could be added later, without changing what the app offers, is in [MONETISATION.md](MONETISATION.md).

## Limits

This is a free first look using public data. It does not replace a building
survey or the searches a conveyancer orders. Most data covers England only.

## How the code is organised

A static site with no build step and no libraries other than Leaflet (the map). GitHub Pages serves it as it is.

| File | What it holds |
|---|---|
| `index.html` | The page itself (search, map, report layout, footer). |
| `css/app.css` | All the page styles, including dark mode and print. |
| `js/core.js` | Data source addresses, links, settings, the version number and shared helpers. |
| `js/data.js` | Fetching data from the outside services, and the list of data tasks. |
| `js/checks/flood.js`, `ground.js`, `living.js`, `planning.js` | The topics in each report section: turning data into plain-English results. |
| `js/checks/index.js` | Shared check helpers and the list of report topics. |
| `js/app.js` | The map, search, running the checks, the report, saved properties, sharing and start-up. |
| `status.html`, `js/status.js` | The data service status page: a separate page with its own small script. |
| `sw.js` | Offline support: keeps the app files so it opens without a connection. |
| `data/` | Fixed official data saved with the app (see below). |
| `tests/` | The automatic live check, the syntax check (`node tests/syntax-check.mjs`), `publish-status.mjs`, which builds the status page's file, and `after-merge.sh`, which waits for a merged version to go live and then tests it. |

The JavaScript files are plain scripts that share one global scope. `index.html` loads them in order, and each file
can use what earlier files define.

## Automatic testing

A GitHub Actions workflow (`.github/workflows/live-check.yml`) runs `tests/live-check.mjs`:

- **Every day** against the live site. If anything fails (for example a government data service changes its
  address), it opens or updates a GitHub issue called "Live check failed" with the details.
- **On every pull request** that changes the page, against the proposed version, before it is merged.
- **By hand** from the Actions tab (Live check, then Run workflow).

It checks that all 23 outside data services and the 2 data files saved with the app still answer and allow web pages to read them, then opens the page on a
desktop, a phone and a tablet, runs reports (two fixed places and one random English postcode) and tests search,
full screen, the offline message, the section bar, the topic icons, coastal erosion on an eroding coast, Send to my conveyancer, Back and Forward, saved reports and notes,
printing and downloads. Results,
screenshots and sample reports are kept for 14 days with each run.

The Environment Agency map server (surface water, noise, landfill, coastal erosion) briefly refuses an address that sends more
than about 15 requests a minute, which happens to GitHub's shared test machines. The test therefore waits a minute
before each report, and the page itself sends at most 2 requests at a time to that server, gives it 35 seconds to
answer and retries a refusal or a slow answer. A topic that still fails is tried once more by the page after 20
seconds. If it then shows "Try again", the test presses it once, as a person would; a topic that still fails after
that fails the test.

That server sometimes refuses GitHub's shared test machines outright ("403 Forbidden") for many minutes while
answering everyone else. That refusal, and only that, is shown as a **warning** (⚠️ in the summary) instead of a
failure, so it does not open an issue. Any other problem with that server, such as an error, a slow answer or wrong
content, still fails the check. If the warning appears for several days in a row, check the live site by hand.

After each daily (or manual) run on `main`, a separate step publishes each data service's result to the `status`
branch (`status.json`, with 7 days of history). The [data service status page](https://andyseremet.github.io/reports-examles/status.html)
reads that file, so a buyer can see when a topic is down for everyone. Pull request runs do not publish.

Run it yourself: `npm install playwright@1.49.1 && npx playwright install chromium && node tests/live-check.mjs`
(set `BASE` to test another address, for example a local copy; set `PAUSE_MS=0` to skip the pauses).

### Updating the railway station list

`data/rail-stations.json` is the Department for Transport's NaPTAN list of railway stations (Open Government Licence),
saved with the app because the NaPTAN service cannot be read directly by web pages. Stations rarely change; to refresh it,
download `https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv&atcoAreaCodes=910` and keep the active `RLY` rows
(name, latitude, longitude).


### Census 2021 residents (fixed, saved with the app)

`data/census2021-msoa-residents.json` holds the number of usual residents in each of the 7,264 local areas
(middle layer super output areas, MSOA 2021) of England and Wales, from the Office for National Statistics Census 2021
(table TS001, Nomis dataset `NM_2021_1`, Open Government Licence). A census is never re-counted, so these figures do not
change and do not need refreshing. They were downloaded from
`https://www.nomisweb.co.uk/api/v01/dataset/NM_2021_1.data.csv?date=latest&geography=TYPE152&c2021_restype_3=0&measures=20100&select=geography_code,obs_value`.
When the 2031 Census is published, it would be a new, separate file.
