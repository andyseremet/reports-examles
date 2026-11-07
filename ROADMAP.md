# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.35.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 7 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Free for everyone: every feature stays free; support for the app's development is always voluntary (see
  [MONETISATION.md](MONETISATION.md)).
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

The [README](README.md) describes each feature in full.

---

## Part 1: What the app does today (version 1.35.0)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type.
- Map with street and satellite views, "my location" and full screen; a pin you can drag onto the exact property.
- Choice of nearby search distance (250 m to 2 km), in "More options".

### Topics checked (official open data)
| Group | Topics | Main sources |
|---|---|---|
| Flooding | Rivers and the sea; heavy rain (surface water) | Environment Agency; SEPA; Natural Resources Wales |
| Ground and land | Radon; mining, coal and other (tin, copper, lead, iron and so on, from the British Geological Survey, 1.32.0); shrinking and swelling clay (1.32.0); past use of the land (in Wales, disused coal tips; in Scotland, licensed waste sites); landslides; coastal erosion | BGS; UKHSA; Mining Remediation Authority; Environment Agency; planning.data.gov.uk; Welsh Government; Natural Resources Wales; SEPA; Dynamic Coast |
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
nationally, so planning with nothing found says "Check yourself"; air quality shows the area estimate and, because council hotspots are not mapped,
says "For information" (since 1.33.0; before, "Check yourself"). Flood maps (DfI Rivers does not release them openly), radon,
landslides, coal and old mines, land use and sale prices stay "Check yourself", with links to the right service.
Schools, doctors and transport now shows each register only where it reaches (it used to say "None found nearby" for GPs in
Scotland and for everything in Northern Ireland); in Northern Ireland it says "Check yourself" with links to nidirect,
Schools Plus and Translink.

Where a source has published nothing, the topic says "Check yourself", never "No issue found". Topics with no free
live data (for example rail and aircraft noise, Japanese knotweed) link to the official checkers.

### The report
- Five plain-English ratings: **Look into this / Worth checking / No issue found / For information / Check yourself**.
- Each topic says what it means, what to do next, and how current its data is.
- Topic cards show **Details ▾** (or **Hide ▴** when open); one **Open problems / Close all** button stays on the
  section bar, which fades at the edge on a phone to show it scrolls (1.23.0; Open problems since 1.29.0).
- Every rating has a symbol as well as a colour (❗ ⚠️ ✓ ℹ️ ?), and topics with no issue found fold into one row at the
  end of their section (1.29.0). A phone report with topics closed went from 17 to 12 screens.
