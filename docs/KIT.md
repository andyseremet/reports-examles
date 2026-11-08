# Topic cards for other apps (the kit)

Each topic in Property Location Check can be used on its own: inside another website, or in a small new app. You load
one file, then show a topic as a card with one line of HTML, or check several topics in a few lines of code. The cards
come plain, so your app styles them.

See it working on the demo page: https://andyseremet.github.io/reports-examles/kit/ (add `?v=v1` to see the fixed copy).

Contents: [Quick start](#quick-start) · [In code](#in-code) · [Results](#results) · [Topics](#topics) ·
[Styling](#styling-the-cards) · [Versions](#versions) · [Good to know](#good-to-know) · [A complete small app](#a-complete-small-app) ·
[For maintainers](#for-maintainers)

## Quick start

```html
<script type="module" src="https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js"></script>
<plc-topic topic="radon" postcode="S70 2TA"></plc-topic>
```

That is all: the tag shows "Checking…", then the radon card for that postcode.

| Attribute | What it does |
|---|---|
| `topic` | The topic's name, for example `radon` (all names are in [Topics](#topics)). One topic per tag. |
| `postcode` | The place, as a UK postcode. |
| `lat`, `lon`, `name` | The place as latitude and longitude instead (WGS84 degrees), with an optional name. |
| `radius` | The search distance in metres: `250`, `500`, `1000` (the default) or `2000`. |

- Tags for the same place and distance on one page share their data: nothing is asked twice.
- Each new result fires a `plc-result` event on the tag, which bubbles: `event.detail` is `{ topic, result }`.
- A card that could not load has a **Try again** button, which checks that topic again.
- A wrong topic name or an unknown postcode shows a short message in place of the card (`.plc-error`).

## In code

```js
import { checkPlace } from "https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js";

const done = await checkPlace({ postcode: "YO1 9QL" }, {
  topics: ["flood", "surfacewater", "pastfloods"],
  radius: 1000,
  onCard: (topic, result, html) => { document.getElementById("slot-" + topic.id).innerHTML = html; }
});
// done = { place: { name, lat, lon, radius }, country, results: { flood: {…}, … } }
```

`checkPlace(where, options)`:

- `where`: `{ postcode }`, or `{ lat, lon, name }`.
- `options.topics`: topic names (all 16 by default). Only the data these topics need is asked for.
- `options.radius`: `250`, `500`, `1000` (the default) or `2000` metres.
- `options.onCard(topic, result, html)`: called each time a topic's result is ready or changes. `topic` is the topic
  object (below), `result` its result (or `null`), `html` its plain card. A topic can change once more: a saved
  answer shown while a slow service is waiting is replaced when the live answer arrives.
- It resolves once every topic has its answer, at most about 45 seconds after the start (a service still waiting by
  then gives "Not available", and its answer fills in through `onCard` if it arrives later).
- It rejects, with a plain-English message, for an unknown postcode, a wrong topic name or distance, or a place given
  neither way.

Checks run beside anything else on the page, including other `checkPlace` calls.

Also offered:

| Name | What it is |
|---|---|
| `TOPICS` | Every topic object, in report order: `{ id, group, title, countries, deps, icon: [drawing, short name], viewing }`. |
| `topicById(id)` | One topic object, or `null`. |
| `findPostcode(postcode)` | `{ lat, lon, name }` for a postcode, from postcodes.io. |
| `RADIUS_M` | The distances allowed: `[250, 500, 1000, 2000]`. |
| `KIT_VERSION` | `"1"`. |
| `renderCard(topic, result, { country })` | In `js/card.js`, next to `kit.js`: the plain card's HTML, if you build your own flow. |

The kit also loads without a browser page (for example in Node.js), so code can list `TOPICS` anywhere. The
`<plc-topic>` tag needs a browser.

## Results

A result is the same object the app's report uses:

| Field | What it holds |
|---|---|
| `status` | The rating: `high` "Look into this", `medium` "Worth checking", `low` "No issue found", `info` "For information", `manual` "Check yourself", or `error` "Not available" (the source did not answer). |
| `found` | One plain sentence: what was found. Plain text. |
| `actions` | What to do: a list of short HTML sentences. |
| `details` | What we found, in more detail (HTML, often a table). |
| `meaning` | What this means (HTML). |
| `seller`, `conveyancer` | Questions for the seller and things to ask the conveyancer (plain text lists). |
| `source` | `{ name, url }` of the official source, and `dataDate`: its date, or "Checked live on …". |
| `fromSaved`, `waiting` | Set when the source did not answer and an earlier answer for this place is shown instead, with its date. |

`result` is `null` when the topic's data does not cover the place's country; the card then says so and names the
service to use instead (for example SEPA in Scotland).

The HTML in a result is built by the app from official data, with every value escaped, so it is safe to show.

## Topics

| Name | Topic | Countries | Data from |
|---|---|---|---|
| `flood` | Flooding from rivers and the sea | England, Scotland, Wales | planning.data.gov.uk; SEPA and Natural Resources Wales; Environment Agency via Defra |
| `surfacewater` | Flooding from heavy rain (surface water) | England, Scotland, Wales | Environment Agency; SEPA and Natural Resources Wales |
| `pastfloods` | Past floods recorded here | England, Wales | Environment Agency via Defra (Wales: DataMapWales) |
| `coal` | Mining (coal and other) | England, Wales, Scotland | Mining Remediation Authority; British Geological Survey |
| `radon` | Radon gas | England, Wales, Scotland | British Geological Survey |
| `landuse` | Past use of the land: landfill and contamination | England, Scotland, Wales | Environment Agency; planning.data.gov.uk; DataMapWales; SEPA |
| `landslides` | Landslides and ground movement | England, Wales, Scotland | British Geological Survey |
| `clay` | Shrinking and swelling clay | England, Wales, Scotland | British Geological Survey |
| `coastal` | Coastal erosion | All four | Environment Agency (Wales: DataMapWales; Scotland: NatureScot; NI: DAERA) |
| `noise` | Noise: road, railway and aircraft | All four | Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA) |
| `air` | Air quality | All four | planning.data.gov.uk; Open-Meteo; DataMapWales; Historic Environment Scotland and NatureScot; Department for Communities and DAERA |
| `amenities` | Schools, doctors and transport | All four | NHS and planning.data.gov.uk |
| `crime` | Reported crime | All four | data.police.uk; Office for National Statistics; Scottish Government |
| `soldprices` | Recent sale prices nearby | England, Wales | HM Land Registry |
| `planning` | Planning restrictions and heritage | All four | planning.data.gov.uk; DataMapWales; Historic Environment Scotland and NatureScot; Department for Communities and DAERA |
| `nature` | Protected nature sites | All four | planning.data.gov.uk; DataMapWales; Historic Environment Scotland and NatureScot; Department for Communities and DAERA |

Every topic also uses postcodes.io (or OpenStreetMap if it does not answer) to find the place's country and council.

## Styling the cards

Cards have no styles of their own. Each is:

```html
<article class="plc-card" data-topic="radon" data-status="high">
  <h3 class="plc-title">Radon gas</h3>
  <p class="plc-status">Look into this</p>
  <p class="plc-found">Raised radon area: …</p>
  <p class="plc-saved">…</p>                       <!-- only for an earlier, saved answer -->
  <p><button class="plc-retry">Try again</button></p>  <!-- only when it could not load -->
  <h4>What to do</h4><ul class="plc-actions">…</ul>
  <div class="plc-details"><h4>What we found</h4>…</div>
  <div class="plc-meaning"><h4>What this means</h4>…</div>
  <p class="plc-source">Source: <a href="…">…</a>. Checked live on 8 November 2026.</p>
</article>
```

`data-status` is one of the ratings above, or `loading` or `not-covered`. Style by it, for example:

```css
.plc-card { border: 1px solid #d2d2d7; border-left: 4px solid #6e6e73; border-radius: 12px; padding: 14px 16px; }
.plc-card[data-status="high"] { border-left-color: #c9252c; }
.plc-card[data-status="medium"] { border-left-color: #b25000; }
.plc-card[data-status="low"] { border-left-color: #1d7a3a; }
.plc-card .table-wrap { overflow-x: auto; }
```

The demo page's styles are a fuller example (light and dark). Two things keep the cards readable for everyone: the
rating is always in words in `.plc-status`, so do not hide it behind a colour; and a wide table sits in a box that
scrolls sideways and can be reached by keyboard, so give `.table-wrap` `overflow-x: auto` rather than cutting it off.

## Versions

| Address | Use it for |
|---|---|
| `…/kit/v1/js/kit.js` | Other apps. A fixed copy (the code of 2.7.1): later changes to the app cannot break it. |
| `…/js/kit.js` | Trying things out. The latest code, which changes with the app. |

A fixed copy is never changed, except to follow an outside data service that moved its address (each such fix is
listed here). Anything new in the kit, such as a new topic or a new option, comes in a new folder (`kit/v2/`), and
earlier folders stay as they are.

Fixes to fixed copies: none yet.

## Good to know

- **Free, with credit:** the data is open (mostly under the Open Government Licence). Each card's source line names
  where it came from; keep it visible. To reuse the app's code itself, ask the owner first: the code has no licence
  file yet.
- **Live data:** every check asks the official sources at that moment. Nothing is sent to Property Location Check;
  the requests go from the visitor's browser straight to the sources. The sources let other websites read their
  answers: checked from another website on 8 November 2026, except the Environment Agency map server, which was down
  for every website that day (its error replies cannot be read by any page, so its topics said "Not available").
- **Saved in the browser:** each source's answer for a place is kept in the visitor's browser for 7 days (keys
  starting `plc-recent:`), and used, dated, only if that source does not answer next time. No other data is kept.
- **One kit per page:** load one copy of the kit. Some services allow only a few requests at a time (the Environment
  Agency map server, used by heavy rain, noise and landfill; OpenStreetMap's Nominatim); one kit keeps all requests
  in one queue. Please do not run checks in a loop or for many places at once.
- **Missing data is never good news:** a topic whose source did not answer says "Not available" or "Check yourself",
  never "No issue found". A first look, not a survey: say so in your app as the report does.

## A complete small app

Save this as an `.html` file and open it from a web server (not `file://`): a flood check for any postcode.

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flood check</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 16px; }
  .plc-card { border: 1px solid #d2d2d7; border-left: 4px solid #6e6e73; border-radius: 12px; padding: 12px 16px; margin: 12px 0; }
  .plc-card[data-status="high"] { border-left-color: #c9252c; }
  .plc-card[data-status="medium"] { border-left-color: #b25000; }
  .plc-card[data-status="low"] { border-left-color: #1d7a3a; }
  .plc-card .table-wrap { overflow-x: auto; }
</style>
</head>
<body>
<h1>Flood check</h1>
<form id="form"><label for="pc">Postcode</label> <input id="pc" required> <button>Check</button></form>
<p id="status" role="status"></p>
<div id="cards"></div>
<script type="module">
  import { checkPlace } from "https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js";
  const topics = ["flood", "surfacewater", "pastfloods"];
  document.getElementById("form").addEventListener("submit", async e => {
    e.preventDefault();
    const cards = document.getElementById("cards"), status = document.getElementById("status");
    cards.innerHTML = topics.map(id => `<div id="slot-${id}"></div>`).join("");
    status.textContent = "Checking…";
    try {
      const done = await checkPlace({ postcode: document.getElementById("pc").value }, { topics,
        onCard: (topic, result, html) => { document.getElementById("slot-" + topic.id).innerHTML = html; } });
      status.textContent = `Checked ${done.place.name}.`;
    } catch (err) { status.textContent = err.message; }
  });
</script>
</body>
</html>
```

## For maintainers

How the kit is made, in this repository:

- **Files:** `js/kit.js` (what other apps load), `js/card.js` (the plain card), the runner (`js/runner.js`) and one
  file per topic (`js/topics/`, see "Adding a topic" in `docs/CODE.md`). The kit and what it imports never import the
  main app's page files, and find their own files with `import.meta.url`, never the page's address (`REVIEW.md`).
- **A new topic** is in the latest kit (`js/kit.js`) as soon as it is in `CHECKS`. Fixed copies do not get it: it
  reaches other apps in the next version folder.
- **A new fixed version**, at a release: `node tests/freeze-kit.mjs v2` copies `js/kit.js` and everything it imports,
  the data files and a glossary link into `kit/v2/` (it refuses to overwrite a folder that exists). Then update the
  Versions table above, `README.md` and `ROADMAP.md`. The daily check tests every `kit/v<N>/` folder by itself.
- **A fix to a fixed copy** (only when an outside service moved its address): change that one address in the copy by
  hand, list the fix under Versions above, and run the full test.
- **Tests:** the daily check's "Kit" step (`tests/live/country.mjs`) opens the demo page with the latest kit and each
  fixed copy; the accessibility scan includes the demo page; the syntax check links the kit and each copy, and loads
  the kit without a browser.
