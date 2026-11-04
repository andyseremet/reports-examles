# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.10.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 4 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

---

## Part 1: What the app does today (version 1.10.0)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type.
- Map with street and satellite backgrounds, a "my location" button and a full-screen view.
- A pin you can drag onto the exact property, with a choice of nearby search distance (250 m, 500 m, 1 km or 2 km).
- Phone-friendly map: one finger scrolls the page, two fingers move the map; Ctrl (⌘) + scroll zooms on computers.

### Topics checked (official open data)
| Group | Topic | Source |
|---|---|---|
| Flooding | Rivers and the sea (Flood Zones 1–3) | Environment Agency; SEPA (Scotland); Natural Resources Wales |
| Flooding | Heavy rain (surface water, 2025 map) | Environment Agency; SEPA; Natural Resources Wales |
| Flooding | Current flood warnings | Environment Agency real-time flood monitoring |
| Ground and land | Radon gas | BGS / UKHSA Radon Indicative Atlas |
| Ground and land | Coal mining | Mining Remediation Authority |
| Ground and land | Historic landfill | Environment Agency |
| Ground and land | Contaminated land, brownfield, major hazard (COMAH) sites | planning.data.gov.uk |
| Ground and land | Landslides | BGS National Landslide Database |
| Living environment | Road traffic noise (day and night) | Defra noise mapping, Round 4 |
| Living environment | Air quality | Council Air Quality Management Areas; Copernicus CAMS via Open-Meteo |
| Living environment | Reported crime, and crime per 1,000 residents | data.police.uk; ONS; Census 2021 (saved with the app) |
| Planning and surroundings | Planning restrictions and heritage | planning.data.gov.uk |
| Planning and surroundings | Protected nature sites | Natural England, via planning.data.gov.uk |
| Planning and surroundings | Schools, GP surgeries, pharmacies, stations, tram and bus stops | DfE; NHS ODS; NaPTAN (rail stations saved with the app) |

Topics with no free live data (for example rail and aircraft noise, Japanese knotweed) are listed with links to
the official checkers. Topics not covered in Wales or Scotland say "Check yourself" and link to the national service.

### The report
- Plain-English ratings: **Look into this / Worth checking / No issue found / For information / Check yourself**.
- Each topic says what it means and what to do next, with questions for the seller and the conveyancer.
- Results appear topic by topic as the data arrives.
- An overall verdict and a "Start here" list.
- A row of topic icons: tap one to see the reason in one line.
- Each topic has a **Data:** line saying how current its data is.
- A section bar that stays at the top while scrolling, with Open all / Close all and back to top.
- Checklist for the seller and conveyancer, with ticks remembered for each property.

### Reliability
- A topic whose data fails is tried again by itself after 20 seconds, then offers **Try again**.
- Careful pacing of requests to the Environment Agency map server, so it does not refuse them.
- **No signal:** the app still opens, saved properties still open, and a check asked for while offline waits and
  starts by itself when the signal returns.

### Saved properties
- Every report is saved on the device only, nothing is sent anywhere.
- Saved reports reopen instantly, with a refresh button; results older than 3 months are marked.
- Private notes, a starred shortlist, and **compare two properties side by side**.
- Export and import, to move the list to another device.
- Backup reminder once you have 5 or more saved properties and no backup in 30 days.
- The app asks the browser to keep saved data, and says plainly if something could not be saved.

### Share, print and export
- Shareable links (`?postcode=` or `?lat=&lon=&name=&r=`) and the phone's share menu.
- Download the report, print it or save it as a PDF; a short "Print summary" option.
- A QR code on printouts that opens the live report.

### Comfort and access
- Dark mode follows the device setting; **A+** makes text larger.
- Install as an app on a phone's home screen; works offline for saved properties.
- Checked against accessibility standard WCAG 2.2 AA (light and dark, phone and desktop), with tap targets of at
  least 24 × 24 pixels.
- Back button returns from a report to the map and closes the full-screen map.
- Privacy: no account, cookies or tracking; "Privacy: what is sent where" explains every outside request.

### Behind the scenes
- An automatic check runs every day against the live site, and on every pull request before it is merged. It
  tests all 19 outside data services, the 2 data files saved with the app, and the full report on a desktop, a phone
  and a tablet. A failure opens a "Live check failed" issue on GitHub.