- Shorter reports (1.30.0): once a report is open, the search map and saved list shrink to one line ("Barnsley test ·
  Change · Saved (3)"); the map inside the report appears after **Show map**; in each topic, "What this means" and the
  source fold behind **More**; lists of sites and sales show the first 3, then **Show all**, as one-line rows on a
  phone. A phone report with topics closed went from 12 to about 8 screens.
- **Phone tab bar** (1.31.0): Summary · Problems (N) · All topics · Next steps at the bottom of the screen on phones.
  Problems opens the topics to look into and goes to the first.
- An overall verdict, the topic grid with one legend line of rating counts (1.29.0, replacing the count boxes), a "Start here" list, and a box for every topic with no real answer and who to ask
  instead, which folds away with **Details / Hide** and starts closed when it lists more than 3 topics (1.25.0).
- **Next steps** (1.30.0): notes, the viewing checklist and the checklist, each folded with its count ("0 of 11 done").
- **At the viewing:** up to 12 things to look for and ask on the day, reached with the **Viewing** button.
- A checklist for the seller and conveyancer; ticks are remembered for each property, and each list shows, for
  example, "2 of 7 done" (1.24.0).
- **Email** or **Copy** the key points for your conveyancer. Nothing passes through the app.

### Reliability
- A failed topic is tried again after 20 seconds, then offers **Try again**.
- Backups (1.30.1, after planning.data.gov.uk was down for a day): when it does not answer, heritage and nature come
  from Historic England and Natural England, and the topic names what it could not check. A topic whose service does
  not answer shows this place's last saved answer, dated, with **Try again**. Since 1.31.1 the flood zone at the pin
  comes from the Environment Agency's own flood map, and Past use of the land names the sites it could not check.
- Air quality (1.33.0, owner's request): the Open-Meteo area estimate is the main source and the council hotspot list
  (planning.data.gov.uk in England) adds to it, so the topic still answers when either is down. Only with both answering
  can it say "No issue found".
- More backups (1.34.0, first step to 2.0): conservation areas from Historic England's map when planning.data.gov.uk
  is down; the country and place from OpenStreetMap when postcodes.io is down; Photon when the address search is down;
  and each service's answer for a place kept on the device for 7 days, used (dated) only if that service fails.
- Printed report (1.35.0): page 1 has the property's details, a centred square map with a "Figure 1" caption, the
  verdict and a table of every topic grouped by section, with a key to the ratings; sections are numbered, topic cards
  have more space between them, and rating colours always print; a "Key findings" box, a link and QR code to the live report,
  the viewing checklist as its own page, a neat sources table and black-and-white friendly border patterns, all in a
  calm Apple-like style (system font, hairline borders, rounded panels, generous space between cards and sections); every page
  shows the place, date, "A first look from public data, not a survey" and "Page 2 of 6" (Chrome and Edge); no app
  instructions on paper; the sections run on continuously, with extra space before each one.
- A report still loading after 8 seconds names the services it is waiting for.
- Careful pacing of requests to the Environment Agency map server, so it does not refuse them.
- Requests to the Welsh, Scottish and Northern Ireland map servers (including SEPA, since 1.28.1) go a few at a time,
  with a 30-second wait and one more try, so a slow moment does not leave a topic unanswered.
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

### Priority: the road to version 2.0 (health check and quiz of 7 November 2026)

Version 2.0 is the planned final version. It comes in four steps (1.34.0 the backups and 1.35.0 the printed report shipped on 7 November 2026); each is built, tested (full check and accessibility
check) and merged by the owner before the next one starts. Every item below was chosen in the quiz.

| Step | Priority | What changes | Why |
|---|---|---|---|
| **1.36.0 Ease of use** | 3 | **Visible search box** above the map, always shown (today it sits behind the map's 🔍 button). | First-time users looked for a search box and missed the button. |
| | 3 | **3-step guide** on the first visit: 1 Search · 2 Check the pin · 3 Read your report; hidden after the first report. | Anyone can start without reading help text. |
| | 3 | **Plain-words glossary**: its own "What the words mean" page (like the status page), linked from each term, the report and the footer, and printable. | One place for flood zone, radon, AQMA, CON29M, conservation area and the rest. |
| | 3 | **Fewer "i" buttons**: one short visible sentence instead, keeping "i" only for long explanations. | Fewer taps and less hidden text. |
| **2.0.0 Final** | 4 | **Split `js/app.js`** (about 2,000 lines) into a few smaller files (search, report, saved, print), with no build step and the same behaviour. | Easier and safer to change later. |
| | 4 | **Steady pull request checks**: reports are built from recorded answers, so outside outages never turn a pull request red. The daily check stays fully live. | During the 6–7 November outage, every pull request was red for reasons outside the app. |
| | 4 | **Final review**: the app run on places in all four countries, the accessibility check, README and road map brought up to date. | A clean 2.0. |

**No open backup exists** (health check, 7 November 2026), so these topics keep saying clearly what could not be
checked during an outage: Green Belt, HS2 safeguarding, schools (the national school list is only a download file),
bus and tram stops (the NaPTAN service does not let web pages read it), council air pollution hotspots in England
(Defra's map does not let web pages read it; air quality still answers from the Open-Meteo estimate), contaminated land,
noise, radon, coal, police data and sale prices.

**Health check notes:** all 65 help links open (police.uk, Ofcom, NHS inform and Historic England refuse automated
checks but open for people); issue #46 "Live check failed" is the planning.data.gov.uk outage and closes when it recovers.

Each step keeps the same habits: plan first, bump the version number and the offline cache name together, update the
README, add new behaviour to the daily check, and never weaken a test to get a pass. Other ideas are listed in Part 3.

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
| Air quality backup when planning.data.gov.uk is down | Not possible (7 November 2026): Defra's UK-wide Air Quality Management Area map (ukair.maps.rcdo.co.uk, run by WSP) answers correctly but tells browsers not to let other web pages read it (no CORS). It could be used if Defra opens it to web pages. Since 1.33.0 the topic answers from the Open-Meteo estimate during an outage anyway. |
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

**Second review, 7 November 2026** (1.31.1, while planning.data.gov.uk was down): Cardiff, Leith (Edinburgh), Belfast,
Camborne (Cornwall), Hull, rural Highlands, Merthyr Tydfil and Happisburgh. Every topic answered or said why not; the
backups covered heritage, nature and flood zones. Hull centre showed Flood Zone 1: checked with the Environment Agency
directly, its map has a gap at that spot, with Flood Zone 3 about 100 m away (the topic notes that nearby zones were not
checked during the outage). Fixed: "1 crimes", the AONB acronym, and the wording of unchecked lists.

**Known issues:** none at the moment.

## How this road map is updated

- After each quiz round, the chosen items go into Part 2 under the next version numbers.
- When a version is released, its items move into Part 1.
- Ideas not chosen go to Part 3.
