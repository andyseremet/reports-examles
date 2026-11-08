// Property Location Check – topic: Past floods recorded here. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, formatDistance, LINKS, okValue, today } from "../core.js";
import { API, arcgisRequest } from "../api.js";
import { inNI, inScotland, inWales, wfsFeatures, withDistance } from "../data.js";
import { unavailable, WAVE } from "./helpers.js";

// Past floods (2.1.0): areas recorded as flooded, at the pin or within PAST_FLOOD_M of it. England: Defra's copy of the
// Environment Agency Historic Flood Map (areas only, no dates): one count within 250 m, and one at the pin only when
// something is near. Wales: Natural Resources Wales' Historic Flood Map on DataMapWales (each flood with its dates,
// source and cause). Scotland and Northern Ireland publish no such record: the topic is left out there (COVERAGE).
const PAST_FLOOD_M = 250;

async function getPastFloods(loc) {
  if (await inScotland(loc) || await inNI(loc)) return null;
  if (await inWales(loc)) {
    const fields = ["name", "start_date", "end_date", "flood_source", "flood_cause"];
    const features = await wfsFeatures(API.dataMapWales, "inspire-nrw:NRW_HISTORIC_FLOODMAP", loc, PAST_FLOOD_M, { count: 100, srsName: "EPSG:4326" });
    const floods = withDistance(features, loc).filter(x => x.km <= PAST_FLOOD_M / 1000)
      .map(({ f, km }) => ({ km, ...Object.fromEntries(fields.map(k => [k, (f.properties || {})[k] || null])) }))
      .sort((a, b) => a.km - b.km || String(b.start_date).localeCompare(String(a.start_date)));
    return { country: "Wales", inside: floods.some(x => x.km === 0), near: floods.length > 0, floods };
  }
  const count = async m => (await arcgisRequest(API.pastFloods, loc, m, { returnCountOnly: "true" })).count || 0;
  const near = await count(PAST_FLOOD_M) > 0;
  return { country: "England", near, inside: near && await count(0) > 0, floods: [] };
}

// Flooding from heavy rain: England (Environment Agency), Scotland (SEPA), Wales (NRW).
// Past floods (2.1.0, owner, 8 November 2026): inside an area recorded as flooded "Look into this", one within 250 m
// "Worth checking", none "No issue found". England and Wales only: the topic is left out elsewhere (COVERAGE, js/coverage.js).
function checkPastFloods(R) {
  const country = okValue(R, "place")?.country || null;
  const wales = country === "Wales";
  const base = wales
    ? { source: { name: "Natural Resources Wales, Historic Flood Map (DataMapWales)", url: LINKS.pastFloodsWales },
        dataDate: "Recorded floods from Natural Resources Wales; checked live on " + today() }
    : { source: { name: "Environment Agency, Historic Flood Map (Defra's copy on ArcGIS Online)", url: LINKS.pastFloodsEngland },
        dataDate: "Historic Flood Map from the Environment Agency, via Defra; checked live on " + today() };
  if (!R.pastFloods.ok) return unavailable(base, R, "pastFloods");
  const v = R.pastFloods.value || { inside: false, near: false, floods: [] };
  const when = x => {
    if (!x.start_date) return "date not recorded";
    const d = new Date(x.start_date);
    return isNaN(d) ? String(x.start_date) : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };
  // Natural Resources Wales' words for each flood's source and cause, in plain English.
  const SOURCE = { "River": "river", "Sea - wave overtopping": "sea (waves)", "Sea - still water": "sea (high tide)",
    "Small watercourse": "stream or ditch", "Surface water": "heavy rain", "Ground water": "groundwater" };
  const CAUSE = { "Exceedance (undefended)": "no flood defences there", "Overtopping of defences": "water came over the defences",
    "Blockage": "a blocked channel or pipe", "Structure failure": "a defence or structure failed", "Operational failure": "equipment failed" };
  const kind = x => [SOURCE[x.flood_source] ? `${SOURCE[x.flood_source]} flood` : "flood", CAUSE[x.flood_cause]].filter(Boolean).join(", ");
  const floods = [...v.floods].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));   // newest first
  const latest = floods[0] || null;
  const status = v.inside ? "high" : v.near ? "medium" : "low";
  const found = v.inside
    ? `The pin is inside an area that has flooded before${latest ? `, most recently in ${when(latest)} (${kind(latest)})` : ""}.`
    : v.near
      ? `An area that has flooded before is within 250 m${latest ? `, most recently in ${when(latest)} (${kind(latest)})` : ""}.`
      : "No recorded flood within 250 m.";
  return {
    ...base, status, found,
    details: floods.length ? `<div class="table-wrap"><table class="site-list"><thead><tr><th>Recorded flood</th><th>When</th><th>Type</th><th>Distance</th></tr></thead><tbody>${
      floods.slice(0, 10).map(x => `<tr><td>${escapeHTML(x.name || "Unnamed record")}</td><td>${escapeHTML(when(x))}</td><td>${escapeHTML(kind(x))}</td><td>${escapeHTML(x.km === 0 ? "At the pin" : formatDistance(x.km))}</td></tr>`).join("")
    }</tbody></table></div>` : "",
    meaning: `<p>This shows land that has flooded before, from records kept mostly since 1946. ${wales
      ? "Natural Resources Wales records floods from rivers, the sea, streams and heavy rain."
      : "England's record covers rivers, the sea and groundwater; flooding from heavy rain alone is usually left out (see the heavy rain topic)."}
      A record does not mean this house flooded, and flood defences built since may protect it now. No record does not mean
      it has never flooded.</p>
      <p>Rating: inside a recorded flood area “Look into this”, one within 250 m “Worth checking”, none “No issue found”.</p>
      ${wales ? "" : "<p>England's record shows where floods reached, not when; ask the seller and the insurer about dates.</p>"}`,
    actions: [
      "Ask the seller whether the house, garden or road has ever flooded, and what was done afterwards.",
      ...(v.inside || v.near ? ["Get a buildings insurance quote that includes flood cover before you exchange contracts."] : [])
    ],
    seller: v.inside || v.near ? ["Has the property, garden or road ever flooded? When, how deep, and was an insurance claim made?"] : [],
    conveyancer: v.inside ? ["A flood risk report (often part of the environmental search)."] : []
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const pastfloodsTopic = {
  id: "pastfloods", group: "flood", title: "Past floods recorded here",
  countries: ["England", "Wales"],
  data: {
    pastFloods: ["Past floods recorded", getPastFloods, "Environment Agency via Defra (Wales: DataMapWales)"]
  },
  deps: ["pastFloods"],
  build: checkPastFloods,
  icon: ['<path d="M5 12V7l7-4 7 4v5"/><path d="M10 12V9h4v3"/>' + WAVE(15) + WAVE(20), "Past floods"],
  viewing: ["Signs of a past flood: a tide line or new plaster low on the walls, new floors or kitchen units downstairs, and flood barriers."]
};

export { checkPastFloods, getPastFloods, pastfloodsTopic };