---

## Part 2: Planned next steps

Chosen from the quiz on 4 November 2026. Each version keeps the same habits: bump the version number and the
offline cache name together, update the README, add the new topic to the daily check, and never weaken a test to get
a pass.

### Version 1.11.0: Tree protection and Article 4, and "Send to my conveyancer"

**New topic: Tree protection and Article 4 areas** (Planning and surroundings)
- What it tells the buyer:
  - whether the property is in a **Tree Preservation Order** area, where cutting or pruning trees needs council
    consent;
  - whether it is in an **Article 4 area**, where some extensions and changes that normally need no planning
    permission do need it.
- Data: planning.data.gov.uk datasets `tree-preservation-zone` (about 111,000 areas), `tree` (about 273,000 single
  protected trees) and `article-4-direction-area` (about 7,600 areas). Checked live; this is the same service the app
  already uses, so no new outside connection.
- Honest limit to show in the report: not every council has published this data yet. Where nothing is found, the
  report should say "None published. Ask the council or your conveyancer", not "No issue found".
- England only.

**New tool: Send to my conveyancer**
- A button that opens the phone's or computer's email app with a ready-made message: the address, the report link,
  and the questions for the conveyancer and seller from the topics rated "Look into this" or "Worth checking".
- No new outside service: it uses a standard `mailto:` link, so nothing passes through the app.
- Also offered as **Copy text**, for people who use web email or messaging apps.

### Version 1.12.0: Coastal erosion

**New topic: Coastal erosion** (Ground and land)
- What it tells the buyer: whether the coast near the property is expected to retreat over the next 20, 50 or 100
  years.
- Data: Environment Agency **National Coastal Erosion Risk Mapping (NCERM) 2024**, which replaced the 2018–2021 map.
  It is published on the Defra Data Services Platform with WFS and OGC API Features services.
- Before building:
  - confirm that the service can be read directly by a web page, as other EA layers can;
  - confirm the licence on the Defra page, because data.gov.uk lists it as "No licence provided".
- Checked live, because the map is updated as new surveys come in.
- Shown only for locations near the coast; inland locations get a short "Not near the coast".
- Honest limit to show: the Environment Agency says the map is for guidance and cannot give details for single
  properties.

### Version 1.13.0: Power lines and pylons

**New topic: Power lines and pylons** (Living environment)
- What it tells the buyer: distance to high-voltage overhead lines, pylons and large substations nearby.
- Data to investigate first:
  - National Grid Electricity Distribution publishes 11 kV, 33 kV, 66 kV and 132 kV overhead lines and towers, but
    only for its own areas (Midlands, South West and South Wales), under its own Shared Data Licence.
  - The main 275 kV and 400 kV network (National Grid Electricity Transmission) is published as downloads, not as a
    live service.
- **Decision needed before building:** this data is mostly downloads, not live services, and new lines are built, so
  it is **not** fixed data. Under the data rule it should not be saved with the app. Options:
  1. use it only if a live service that web pages can read is found;
  2. or drop the topic and link to the official maps instead.
- England first, in line with the coverage choice.

---

## Part 3: Ideas parked for later

Suggested in the quiz but not chosen this time. They can be picked up in a future round.

| Idea | Notes |
|---|---|
| Sold prices nearby | HM Land Registry Price Paid data; changes monthly, so it would be a live check. |
| Compare 3 or more properties | Today the app compares two side by side. |
| Travel time to a chosen place | Distance and rough walking/driving time to work or a school. |
| Fuller coverage for Wales | Fill topics that say "Check yourself" in Wales. |
| Fuller coverage for Scotland | Fill topics that say "Check yourself" in Scotland. |
| Welsh language | Removed on 4 November 2026: the app stays in English only. |

## Known issues

- **Landslides (BGS):** since early November 2026 the British Geological Survey landslide service answers every
  question with "Failed to execute query", even simple ones. Radon on the same BGS server still works, so the fault
  is on their side. The app shows "Try again" for this topic until it recovers. No code change is planned unless BGS
  moves the service.

## How this road map is updated

- After each quiz round, the chosen items go into Part 2 under the next version numbers.
- When a version is released, its items move into Part 1.
- Ideas not chosen go to Part 3.
