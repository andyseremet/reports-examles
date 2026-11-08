# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **2.0.9** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 8 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Free for everyone: every feature stays free; support for the app's development is always voluntary (see
  [MONETISATION.md](MONETISATION.md)).
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

The [README](README.md) describes each feature in full.

---

## Part 1: What the app does today (version 2.0.9)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type. The search box is always shown above the
  map (1.36.0; before, it sat behind the map's 🔍 button), and moves into the map in full screen.
- A **3-step guide** on the first visit: 1 Search · 2 Check the pin · 3 Read your report; hidden after the first
  report (1.36.0).
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
- **Easier reading** (1.36.0): a "Key findings" panel at the top (replacing "Start here"); each topic opens with its
  finding in bold, then "What to do", with "What we found" and "What this means" behind **More**; data dates and
  sources only in the table at the end; lines of about 70 characters on wide screens.
- **Calm screen** (1.36.0): the system font, white cards with a hairline and one thin rating accent, lighter topic
  tiles, and the verdict as one clear sentence, following the visual style in docs/DESIGN.md.
- **Fewer "i" buttons** (1.36.0): short explanations (checking the pin, saved properties, section intros) are one
  visible sentence; "i" stays only for long help.
- **What the words mean** (1.36.0): a printable glossary page of 33 words (flood zone, radon, CON29M, conservation
  area and more), linked from explained words, the report and the footer.
- Topic cards show **Details ▾** (or **Hide ▴** when open); one **Open problems / Close all** button stays on the
  section bar, which fades at the edge on a phone to show it scrolls (1.23.0; Open problems since 1.29.0).
- Every rating has a symbol as well as a colour (❗ ⚠️ ✓ ℹ️ ?), and topics with no issue found fold into one row at the
  end of their section (1.29.0). A phone report with topics closed went from 17 to 12 screens.
- Shorter reports (1.30.0): once a report is open, the search map and saved list shrink to one line ("Barnsley test ·
  Change · Saved (3)"); the map inside the report appeared after **Show map** (always shown again, 4:3, since 1.36.0 so it prints with its pictures loaded); in each topic, "What this means" and the
  source fold behind **More**; lists of sites and sales show the first 3, then **Show all**, as one-line rows on a
  phone. A phone report with topics closed went from 12 to about 8 screens.
- **Phone tab bar** (1.31.0): Summary · Problems (N) · All topics · Next steps at the bottom of the screen on phones.
  Problems opens the topics to look into and goes to the first.
- An overall verdict with a short second line (how many checks found no issue and how many topics could not be
  checked), the topic grid and the "Key findings" panel. Since 2.0.4 (owner, 8 November 2026) the rating count chips
  and the "Where we could not give an answer" box are gone: each topic still says what it could not check.
- **Next steps** (1.30.0): notes, the viewing checklist and the checklist, each folded with its count ("0 of 11 done").
- **At the viewing:** up to 12 things to look for and ask on the day, in Next steps (the **Viewing** button went in 2.0.4).
  2.0.9 brings back the radon tip, which 2.0.5 had replaced by mistake.
- A checklist for the seller and conveyancer; ticks are remembered for each property, and each list shows, for
  example, "2 of 7 done" (1.24.0).
- **Email** or **Copy** the key points for your conveyancer. Nothing passes through the app.

### Reliability
- A failed topic is tried again after 8 seconds (20 when the service refused the request), then offers **Try again**.
  Since 2.0.8 (owner, 8 November 2026) Try again also sits in the box under the topic grid, so it is in sight while
  the topic's card stays closed.
- Backups (1.30.1, after planning.data.gov.uk was down for a day): when it does not answer, heritage and nature come
  from Historic England and Natural England, and the topic names what it could not check. A topic whose service does
  not answer shows this place's last saved answer, dated, with **Try again**. Since 1.31.1 the flood zone at the pin
  comes from the Environment Agency's own flood map, and Past use of the land names the sites it could not check.
  Since 2.0.2, when the Environment Agency's map server does not answer, old landfill sites come from Defra's copy of
  the same register on ArcGIS Online (surface water, coast and noise have no trustworthy copy: checked 8 November 2026).
- Air quality (1.33.0, owner's request): the Open-Meteo area estimate is the main source and the council hotspot list
  (planning.data.gov.uk in England) adds to it, so the topic still answers when either is down. Only with both answering
  can it say "No issue found".
- More backups (1.34.0, first step to 2.0): conservation areas from Historic England's map when planning.data.gov.uk
  is down; the country and place from OpenStreetMap when postcodes.io is down; Photon when the address search is down;
  and each service's answer for a place kept on the device for 7 days, used (dated) only if that service fails.
- Printed report (1.35.0): page 1 has the property's details, a centred map (4:3 since 1.36.0) with a "Figure 1" caption, the
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
- Search box (2.0.7): "Postcode, address or place" is the hint inside the box ("Postcode or place" on the narrowest
  screens); its label stays for screen readers. Phones get their 16 px panel padding back (a desktop rule had
  overridden it).
- Calmer look, part 2 (2.0.6): a light header (white, a hairline under it; also on the status and glossary pages,
  with a matching phone browser bar), the first-visit guide as one quiet line, a slightly smaller semibold verdict,
  one credits line on screen (the page footer, shortened; the full licence list is in "Data credits and licences",
  and the printed and downloaded report keep their own credits line).
- Calmer look (2.0.5, quiz of 8 November 2026): one accent blue; thin line icons in the topic grid and the phone tab
  bar; only problem topics coloured in the grid; quiet grey buttons inside the report; thin grey "i" buttons; a
  subtle back-to-top button; a text-style Open problems / Close all; thinner, paler card edges; every topic card
  starts closed; the tapped topic's reason sits right under the grid.
- Since 2.0.4: share and printer icons on the Summary heading's line (the printer gives the 2-page summary), and
  **Download report** and **Print full report** under the summary. The top bar and its menu notes are gone; the end
  of the report is quieter (sources as a small link, short checklist intros, a slim Send to my conveyancer row).
- Printout extras (1.36.0): a one-line contents under the summary, a lined notes page at the end, and a 2-page short
  printout (the cover, key findings and the topic table; the checklists stay in the full report). Since 1.36.2 it
  keeps room to spare (a smaller map, tighter table rows), after a Lewes report ran onto a third page.

### Comfort and access
- Dark mode, larger text (**A+ Text size**), and install as an app on a phone.
- Checked against accessibility standard WCAG 2.2 AA; last re-checked on 7 November 2026 (1.36.0, after the calm screen,
  the glossary page and the always-shown report map; one fix: topic header lines now wrap at 320 px with A+ text).
- Privacy: no account, cookies or tracking.
- A **Data service status** page shows each data service's result in this morning's automatic check.

### Behind the scenes
- Plain files with no build step: `index.html`, `css/app.css` and `js/`.
- Lean code (1.36.1, quiz of 8 November 2026): `js/app.js` split into 5 files (`search.js`, `saved.js`, `report.js`,
  `print.js`, `app.js`); one print section in `css/app.css` instead of 10, with repeated rules merged (every element's
  computed style compared before and after: the same look); one box function for map queries; all saving through one
  storage helper; unused code removed.
- Rating fixes (1.36.1): noise with road or railway noise unchecked, a blank clay rating, and a failed coal service no
  longer read "No issue found" or hide other mining.
- An automatic check runs every day against the live site, and on every pull request. A failure opens a "Live check
  failed" issue on GitHub.
- Faster checks (2.0.1, quiz of 8 November 2026): screen-size-independent test steps run once, on the desktop; waits
  for the page instead of fixed pauses; no pauses when the report pages replay the recording; each step timed, with a
  short digest (`tests/digest.mjs`); the after-merge check skips document-only merges and replays the report pages;
  the accessibility check scans 4 combinations instead of 12. A failed topic retries after 8 seconds instead of 20 (still 20 when a service refuses the request).
- Quick wins (2.0.3, 8 November 2026): accessibility re-checked (no problems); a full daily run that passes closes the
  "Live check failed" issue; the workflow's cache step moved off the retired Node.js 20; early connection to the
  postcode search and early address lookups for the main data hosts.
- Steady pull request checks (2.0.0): each daily run records the outside services' answers to the `status` branch
  (each kept up to 14 days); pull requests build their reports from that copy, so an outside outage cannot turn them
  red. A question never recorded (for example a new topic) is asked live and named in the result. The daily check stays
  fully live.
- Final review (2.0.0): one report per country (Barnsley, Cardiff, Edinburgh, Belfast) with every topic answered, and
  Barnsley again with the radon service switched off, which showed the saved, dated answer.

---

## Part 2: Planned next steps

### Version 2.0 is complete

Version 2.0, the planned final version, shipped in five steps on 7 and 8 November 2026: 1.34.0 the backups, 1.35.0 the
printed report, 1.36.0 ease of use, 1.36.1 the clean-up, and 2.0.0 steady pull request checks with the final review.
Each was chosen in the quiz of 7 November 2026, built, tested and merged by the owner. Later changes come in small
steps from Part 3.

**No open backup exists** (health check, 7 November 2026), so these topics keep saying clearly what could not be
checked during an outage: Green Belt, HS2 safeguarding, schools (the national school list is only a download file),
bus and tram stops (the NaPTAN service does not let web pages read it), council air pollution hotspots in England
(Defra's map does not let web pages read it; air quality still answers from the Open-Meteo estimate), contaminated land,
noise, radon, coal, police data and sale prices.

**Health check notes:** all 65 help links open (police.uk, Ofcom, NHS inform and Historic England refuse automated
checks but open for people); issue #46 "Live check failed" is the planning.data.gov.uk outage; since 2.0.3 it closes by itself after the first full run that passes.

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
| Reservoir flood risk | After 2.1.0 (owner, 8 November 2026): whether the home is in the area a dam failure would flood. Defra's official reservoir flood extents on ArcGIS Online; nothing sent to the Environment Agency map server. Plan and quiz first. |
| Flood defences nearby | After reservoir flood risk (owner, 8 November 2026): walls and embankments protecting the area, from Defra's flood defence layer (updated October 2026). Plan and quiz first. |
| Past floods recorded here | **Planned as 2.1.0** (owner, 8 November 2026): Defra's copy of the Historic Flood Map on ArcGIS Online answers web pages and sends nothing to the busy Environment Agency map server. Plan and quiz first. |
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
