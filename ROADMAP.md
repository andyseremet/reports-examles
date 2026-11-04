# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.13.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 4 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

---

## Part 1: What the app does today (version 1.13.0)

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
| Ground and land | Radon gas | BGS / UKHSA Radon Indicative Atlas |
| Ground and land | Coal mining | Mining Remediation Authority |
| Ground and land | Past use of the land: old landfill, brownfield, and contaminated land or major hazard sites where published | Environment Agency; planning.data.gov.uk |
| Ground and land | Landslides | BGS National Landslide Database |
| Ground and land | Coastal erosion: whether the property is in the area the coast is expected to reach by 2055 or 2105, and the shoreline plan for the coast nearby | Environment Agency NCERM 2024 |
| Living environment | Road traffic noise (day and night) | Defra noise mapping, Round 4 |
| Living environment | Air quality | Council Air Quality Management Areas; Copernicus CAMS via Open-Meteo |
| Living environment | Reported crime, and crime per 1,000 residents (where the police force publishes data) | data.police.uk; ONS; Census 2021 (saved with the app) |
| Planning and surroundings | Planning restrictions and heritage | planning.data.gov.uk |
| Planning and surroundings | Protected trees (Tree Preservation Orders) and Article 4 areas | Councils, via planning.data.gov.uk |
| Planning and surroundings | Protected nature sites | Natural England, via planning.data.gov.uk |
| Planning and surroundings | Schools, GP surgeries, pharmacies, stations, tram and bus stops | DfE; NHS ODS; NaPTAN (rail stations saved with the app) |

Councils publish protected trees and Article 4 areas themselves, and many have not yet. The app checks whether the
council for the location has published them: if not, the topic says "Check yourself" instead of "No issue found".

Coastal erosion is checked within 1 km of the property; inland it says "Not near the coast". The Environment Agency
says its map is a national guide and cannot give exact details for a single property, and the report says so.

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
- **Send to my conveyancer:** opens your email app with the report link, the topics to look into and the checklist,
  or copies the same text. Nothing passes through the app.

### Reliability
- A topic whose data fails is tried again by itself after 20 seconds, then offers **Try again**.
- If part of a topic fails (for example the school search), that part is tried again; if still missing, the summary
  line names it.
- No false "all clear": missing police data and unpublished contaminated land are shown as gaps, not as good news.
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

### Comfort and access
- Dark mode follows the device setting; **A+** makes text larger.
- Install as an app on a phone's home screen; works offline for saved properties.
- Checked against accessibility standard WCAG 2.2 AA (light and dark, phone and desktop), with tap targets of at
  least 24 × 24 pixels.
- Back button returns from a report to the map and closes the full-screen map.
- Privacy: no account, cookies or tracking; "Privacy: what is sent where" explains every outside request.

### Behind the scenes
- An automatic check runs every day against the live site, and on every pull request before it is merged. It
  tests all 22 outside data services, the 2 data files saved with the app, and the full report on a desktop, a phone
  and a tablet. A failure opens a "Live check failed" issue on GitHub.

---

## Part 2: Planned next steps

Chosen from the quiz on 4 November 2026. Each version keeps the same habits: bump the version number and the
offline cache name together, update the README, add the new topic to the daily check, and never weaken a test to get
a pass.

### Version 1.14.0: Power lines and pylons

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

### Chosen next ideas (not yet given a version number)

| Idea | What it does |
|---|---|
| Data gaps box | A short box at the top of the report listing the topics where the app could not give a real answer (no data published, not covered, or a service down), and who to ask instead. |
| Simpler print options | One "Print or save as PDF" button with a choice of short summary or full report, instead of separate buttons. |
| Sold prices nearby | Recent sale prices within the search distance, from HM Land Registry Price Paid data (Open Government Licence). It changes monthly, so it would be a live check. Before building, confirm a web page can read it directly. |
| Data service health page | A simple page showing which outside data services worked in today's automatic check, so a buyer can see when a topic is down for everyone. |

---

## Part 3: Ideas parked for later

Suggested in the quiz but not chosen this time. They can be picked up in a future round.

| Idea | Notes |
|---|---|
| Compare 3 or more properties | Today the app compares two side by side. |
| Travel time to a chosen place | Distance and rough walking/driving time to work or a school. |
| Fuller coverage for Wales | Fill topics that say "Check yourself" in Wales. |
| Fuller coverage for Scotland | Fill topics that say "Check yourself" in Scotland. |
| Welsh language | Removed on 4 November 2026: the app stays in English only. |
| Remove "Download report" | Considered on 4 November 2026 and kept; may be covered by "Simpler print options". |
| Remove the latitude and longitude boxes | Considered on 4 November 2026 and kept, in Advanced options. |
| Remove or reduce railway noise, landslides, aircraft | Considered on 4 November 2026 and kept as they are. |
| Softer air quality rating | Considered on 4 November 2026; the council hotspot stays "Worth checking". |

## Known issues

- None at the moment. Fixed in 1.12.0: crime in Greater Manchester (the police force publishes no data) and the
  contaminated land topic that always said "No issue found".

## Part 4: App review, 4 November 2026

The app was run on 8 very different places in England (central London, Hull, Great Yarmouth, the Lake District,
central Manchester, Truro, Milton Keynes and Cambridge), and odd results were checked directly with the data
services.

**Weaknesses caused by outside data**

| Problem | Evidence | Decision |
|---|---|---|
| Greater Manchester Police has published no crime data since March 2025 | 2 crimes within a mile of central Manchester, against about 1,500 in central Leeds; confirmed by the [data.police.uk changelog](https://data.police.uk/changelog/) | Fixed in 1.12.0 |
| National contaminated land and major hazard datasets are empty | 0 records on planning.data.gov.uk; the topic said "No issue found" in 8 of 8 places | Merged into "Past use of the land" in 1.12.0 |
| A part of a topic that fails is left out silently | The Cambridge school search timed out once; the summary line just left schools out | Retried and named in 1.12.0 |
| Air quality model times out at times | It failed on the first try in 2 of 8 places; the automatic retry fixed both | Already handled |
| Councils publish unevenly (trees, Article 4) | Hull, Manchester and Cornwall publish none | Already handled ("Check yourself") |
| Environment Agency map server limits requests | Its 4 topics were the slowest requests (5 to 8 seconds) | Keep the pacing; avoid adding requests to it. Coastal erosion (1.13.0) adds one small request per report, and a second only for properties in an erosion area |
| Data service outages | BGS landslides were down for several days in November 2026 | Already handled ("Try again", daily check) |

**Ratings that flag too often:** road noise was flagged in 7 of 8 places and air quality in 4 of 8. Road noise is
rated more fairly since 1.12.0; air quality stays as it is.

## How this road map is updated

- After each quiz round, the chosen items go into Part 2 under the next version numbers.
- When a version is released, its items move into Part 1.
- Ideas not chosen go to Part 3.
