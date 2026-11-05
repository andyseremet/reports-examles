# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.22.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 5 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Free for everyone: every feature stays free; support for the app's development is always voluntary (see
  [MONETISATION.md](MONETISATION.md)).
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

The [README](README.md) describes each feature in full.

---

## Part 1: What the app does today (version 1.22.0)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type.
- Map with street and satellite views, "my location" and full screen; a pin you can drag onto the exact property.
- Choice of nearby search distance (250 m to 2 km), in "More options".

### Topics checked (official open data)
| Group | Topics | Main sources |
|---|---|---|
| Flooding | Rivers and the sea; heavy rain (surface water) | Environment Agency; SEPA; Natural Resources Wales |
| Ground and land | Radon; coal mining; past use of the land; landslides; coastal erosion | BGS; UKHSA; Mining Remediation Authority; Environment Agency; planning.data.gov.uk |
| Living environment | Road noise; air quality; crime; recent sale prices | Defra; councils; Copernicus CAMS; data.police.uk; ONS; HM Land Registry |
| Planning and surroundings | Planning restrictions and heritage; protected trees and Article 4 areas; protected nature sites; schools, GPs, pharmacies and transport | planning.data.gov.uk; Natural England; DfE; NHS; NaPTAN |

Where a source has published nothing, the topic says "Check yourself", never "No issue found". Topics with no free
live data (for example rail and aircraft noise, Japanese knotweed) link to the official checkers.

### The report
- Five plain-English ratings: **Look into this / Worth checking / No issue found / For information / Check yourself**.
- Each topic says what it means, what to do next, and how current its data is.
- An overall verdict, a "Start here" list, and a box for every topic with no real answer and who to ask instead.
- **At the viewing:** up to 12 things to look for and ask on the day, reached with the **Viewing** button.
- A checklist for the seller and conveyancer; ticks are remembered for each property.
- **Email** or **Copy** the key points for your conveyancer. Nothing passes through the app.

### Reliability
- A failed topic is tried again after 20 seconds, then offers **Try again**.
- A report still loading after 8 seconds names the services it is waiting for.
- Careful pacing of requests to the Environment Agency map server, so it does not refuse them.
- Works with no signal: saved properties open, and a new check starts when the signal returns.

### Saved properties
- Saved on the device only; reopen instantly and refresh; results older than 3 months are marked.
- **Rename** and **Remove** buttons; Remove offers **Undo** for 10 seconds (1.22.0).
- Private notes that say "Saved ✓" after each change, a starred shortlist, and compare two properties side by side.
- Export and import to move the list to another device, with a backup reminder.

### Share, print and export
- **Share** links and the phone's share menu.
- **Save** menu: download the report, print a summary, or print the full report (or save as PDF).

### Comfort and access
- Dark mode, larger text (**A+ Text size**), and install as an app on a phone.
- Checked against accessibility standard WCAG 2.2 AA; last re-checked on 5 November 2026 (1.19.0).
- Privacy: no account, cookies or tracking.
- A **Data service status** page shows each data service's result in this morning's automatic check.

### Behind the scenes
- Plain files with no build step: `index.html`, `css/app.css` and `js/`.
- An automatic check runs every day against the live site, and on every pull request. A failure opens a "Live check
  failed" issue on GitHub.

---

## Part 2: Planned next steps

Chosen from the quiz on 5 November 2026, one item per version, in this order. Each is planned with a short quiz
before it is built. Each version keeps the same habits: bump the version number and the offline cache name together,
update the README, add new behaviour to the daily check, and never weaken a test to get a pass.

Versions 1.23.0 and 1.24.0 come from the UX review on 5 November 2026 (its first part shipped in 1.22.0): small changes that make the app easier to
use, with nothing removed. Each is followed by the accessibility re-check.

| Version | Idea | What it does | Why this order |
|---|---|---|---|
| 1.23.0 | Finding your way in the report | Section bar on a phone: a fade shows it scrolls, the current section stays in view, and one pinned button switches between Open all and Close all. Topic cards: a "Details ▾" label, a larger arrow and a highlight show they open. Count boxes in the summary jump to the first topic with that rating. | Helps first-time users find the detail in each topic. |
| 1.24.0 | Tidier long lists | Each checklist list shows "2 of 7 done". Export and Import fold into a "Move to another device" panel. | Shorter, calmer page on a phone. |
| 1.25.0 | Compare up to 3 properties | Compare side by side takes up to three saved properties instead of two; phone layout to be decided. | Builds on the existing compare view. |
| 1.26.0 | Fuller coverage for Wales | Fill topics that say "Check yourself" in Wales (7 today: land use, coast, noise, air, planning, trees, nature) where Welsh Government or Natural Resources Wales publish live open data. | Largest research task: each source must be checked first. |

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
