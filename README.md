# Property Location Check

A free, single-page tool for anyone buying a house or land in
England, Wales, Scotland and Northern Ireland (some topics cover Great Britain only). Pick a location on the map and it checks official data for:

| Check | Source |
|---|---|
| Flooding from rivers and the sea (Flood Zones 1–3), with a "For information" line on flooding if a large reservoir failed (England, 2.3.0) | Environment Agency, via planning.data.gov.uk; SEPA (Scotland); Natural Resources Wales; reservoir flood maps: Environment Agency (Defra's copies on ArcGIS Online) |
| Flooding from heavy rain (surface water) | Environment Agency (2025); SEPA (Scotland); Natural Resources Wales |
| Past floods recorded at or within 250 m of the pin (England and Wales; not shown elsewhere, where nothing is published) | Environment Agency Historic Flood Map (Defra's copy on ArcGIS Online; areas only, no dates); Natural Resources Wales Historic Flood Map (each flood with its date, source and cause) |
| Radon gas | BGS / UKHSA Radon Indicative Atlas |
| Mining: coal, and other underground mining such as tin, copper, lead or iron (where it is known or likely, the topic asks for a mining search) | Mining Remediation Authority (formerly the Coal Authority); British Geological Survey, mining hazard (not including coal), 1 km overview |
| Shrinking and swelling clay, the most common cause of subsidence (England, Wales and Scotland) | British Geological Survey, GeoSure shrink-swell, 5 km overview |
| Road and railway noise (day and night) | Defra strategic noise mapping, Round 4; Welsh Government noise mapping 2022 (Wales); Scottish Government noise mapping, 2021 traffic, published by SEPA (Scotland); DAERA noise mapping, Round 4 (Northern Ireland) |
| Air quality: the area estimate is the main source, and council hotspots are added when their list answers (with either missing, the topic is at most "For information", never "No issue found") | Copernicus CAMS model via Open-Meteo (main); council Air Quality Management Areas (England via planning.data.gov.uk; Wales via DataMapWales; Scotland via the Scottish Air Quality database, with Scotland's own PM2.5 limit; Northern Ireland has no hotspot map) |
| Past use of the land: old landfill, brownfield sites, and contaminated land or major hazard (COMAH) sites where published; in Wales, disused coal tips; in Scotland, licensed waste sites | Environment Agency Historic Landfill Sites; planning.data.gov.uk; Welsh Government disused coal tips map (Wales); SEPA licensed waste sites (Scotland) |
| Landslides | BGS National Landslide Database |
| Coastal erosion by 2055 and 2105, and the shoreline plan for the coast nearby (Scotland: by 2050 and 2100) | Environment Agency National Coastal Erosion Risk Map (NCERM 2024); Natural Resources Wales NCERM (Wales); Dynamic Coast, higher-emissions forecast (Scotland); DfI and DAERA coastal erosion study, shoreline risk rating (Northern Ireland) |
| Planning restrictions and heritage | planning.data.gov.uk; in Wales, Cadw, council conservation areas and Natural Resources Wales (via DataMapWales); in Scotland, Historic Environment Scotland and the Scottish Government (National Parks and National Scenic Areas); in Northern Ireland, the Department for Communities' Historic Environment Division and DAERA (no national map of conservation areas, so "nothing found" says "Check yourself") |
| Protected nature sites | Natural England, via planning.data.gov.uk; Natural Resources Wales, including the Ancient Woodland Inventory 2021 (Wales); NatureScot, including the Ancient Woodland Inventory (Scotland); DAERA protected areas (Northern Ireland) |
| Reported crime, and crime per 1,000 residents compared with England and Wales (where the police force publishes its data); in Scotland, the small area's crime rank | data.police.uk; ONS boundaries; Census 2021 residents (saved in `data/census2021-msoa-residents.json`); ONS crime and population figures; Scottish Index of Multiple Deprivation 2020 crime domain (Scotland, crimes recorded in 2017–18) |
| Recent sale prices of homes within 500 m in the last 3 years: median price by type and the 10 most recent sales (England and Wales) | HM Land Registry Price Paid Data (Open Government Licence; contains HM Land Registry data © Crown copyright and database right) |
| Schools, GP surgeries, pharmacies, railway stations, tram and bus stops (each only where its register reaches: schools and stops England; GPs and pharmacies England and Wales; stations Great Britain; elsewhere the row says "Not covered" and links to the national service) | Department for Education and NaPTAN (via planning.data.gov.uk); NHS Organisation Data Service; NaPTAN rail stations (saved in `data/rail-stations.json`) |

Each result is given a plain-English rating (Look into this / Worth checking /
No issue found / For information / Check yourself), with what it means and what
to do next. Topics without free live data (surface water flooding, rail and
aircraft noise, Japanese knotweed and others) are listed with links to the
official checkers.

## How to use

1. Open the live page: https://andyseremet.github.io/reports-examles/
   (or serve a copy with `python3 -m http.server 8080` and open http://localhost:8080/; no installation needed).
2. Type a postcode, address or place in the box above the map. Pick a suggestion, or press Enter. On a first visit,
   a short guide shows the three steps.
3. Check the pin is on the right property (drag it if not), then press
   **Check this property**.
4. Read the report: a one-sentence verdict (with how many topics could not be checked), a "Key findings" panel of
   the things to look into, then results grouped into
   Flooding, Ground and land, Living environment, and Planning and
   surroundings, ending with a short list of things to look for and ask at the viewing, and a checklist for the seller and conveyancer.
5. Use the share and printer icons beside the Summary heading to send the link or print a 2-page summary, or
   **Download report** and **Print full report** under the summary to keep it (or save it as a PDF).

## Features for easy use

- **Map:** on phones, scroll the page with one finger and move the map with two; on computers, use Ctrl (⌘ on Mac)
  + scroll to zoom. Full-screen map button, "my location" button, satellite and street backgrounds.
- **Report:** results appear topic by topic as the data arrives. A request that fails is tried again at once (after a
  short pause); a topic whose request was not tried again is tried once more by itself after 8 seconds (20 if the
  service refused the request). If it still fails, it shows a **Try again** button, in its card and in the box under
  the topic grid. If this place was checked before, the topic shows that saved answer instead, clearly dated, still
  with **Try again**. In an outage (2.3.1): after 8 seconds a topic still waiting shows this place's answer from the
  last 7 days, if there is one, dated, until the live answer replaces it; after 45 seconds the report finishes, and a
  topic still waiting says "slow to answer" with **Try again**, and fills in by itself if its answer arrives later. When planning.data.gov.uk does not answer
  (England), heritage, conservation areas and nature are asked from Historic England and Natural England instead, and
  flood zones, at the pin and nearby, from Defra's copy of the Environment Agency's flood map (2.3.2); each topic names
  anything it could not check (Green Belt, HS2 and main rivers have no second open source). When the Environment Agency's map server does not
  answer, old landfill sites come from Defra's copy of the same register on ArcGIS Online. If postcodes.io does not answer, OpenStreetMap
  gives the country and place; if the address search does not answer, Photon does. Each service's answer for a place is
  kept on the device for 7 days and used, dated, only if that service fails. If the report is still loading after 8 seconds, the summary names the services it is waiting for, and their topics.
  A section bar stays at the top while scrolling, with one **Open problems / Close all** button that stays in view
  (Open problems opens only the topics rated Look into this or Worth checking); on a phone its edge fades to show that
  it scrolls. Each topic card shows **Details ▾** (or **Hide ▴** when open). The summary shows the topic grid (thin line icons; only topics to look into or check are coloured), the tapped
  topic's one-line reason right under it, then "Key findings". Every topic card starts closed; **Open problems** opens
  the ones that matter. Every rating has a symbol as well as a
  colour (❗ Look into this, ⚠️ Worth checking, ✓ No issue found, ℹ️ For information, ? Check yourself), and topics with
  no issue found fold into one row at the end of their section. Once a report is open, the search map and saved list
  shrink to one line above it ("📍 Barnsley test · Change · Saved (3)"). The map inside the report is always shown (4:3), so it
  is ready when printed; each topic opens with its finding in bold and "What to do", with "What we found" and "What this means"
  behind **More**; lists of sites and sales show
  the first 3, then **Show all** (one line per row on a phone). Notes, the viewing checklist and the checklist sit in
  one **Next steps** section, each folded with its count. On a phone, a bar at the bottom of the screen jumps to
  Summary, Problems (it opens the topics to look into), All topics and Next steps. On bigger screens there is also a
  back-to-top button (on a phone, the tab bar's Summary does that). The map coordinates of the pin show on bigger
  screens and in the printed report.
- **Save and share:** every report is saved on your device (nothing is sent anywhere). Reopen saved properties,
  **compare two or three side by side** (with a switch to show only the topics that differ), tick off the checklists (remembered per property; each list shows, for example, "2 of 7 done"), and share with the phone's share menu.
- **Clear at a glance:** a row of topic icons shows every result's colour; tap one to see the reason in one line,
  with a link to the full section. On phones, tables become easy-to-read cards and
  "Check this property" stays at the bottom of the screen until pressed.
- **Back button:** returns from a report to the search and map, and closes the full-screen map.
- **Plain words:** the "What the words mean" page explains 33 words used in the report (flood zone, radon, CON29M,
  conservation area and more). Explained words link to it, as do the report and the footer; it prints on its own.
- **How current the data is:** the "Data sources and dates" table at the end gives each topic's source and date, for
  example "Crimes reported in September 2026" or "Noise maps published by Defra in 2022". Saved results older than 3 months are marked, with a suggestion to refresh.
- **Accessibility:** checked against WCAG 2.2 AA with the axe-core checker (light and dark mode, phone and desktop,
  normal and larger text, down to 320 px wide), plus keyboard focus, focus never hidden behind sticky bars, and tap
  target sizes (at least 24 × 24 pixels). Last re-checked on 8 November 2026 (version 2.0.6): no problems found.
- **Send to my conveyancer:** one button opens your email app with the report link, the topics to look into, and the
  searches and questions from the checklist. **Copy** does the same for web email or messaging apps. Nothing
  passes through the app.
- **Honest gaps:** where a source has published nothing (for example old landfill sites and contaminated land in Wales and Scotland, or flood maps in Northern Ireland),
  the report says so and rates the topic "Check yourself", instead of "No issue found".
- **Fair ratings:** old landfill and landslides are rated by distance (very close sites stand out; distant ones are for information).
  Road and railway noise is flagged only when loud (a 24-hour average of 65 dB or more, or 55 dB at night); moderate
  levels above the WHO recommendation are shown for information.
- **No false "all clear":** where a police force has not published crime data (Greater Manchester Police since March
  2025), the crime topic says so and links to the force. Contaminated land is not published nationally, so the app
  never reports it as clear. If part of a topic fails (for example the school search), it is tried again and, if still
  missing, named in the topic's summary line.
- **Privacy:** no account, cookies or tracking; see "Privacy: what is sent where" at the bottom of the page.
- **Saved properties:** reopen instantly from saved results (with a refresh button), private notes (marked "Saved on
  this device", with "Saved ✓" after each change), a starred shortlist, **Rename** and **Remove** buttons (Remove offers
  **Undo** for 10 seconds), and export/import to move the list to another device (in the **Move to another device** panel, closed until needed;
  since 2.3.3 an imported file keeps only plain values, and its properties get a fresh report when opened). Saved properties live only in the browser, so the app asks the
  browser to keep them, says plainly if something could not be saved (for example, storage full or a private window),
  and suggests **Download a backup** once you have 5 or more saved properties and no backup in the last 30 days.
- **No signal:** the app still opens and saved properties still open. A check asked for while offline waits, with a
  message at the top, and starts by itself when the signal returns.
- **Share, print and keep:** share and printer icons on the Summary heading's line (Print summary: 2 pages, the cover,
  key findings and the topic table), and **Download report** and **Print full report** under the summary. Printouts open with the property's details, a centred 4:3 map with a caption, a
  "Key findings" box (the most serious results), a table of every topic grouped by section (rating and finding, with a
  key) and a link and QR code to the live report. The full report adds a one-line contents and a lined notes page at the end. Sections are numbered and run on with space between them; the viewing checklist
  prints as its own page to take along; each rating also has its own border pattern for black-and-white printers; the
  sources form a neat table at the end; app instructions are left out. Every page carries the place, date, a short
  disclaimer and page numbers (Chrome and Edge).
- **Comfort:** dark mode follows your device setting; **A+ Text size** makes text larger (just "A+" on a phone); **install as an app** on your phone's
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

A static site with no build step and two small libraries: Leaflet (the map) and qrcode-generator (the QR code on the printed report, added 1.35.0 with the owner's OK). GitHub Pages serves it as it is.

| File | What it holds |
|---|---|
| `index.html` | The page itself (search, map, report layout, footer). |
| `css/app.css` | All the page styles, including dark mode and print. |
| `js/core.js` | Links, settings, the version number and shared helpers. |
| `js/api.js` | Outside data service addresses, request pacing and the fetch helpers. |
| `js/store.js` | Saving in the browser and the key for a place (no page drawing). |
| `js/data.js` | Fetching data for England, and the shared fetch helpers. |
| `js/backups.js` | Backups used only when planning.data.gov.uk does not answer. |
| `js/data-wales.js`, `data-scotland.js`, `data-ni.js` | Fetching data for Wales, Scotland and Northern Ireland. |
| `js/national.js` | The national services for Scotland, Wales and Northern Ireland, for topics their data does not cover. |
| `js/sources.js` | Data several topics share (the place, planning.data.gov.uk lists, Scottish and Welsh flood maps, heritage and nature lists). |
| `js/topics/<id>.js` | One file per topic (16): its own data, how it is rated and worded, its icon and viewing tips. |
| `js/topics/helpers.js` | Helpers the topics share: wording for a failed or backed-up source, country tests, flood zone wording. |
| `js/topics/index.js` | The list of report topics in report order, with the sections. |
| `js/card.js`, `js/kit.js` | For other apps (not loaded by the main page): a plain topic card, and the kit with `checkPlace` and the `<plc-topic>` tag. The guide for other apps is `docs/KIT.md`. |
| `kit/index.html`, `kit/v1/` | The demo page for other apps, and the fixed copy of the kit they load (version 1, the code of 2.7.1). |
| `js/tasks.js` | The data tasks, built from the topics and the shared data, in the order they start. |
| `js/coverage.js` | Which countries each topic covers; topics not covered in a country are left out of its reports. |
| `js/runner.js` | The runner: runs the checks for one place (chosen topics or all), with one retry, recent answers kept 7 days and the 45-second deadline; it never touches the page. |
| `js/map.js` | The map: background maps, map buttons, full screen, the pin and the search circle. |
| `js/search.js` | The search box (suggestions, Nominatim and Photon). |
| `js/saved.js` | Saved properties on this device, compare, and the first-visit guide. |
| `js/run.js` | The report on the page: starting a check, drawing each topic as it arrives, Try again, and saved reports. |
| `js/summary.js` | The summary: the verdict, the topic grid, the box under it and key findings. |
| `js/report.js` | The topic cards, the report layout, the printed cover, data sources and the report map. |
| `js/next-steps.js` | Next steps: notes, the viewing checklist, the checklist and Send to my conveyancer. |
| `js/navigation.js` | The section bar, Open problems / Close all, the phone tab bar and back to top. |
| `js/print.js` | Share, download and print. |
| `js/app.js` | Larger text, install as an app, and start-up (shared links). |
| `js/page-names.js` | The app names the daily check reads from the page (modules keep names to themselves). |
| `status.html`, `js/status.js` | The data service status page: a separate page with its own small script. |
| `glossary.html` | "What the words mean": a plain page with no script; `GLOSSARY` in `js/core.js` links words to it. |
| `sw.js` | Offline support: keeps the app files so it opens without a connection. |
| `data/` | Fixed official data saved with the app (see below). |
| `tests/` | The automatic live check, the syntax check (`node tests/syntax-check.mjs`), `publish-status.mjs`, which builds the status page's file, `after-merge.sh`, which waits for a merged version to go live and then tests it (skipped when only documents changed), `digest.mjs`, a short summary of a run, and `a11y-check.mjs`, the accessibility scan (by hand after visual changes, and on every pull request). The live check's parts are in `tests/live/`: settings, results, recording, the data services, country data, the three devices and the summary. |

The JavaScript files are modules (since 2.4.0), with no build step: each file imports what it uses from other files
and exports what they use. `js/page-names.js` lets the daily check read app names from the page. The plan is to make
each topic usable on its own in other small apps (see the road map, Part 2).

Guides for working on the app: `docs/CODE.md` (code), `docs/DESIGN.md` (look and wording), `docs/TESTING.md` (tests and
checks) and `docs/WORKFLOW.md` (plans, pull requests, merges), with `CLAUDE.md` as the short summary and `REVIEW.md` for
code reviews.

## Automatic testing

A GitHub Actions workflow (`.github/workflows/live-check.yml`) runs `tests/live-check.mjs`:

- **Every day** against the live site. If an app step fails, it opens or updates a GitHub issue called "Live check
  failed"; if a government data service does not answer (for example after changing its address), one called "Data
  services down". Each closes after the next run in which its own part passes.
- **On every pull request** that changes the page, against the proposed version, before it is merged. Its reports are
  answered from the outside services' answers recorded by the daily run (saved on the `status` branch, each kept up
  to 14 days), so an outside outage cannot turn a pull request red; a question never recorded is asked live and named
  in the results.
  Pull requests also run the accessibility scan (`tests/a11y-check.mjs`) at the same time, on a second machine.
- **By hand** from the Actions tab (Live check, then Run workflow).

It checks that all 50 outside data services and the 2 data files saved with the app still answer and allow web pages to read them (on pull requests, at the owner's request, it leaves out the 46 that only supply report data, listed in `data/data-services.csv`; run it by hand to test them), then opens the page on a
desktop, a phone and a tablet, runs reports (two fixed places and one random English postcode) and tests search,
full screen, the offline message, the section bar, the topic icons, the share and print icons, the no-issue folds and Open problems / Close all, the one-line bar above the report, the report map (always shown, 4:3), More and Show all, the folded Next steps, the phone tab bar, the Historic England, Natural England and Defra landfill backups and saved answers when a service is down, coastal erosion on an eroding coast, the "still waiting for" note on a slow report, the viewing checklist, Send to my conveyancer, Back and Forward, saved reports and notes, Remove and Undo, the checklist counts, the Move to another device panel,
printing and downloads (layout steps run on all three devices; steps that do not depend on the screen size run once, on the desktop). The map data for Wales, Scotland and Northern Ireland, nearby places and sale prices, past floods and reservoir flooding, and the rule that missing
data is never "No issue found" (noise, clay and mining with a failed service), the runner on its own (a radon-only run that asks only its data and draws nothing), that every topic file has the same parts, and the kit for other apps (the demo page's cards and flood app, with the latest kit and the fixed copy v1) are tested once, on the desktop page (they do not depend on the screen size, and they must
send nothing to the Environment Agency map server). The test browser is saved between runs, and its extra system files
are installed only if it does not start without them. Results,
screenshots and sample reports are kept for 14 days with each run.

The Environment Agency map server (surface water, noise, landfill, coastal erosion) briefly refuses an address that sends more
than about 15 requests a minute, which happens to GitHub's shared test machines. The test therefore asks that server's
data services one at a time and, when the reports ask it live (no recording), waits a minute before each report, and the page itself sends at most 2 requests at a time to that server, gives it 35 seconds to
answer and retries a refusal or a slow answer. DataMapWales, Historic Environment Scotland, NatureScot, SEPA and DAERA
get the same treatment with up to 4 requests at a time and 30 seconds to answer. A topic that still fails is tried once more by the page after 20
seconds, unless its request was already tried again. If it then shows "Try again", the test opens its card and presses it once, as a person would (a separate step
checks the Try again under the topic grid with a topic made to fail); a topic that still fails after
that fails the test.

That server sometimes refuses GitHub's shared test machines outright ("403 Forbidden") for many minutes while
answering everyone else. That refusal, and only that, is shown as a **warning** (⚠️ in the summary) instead of a
failure, so it does not open an issue. Any other problem with that server, such as an error, a slow answer or wrong
content, still fails the check. If the warning appears for several days in a row, check the live site by hand.

After each daily (or manual) run on `main`, a separate step publishes each data service's result to the `status`
branch (`status.json`, with 7 days of history). The [data service status page](https://andyseremet.github.io/reports-examles/status.html)
reads that file, so a buyer can see when a topic is down for everyone. Pull request runs do not publish.

Run it yourself: `npm install playwright@1.63.0 && npx playwright install chromium && node tests/live-check.mjs`
(set `BASE` to test another address, for example a local copy; set `PAUSE_MS=0` to skip the pauses; set
`REPLAY=daily` to answer the reports from the daily recording). With a recording, the data services (6 at a time), the
map data checks and the three devices run at the same time: under a minute instead of 4 to 8. `QUICK=1` checks the
data services and the desktop only (used after a merge). To find a fault faster, `ONLY=desktop` (or `services`,
`country`, `phone`, `tablet`) and `STEP="part of a step name"` run just part of it. `node tests/digest.mjs` then
prints the failures and the slowest steps in a few lines; every summary starts with an "In short" line that tells an
outside outage from a fault in the app.

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

`data/data-services.csv` is a reference list, not used by the app: the 46 outside services that supply data for the
report topics (name, and the exact link the daily check calls, for a test location). It leaves out the postcode lookup, the address search and their backups
(the app needs them to find the place) and the two files above. It was made from `SERVICES` in
`tests/live/services.mjs` (then in `tests/live-check.mjs`) on 7 November 2026; that list is the one to keep current, so remake this file after changing it.
