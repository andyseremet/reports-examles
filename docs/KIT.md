# Topic cards for other apps (the kit)

Each topic in Property Location Check can be used on its own, in another website or a small new app. This is the
first version of the guide (2.7.0); step 5 of the modular plan (`ROADMAP.md`, Part 2) completes it. See it working
on the demo page: https://andyseremet.github.io/reports-examles/kit/

## One card, one line

```html
<script type="module" src="https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js"></script>
<plc-topic topic="radon" postcode="S70 2TA"></plc-topic>
```

- `topic`: one topic's name (the list is on the demo page, or `TOPICS` in code).
- The place: `postcode="…"`, or `lat="…" lon="…"` with an optional `name="…"`.
- `radius`: the search distance in metres, 250, 500, 1000 (the default) or 2000.
- Tags for the same place on one page share their data, so nothing is asked twice.
- Each new result fires a `plc-result` event on the tag (`event.detail`: `{ topic, result }`).

## In code

```js
import { checkPlace } from "https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js";
const done = await checkPlace({ postcode: "YO1 9QL" }, {
  topics: ["flood", "surfacewater", "pastfloods"],
  onCard: (topic, result, html) => { /* show html; result has status, found, details, meaning, actions, source */ }
});
// done = { place, country, results } once every topic has its answer (at most about 45 seconds)
```

`result` is `null` when the topic's data does not cover the place's country; its card then says so and names the
service to use instead. The kit also offers `findPostcode`, `topicById`, `TOPICS`, `RADIUS_M` and `KIT_VERSION`.

## Styling the cards

Cards come plain, with no styles of their own: your app styles them. Each is an `<article class="plc-card">` with
`data-topic` (the topic's name) and `data-status` (`high`, `medium`, `low`, `info`, `manual`, `error`, `loading` or
`not-covered`), holding `.plc-title`, `.plc-status` (the rating in words), `.plc-found`, and when present
`.plc-saved`, `.plc-actions`, `.plc-details`, `.plc-meaning`, `.plc-source` and a `.plc-retry` button. The demo page's
own styles are one example. Show the rating in words as well as any colour.

## Versions

- `kit/v1/js/kit.js`: a fixed copy (the code of 2.7.0). Use this in other apps: later changes to the app cannot
  break it. A fixed copy is never changed, except to follow an outside data service that moved its address (each such
  fix is listed below). A change to what the kit offers comes as a new folder (`kit/v2/`).
- `js/kit.js`: the latest code, which changes with the app. For trying things out, not for other apps.

Load one copy of the kit per page: requests to services that allow only a few at a time (the Environment Agency map
server, OpenStreetMap's Nominatim) then wait in one queue.

Fixes to fixed copies: none yet.

## The same rules as the app

Missing data is never good news: a topic whose source did not answer says "Not available" or "Check yourself", never
"No issue found". The data comes live from the official sources each time; a source's answer for a place is kept in
the browser for 7 days and used, dated, only if that source does not answer.
