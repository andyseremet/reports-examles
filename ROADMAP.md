# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.28.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 5 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Free for everyone: every feature stays free; support for the app's development is always voluntary (see
  [MONETISATION.md](MONETISATION.md)).
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

The [README](README.md) describes each feature in full.

---

## Part 1: What the app does today (version 1.28.0)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type.
- Map with street and satellite views, "my location" and full screen; a pin you can drag onto the exact property.
- Choice of nearby search distance (250 m to 2 km), in "More options".

### Topics checked (official open data)
| Group | Topics | Main sources |
|---|---|---|
| Flooding | Rivers and the sea; heavy rain (surface water) | Environment Agency; SEPA; Natural Resources Wales |
| Ground and land | Radon; coal mining; past use of the land (in Wales, disused coal tips; in Scotland, licensed waste sites); landslides; coastal erosion | BGS; UKHSA; Mining Remediation Authority; Environment Agency; planning.data.gov.uk; Welsh Government; Natural Resources Wales; SEPA; Dynamic Coast |
| Living environment | Road and rail noise; air quality; crime; recent sale prices | Defra; Welsh Government; Scottish Government; councils; Copernicus CAMS; data.police.uk; ONS; HM Land Registry |
| Planning and surroundings | Planning restrictions and heritage; protected nature sites; schools, GPs, pharmacies and transport | planning.data.gov.uk; Natural England; Cadw; Natural Resources Wales; Historic Environment Scotland; NatureScot; Department for Communities (NI); DAERA; DfE; NHS; NaPTAN |

**Wales (1.26.0):** land use, coastal erosion, noise, air quality, planning and nature are answered from Welsh data
(DataMapWales). Old landfill and contaminated land are not published for Wales, so land use says "Check yourself" unless a
disused coal tip is nearby.

**Scotland (1.27.0):** land use, coastal erosion, noise, air quality, planning, nature and crime are answered from Scottish
data (Historic Environment Scotland, NatureScot, SEPA, the Scottish Government and the Scottish Air Quality database).
Land use lists licensed waste sites; old landfill is not published, so with none nearby it says "Check yourself". Coastal
erosion uses Dynamic Coast's higher-emissions forecast. Crime uses the 2020 deprivation index (crimes recorded in 2017–18),
because Police Scotland publishes no street-level data. Sale prices stay "Check yourself": Registers of Scotland does not
publish them free. Scottish and Welsh reports no longer ask the busy Environment Agency map server anything.

**Northern Ireland (1.28.0):** planning and heritage (Department for Communities), protected nature sites, noise (Round 4)
and coastal erosion risk (DAERA and DfI) are answered from Northern Ireland data. Conservation areas are not published
nationally, so planning with nothing found says "Check yourself"; air quality shows the area estimate and says "Check
yourself", because council hotspots are not mapped. Flood maps (DfI Rivers does not release them openly), radon,
landslides, coal and old mines, land use and sale prices stay "Check yourself", with links to the right service.
Schools, doctors and transport now shows each register only where it reaches (it used to say "None found nearby" for GPs in
Scotland and for everything in Northern Ireland); in Northern Ireland it says "Check yourself" with links to nidirect,
Schools Plus and Translink.

Where a source has published nothing, the topic says "Check yourself", never "No issue found". Topics with no free
live data (for example rail and aircraft noise, Japanese knotweed) link to the official checkers.

### The report
- Five plain-English ratings: **Look into this / Worth checking / No issue found / For information / Check yourself**.
- Each topic says what it means, what to do next, and how current its data is.
- Topic cards show **Details ▾** (or **Hide ▴** when open); one **Open all / Close all** button stays on the section
  bar, which fades at the edge on a phone to show it scrolls (1.23.0).
- An overall verdict, count boxes that go to the first topic with that rating, a "Start here" list, and a box for every topic with no real answer and who to ask
  instead, which folds away with **Details / Hide** and starts closed when it lists more than 3 topics (1.25.0).
- **At the viewing:** up to 12 things to look for and ask on the day, reached with the **Viewing** button.
- A checklist for the seller and conveyancer; ticks are remembered for each property, and each list shows, for
  example, "2 of 7 done" (1.24.0).
