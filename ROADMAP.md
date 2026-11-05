# Road Map

Property Location Check: what the app does today, and what is planned next.

- Current version: **1.17.0** (live at https://andyseremet.github.io/reports-examles/)
- Last updated: 5 November 2026
- Approach: steady improvements, no radical changes. Coverage grows **deeper in England first**.
- Language: the app stays in English only.
- Free for everyone: every feature stays free; support for the app's development is always voluntary (see "Later:
  optional support module").
- Data rule: outside data is saved with the app only when it is certain never to change; everything else is checked
  live.

---

## Part 1: What the app does today (version 1.17.0)

### Finding the property
- Search by postcode, address or place name, with suggestions as you type.
- Map with street and satellite backgrounds, a "my location" button and a full-screen view.
- A pin you can drag onto the exact property, with a choice of nearby search distance (250 m, 500 m, 1 km or 2 km),
  in "More options: name, exact location, distance".
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
| Living environment | Recent sale prices: home sales within 500 m in the last 3 years, median price by type, the 10 most recent sales, new builds marked (England and Wales) | HM Land Registry Price Paid Data |
| Planning and surroundings | Planning restrictions and heritage | planning.data.gov.uk |
| Planning and surroundings | Protected trees (Tree Preservation Orders) and Article 4 areas | Councils, via planning.data.gov.uk |
| Planning and surroundings | Protected nature sites | Natural England, via planning.data.gov.uk |
| Planning and surroundings | Schools, GP surgeries, pharmacies, stations, tram and bus stops | DfE; NHS ODS; NaPTAN (rail stations saved with the app) |

Councils publish protected trees and Article 4 areas themselves, and many have not yet. The app checks whether the
council for the location has published them: if not, the topic says "Check yourself" instead of "No issue found".

Coastal erosion is checked within 1 km of the property; inland it says "Not near the coast". The Environment Agency
says its map is a national guide and cannot give exact details for a single property, and the report says so.

Sold prices count only standard sales of houses and flats; shops, offices and bulk sales are left out. The data
has no map positions, so the app finds the postcodes within 500 m (postcodes.io) and asks Land Registry for their
sales. Where none are found, the topic says "Check yourself". Sales appear about 1 to 2 months after they complete.

Topics with no free live data (for example rail and aircraft noise, Japanese knotweed) are listed with links to
the official checkers. Topics not covered in Wales or Scotland say "Check yourself" and link to the national service.

### The report
- Plain-English ratings: **Look into this / Worth checking / No issue found / For information / Check yourself**.
- Each topic says what it means and what to do next, with questions for the seller and the conveyancer.
- Results appear topic by topic as the data arrives.
- An overall verdict and a "Start here" list of things to look into.
- A "Where we could not give an answer" box: every topic with no real answer, why (not covered here, no data found,
  service not answering) and who to ask instead, with "Try again" for a service that is down. Hidden when every topic
  has an answer; included in the printed summary and the download, without buttons.
- A row of topic icons: tap one to see the reason in one line. A hint under them says so, and that the colours
  match the count boxes.
- "Data sources and dates" at the end folds away (opens on click, and always in print and downloads).
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
- Private notes, a starred shortlist, and **compare two properties side by side** (each tick box is labelled
  "Compare").
- Export and import, to move the list to another device.
- Backup reminder once you have 5 or more saved properties and no backup in 30 days.
- The app asks the browser to keep saved data, and says plainly if something could not be saved.

### Share, print and export
- Shareable links (`?postcode=` or `?lat=&lon=&name=&r=`) and the phone's share menu.
- A **Share** button with the share icon (the phone's share menu, or copy the link).
- One **Save or print** menu: Download report, Print summary, or Print full report (or save as PDF), each with a
  one-line description.

### Comfort and access
- Dark mode follows the device setting; **A+** makes text larger.
- Install as an app on a phone's home screen; works offline for saved properties.
- Checked against accessibility standard WCAG 2.2 AA (light and dark, phone and desktop), with tap targets of at
  least 24 × 24 pixels.
- Back button returns from a report to the map and closes the full-screen map.
- Privacy: no account, cookies or tracking; "Privacy: what is sent where" explains every outside request.
- A short footer with the required licence statements; "Data credits and licences" opens the full list.

### Behind the scenes
- Since 1.16.0 the code is split into files: `index.html` (the page), `css/app.css` (styles) and `js/` (core,
  data, one checks file per report section, and the app). Still no build step. Offline support fetches the app files
  fresh when online, so an update never mixes old and new files.
- An automatic check runs every day against the live site, and on every pull request before it is merged. It
  tests all 23 outside data services, the 2 data files saved with the app, and the full report on a desktop, a phone
  and a tablet. A failure opens a "Live check failed" issue on GitHub.

---

## Part 2: Planned next steps

Chosen from the quiz on 5 November 2026, one item per version, in this order. Each is planned with a short quiz
before it is built. Each version keeps the same habits: bump the version number and the offline cache name together,
update the README, add new behaviour to the daily check, and never weaken a test to get a pass.

| Version | Idea | What it does | Why this order |
|---|---|---|---|
| 1.18.0 | Data service health page | A simple page showing which outside data services worked in today's automatic check, so a buyer can see when a topic is down for everyone. | Already planned; small; helps explain "Service not answering" in the data gaps box. |
| 1.19.0 | Accessibility re-check | Repeat the WCAG 2.2 AA check (light and dark, phone and desktop) after the 1.15.0 to 1.17.0 visual changes: the new menu, folded sections, labels and contrast. | Best done soon after the visual changes, before more are added. |
| 1.20.0 | Faster reports | Aim for every report in under 10 seconds; while waiting, say which service is slow. Must not add requests to the Environment Agency map server. | Speed helps every visitor on every report. |
| 1.21.0 | Viewing checklist | A short list of things to look for and ask on the day of a viewing, built from this report's results; easy to use on a phone, and works offline for saved properties. | Turns the report into action at the viewing. |
| 1.22.0 | Compare up to 3 properties | Compare side by side takes up to three saved properties instead of two; phone layout to be decided. | Builds on the existing compare view. |
| 1.23.0 | Fuller coverage for Wales | Fill topics that say "Check yourself" in Wales (7 today: land use, coast, noise, air, planning, trees, nature) where Welsh Government or Natural Resources Wales publish live open data. | Largest research task: each source must be checked first. |

### Later: optional support module (not scheduled)

Decided on 5 November 2026. **Nothing changes in the app now.** This is planned for when the product is complete,
and only if the owner decides to add it.

**Principles**
- The app is and stays **free for everyone**, with every feature. Nobody is ever asked to pay to see, save, print,
  download or share a report.
- Support is **voluntary**: anyone can choose to contribute to or sponsor the app's development. Sharing the app is
  encouraged as much as possible.
- No adverts, no tracking, no accounts.

**How it would be built: a separate module the app does not depend on**
- All support code lives in its own file (for example `js/support.js` with `css/support.css`), outside the main app.
- The main app only offers a few named "hooks": places where the module may add something, such as after the report
  summary, or after a download or print. If the module is not loaded, the hooks do nothing and the app is exactly as
  it is today.
- Switching it on or off is one line in `index.html` (and its file in `sw.js`). Nothing else in the app changes.
- The daily check must pass both with and without the module.
- The module never appears in printed or downloaded reports, and never slows down or blocks a report.

**Options noted for that time (to be decided then)**
- Payment links: Stripe Payment Links take cards, Apple Pay, Google Pay and PayPal (available to UK Stripe accounts;
  standard UK cards cost 1.5% + 20p). They need no server for voluntary contributions.
- Possible placement: one quiet line after the report summary, and a short thank-you after download or print.
- Possible amounts: £5, £10, £15, or any other amount the person is comfortable to give (Stripe Payment Links can
  let the payer choose the amount).
- Before switching it on: update "Privacy: what is sent where" (the payment provider receives payment details) and
  add short terms for contributions.
- A paid product (for example a professional emailed PDF) is not planned. If it is ever wanted, it would need a host
  that allows commercial sites (GitHub Pages does not allow e-commerce sites), a small server part to confirm
  payments, commercial terms for the air quality, map picture and address search services, and UK consumer terms
  (Consumer Contracts Regulations 2013, regulation 37).
- Known risk to check at that time: Open-Meteo's free service is for non-commercial use only, and GitHub Pages must
  not be used mainly for commercial transactions. Ask both whether a voluntary contribution link is acceptable.

Sources checked on 5 November 2026: GitHub Pages limits; Open-Meteo terms; CARTO basemap licence; Esri community
answer on World Imagery; OSMF Nominatim policy; Stripe UK pricing and PayPal through Stripe; PayPal UK fees;
GOV.UK VAT threshold; legislation.gov.uk (SI 2013/3134, regulation 37).

---

## Part 3: Ideas parked for later

Suggested in a quiz but not chosen. They can be picked up in a future round.

| Idea | Notes |
|---|---|
| Travel time to a chosen place | Distance and rough walking/driving time to work or a school. Offered again on 5 November 2026; needs a routing service. |
| What changed since last check | When a saved property is refreshed, show which topics changed rating. Offered on 5 November 2026. |
| Flood warnings now | Environment Agency real-time flood service: is the home in a flood warning or alert area, and is a warning in force today. Live, allows web pages, separate from the busy map server (checked 5 November 2026). |
| Past floods recorded here | Environment Agency Recorded Flood Outlines. Live, but adds 1 request to the busy Environment Agency map server. |
| Broadband and mobile coverage | Ofcom's data needs an account key, so only a "Check yourself" topic with links is possible. |
| Paid features | Considered on 5 November 2026 and not wanted: the app stays free for everyone. Ideas noted were a free summary with paid details, paid reports, a paid emailed PDF, extra licensed data (BGS GeoSure, groundwater flooding), a conveyancer pack, and a report kept up to date before exchange. |
| Planning applications nearby | Not possible yet: planning.data.gov.uk has no planning application records (checked 5 November 2026). |
| Fuller coverage for Scotland | Fill topics that say "Check yourself" in Scotland. |
| Welsh language | Removed on 4 November 2026: the app stays in English only. |
| Remove "Download report" | Considered on 4 November 2026 and kept; since 1.17.0 it is in the "Save or print" menu. |
| Remove the latitude and longitude boxes | Considered on 4 November 2026 and kept, in More options. |
| Remove or reduce railway noise, landslides, aircraft | Considered on 4 November 2026 and kept as they are. |
| Power lines and pylons | Dropped on 5 November 2026: the data is mostly downloads, not live services, and it changes as lines are built. Buyers can use the official network maps instead. |
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
