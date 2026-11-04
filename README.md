# Property Location Check

A free, single-page tool (`index.html`) for anyone buying a house or land in
England. Pick a location on the map and it checks official data for:

| Check | Source |
|---|---|
| Flooding from rivers and the sea (Flood Zones 1–3) | Environment Agency, via planning.data.gov.uk; SEPA (Scotland); Natural Resources Wales |
| Flooding from heavy rain (surface water) | Environment Agency (2025); SEPA (Scotland); Natural Resources Wales |
| Current flood warnings | Environment Agency real-time flood monitoring |
| Radon gas | BGS / UKHSA Radon Indicative Atlas |
| Coal mining | Mining Remediation Authority (formerly the Coal Authority) |
| Road traffic noise (day and night) | Defra strategic noise mapping, Round 4 |
| Air quality | Council Air Quality Management Areas; Copernicus CAMS model via Open-Meteo |
| Historic landfill | Environment Agency Historic Landfill Sites |
| Contaminated land, brownfield, major hazard (COMAH) sites | planning.data.gov.uk |
| Landslides | BGS National Landslide Database |
| Planning restrictions and heritage | planning.data.gov.uk |
| Protected nature sites | Natural England, via planning.data.gov.uk |
| Reported crime, and crime per 1,000 residents compared with England and Wales | data.police.uk; ONS boundaries; Census 2021 via Nomis; ONS crime and population figures |
| Schools, GP surgeries, pharmacies, railway stations, tram and bus stops | Department for Education and NaPTAN (via planning.data.gov.uk); NHS Organisation Data Service; NaPTAN rail stations (saved in `data/rail-stations.json`) |

Each result is given a plain-English rating (Look into this / Worth checking /
No issue found / For information / Check yourself), with what it means and what
to do next. Topics without free live data (surface water flooding, rail and
aircraft noise, Japanese knotweed and others) are listed with links to the
official checkers.

## How to use

1. Open the live page: https://andyseremet.github.io/reports-examles/
   (or open `index.html` in any browser; no installation needed).
2. Type a postcode, address or place. Pick a suggestion, or press Enter.
3. Check the pin is on the right property (drag it if not), then press
   **Check this property**.
4. Read the report: a verdict and "Start here" list, then results grouped into
   Flooding, Ground and land, Living environment, and Planning and
   surroundings, ending with a checklist for the seller and conveyancer.
5. Copy the link, download the report, or print / save it as a PDF.

## Features for easy use

- **Map:** on phones, scroll the page with one finger and move the map with two; on computers, use Ctrl (⌘ on Mac)
  + scroll to zoom. Full-screen map button, "my location" button, satellite and street backgrounds.
- **Report:** results appear topic by topic as the data arrives; any topic that fails has a **Try again** button.
  A section bar stays at the top while scrolling, with **Open all / Close all** and a back-to-top button.
- **Save and share:** every report is saved on your device (nothing is sent anywhere). Reopen saved properties,
  **compare two side by side**, tick off the checklist (remembered per property), and share with the phone's share menu.
- **Clear at a glance:** a row of topic icons shows every result's colour; on phones, tables become easy-to-read cards and
  "Check this property" stays at the bottom of the screen until pressed.
- **Back button:** returns from a report to the search and map, and closes the full-screen map.
- **Fair ratings:** old landfill and landslides are rated by distance (very close sites stand out; distant ones are for information).
- **Privacy:** no account, cookies or tracking; see "Privacy: what is sent where" at the bottom of the page.
- **Saved properties:** reopen instantly from saved results (with a refresh button), private notes, a starred shortlist,
  and export/import to move the list to another device.
- **Printouts:** a short "Print summary" option, and a QR code that opens the live report.
- **Comfort:** dark mode follows your device setting; **A+** makes text larger; **install as an app** on your phone's
  home screen (on iPhone: Share, then Add to Home Screen).

### Shareable links

- `?postcode=S70%202TA` runs the report for a postcode.
- `?lat=53.5542&lon=-1.4827&name=My%20house&r=1000` runs it for an exact
  point (`r` is the nearby search distance in metres: 250, 500, 1000 or 2000).

## Limits

This is a free first look using public data. It does not replace a building
survey or the searches a conveyancer orders. Most data covers England only.

## Automatic testing

A GitHub Actions workflow (`.github/workflows/live-check.yml`) runs `tests/live-check.mjs`:

- **Every day** against the live site. If anything fails (for example a government data service changes its
  address), it opens or updates a GitHub issue called "Live check failed" with the details.
- **On every pull request** that changes the page, against the proposed version, before it is merged.
- **By hand** from the Actions tab (Live check, then Run workflow).

It checks that all 21 data services still answer and allow web pages to read them, then opens the page on a
desktop, a phone and a tablet, runs reports (two fixed places and one random English postcode) and tests search,
full screen, the section bar, Back and Forward, saved reports and notes, printing and downloads. Results,
screenshots and sample reports are kept for 14 days with each run.

Run it yourself: `npm install playwright@1.49.1 && npx playwright install chromium && node tests/live-check.mjs`
(set `BASE` to test another address, for example a local copy).

### Updating the railway station list

`data/rail-stations.json` is the Department for Transport's NaPTAN list of railway stations (Open Government Licence),
saved with the app because the NaPTAN service cannot be read directly by web pages. Stations rarely change; to refresh it,
download `https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv&atcoAreaCodes=910` and keep the active `RLY` rows
(name, latitude, longitude).