- **Email** or **Copy** the key points for your conveyancer. Nothing passes through the app.

### Reliability
- A failed topic is tried again after 20 seconds, then offers **Try again**.
- A report still loading after 8 seconds names the services it is waiting for.
- Careful pacing of requests to the Environment Agency map server, so it does not refuse them.
- Works with no signal: saved properties open, and a new check starts when the signal returns.

### Saved properties
- Saved on the device only; reopen instantly and refresh; results older than 3 months are marked.
- **Rename** and **Remove** buttons; Remove offers **Undo** for 10 seconds (1.22.0).
- Private notes that say "Saved ✓" after each change, a starred shortlist, and compare two or three properties side by side, with a
  switch to show only the topics that differ (1.25.0).
- Export and import, in a **Move to another device** panel (1.24.0), with a backup reminder.

### Share, print and export
- **Share** links and the phone's share menu.
- **Save** menu: download the report, print a summary, or print the full report (or save as PDF).

### Comfort and access
- Dark mode, larger text (**A+ Text size**), and install as an app on a phone.
- Checked against accessibility standard WCAG 2.2 AA; last re-checked on 5 November 2026 (1.25.0, after the UX review
  changes in 1.22.0 to 1.24.0 and Compare up to 3).
- Privacy: no account, cookies or tracking.
- A **Data service status** page shows each data service's result in this morning's automatic check.

### Behind the scenes
- Plain files with no build step: `index.html`, `css/app.css` and `js/`.
- An automatic check runs every day against the live site, and on every pull request. A failure opens a "Live check
  failed" issue on GitHub.

---

## Part 2: Planned next steps

Nothing is scheduled: every item from the 5 November 2026 quizzes has shipped, including Scotland (1.27.0) and Northern Ireland (1.28.0). The next items will be chosen in a new quiz
round (Part 3 lists ideas). Each is planned with a short quiz before it is built, and each version keeps the same habits:
bump the version number and the offline cache name together, update the README, add new behaviour to the daily check,
and never weaken a test to get a pass.

### Voluntary support (not scheduled)

The app stays free for everyone. How voluntary support could be added later, as a separate module that can be
switched on or off with one line, is planned in [MONETISATION.md](MONETISATION.md).

---

## Part 3: Ideas for later and decisions

### Ideas for later

Suggested in a quiz but not chosen. They can be picked up in a future round.

| Idea | Notes |
|---|---|
| Past floods recorded here | Environment Agency Recorded Flood Outlines. Live, but adds 1 request to the busy Environment Agency map server. |
| Broadband and mobile coverage | Ofcom's data needs an account key, so only a "Check yourself" topic with links is possible. |
| Planning applications nearby | Not possible yet: planning.data.gov.uk has no planning application records (checked 5 November 2026). |

### Decided against

| Idea | Decision |
|---|---|
| Welsh language | Removed on 4 November 2026: the app stays in English only. |
| Remove "Download report" | Kept (4 November 2026); since 1.17.0 it is in the "Save" menu. |
| Remove the latitude and longitude boxes | Kept (4 November 2026), in More options. |
| Remove or reduce railway noise, landslides, aircraft | Kept as they are (4 November 2026). |
| Protected trees and Article 4 areas | Removed on 5 November 2026 (1.26.0): many councils do not publish them, and Wales has no national data. The conveyancer's local authority search covers them. |
| Power lines and pylons | Dropped on 5 November 2026: the data is mostly downloads, not live services, and it changes as lines are built. Buyers can use the official network maps instead. |
| Softer air quality rating | Kept as "Worth checking" for a council hotspot (4 November 2026). |

---

## Part 4: App review, 4 November 2026

The app was run on 8 very different places in England, and odd results were checked with the data services. It
found missing police data in Greater Manchester, empty national contaminated land data, and parts of topics that
failed silently; all were fixed in 1.12.0. Road noise flagged too often and is rated more fairly since 1.12.0.

**Known issues:** none at the moment.

## How this road map is updated

- After each quiz round, the chosen items go into Part 2 under the next version numbers.
- When a version is released, its items move into Part 1.
- Ideas not chosen go to Part 3.
