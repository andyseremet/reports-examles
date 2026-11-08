// Property Location Check – topic: Shrinking and swelling clay. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { LINKS } from "../core.js";
import { API, arcgisQuery } from "../api.js";
import { inNI } from "../data.js";
import { unavailable } from "./helpers.js";

// British Geological Survey hexagon overviews (Great Britain only; null in Northern Ireland).
// Shrink-swell clay: class 1 Low, 2 Moderate, 3 Significant; "localised" when parts of the hexagon are rated Significant.
async function getShrinkSwell(loc) {
  if (await inNI(loc)) return null;
  const f = await arcgisQuery(API.shrinkSwell, loc, 0, { outFields: "CLASS,Legend,Advisory" });
  if (!f[0]) return null;
  const a = f[0].attributes;
  return { level: Number(a.CLASS), localised: /localised significant/i.test(a.Advisory || "") };
}

// Shrinking and swelling clay: the British Geological Survey's 5 km overview (GeoSure, version 8). Significant →
// Worth checking; Moderate → For information; Low → No issue found, unless parts of the hexagon are rated Significant.
function checkClay(R) {
  const base = { source: { name: "British Geological Survey, GeoSure shrink-swell (5 km overview)", url: LINKS.geosure } };
  if (!R.shrinkSwell.ok) return unavailable(base, R, "shrinkSwell");
  const v = R.shrinkSwell.value;
  // No rating (or one outside 1 to 3) is missing data, never "No issue found".
  if (!v || ![1, 2, 3].includes(v.level)) return { ...base, status: "manual", found: "No clay data was found for this spot. Ask your surveyor about the soil." };
  const word = { 1: "low", 2: "moderate", 3: "significant" }[v.level];
  const status = v.level === 3 ? "medium" : v.level === 2 || v.localised ? "info" : "low";
  const found = `The chance of clay soil shrinking and swelling is ${word} in this area.` +
    (v.localised && v.level < 3 ? " Some spots nearby are rated significant." : "");
  return {
    ...base, status, found,
    meaning: `<p>Some clay soils shrink in dry summers and swell when wet. This can move foundations and crack walls, and it is the
      most common cause of subsidence in England, especially in the South East. Trees close to a house make it worse, because
      their roots dry the clay out.</p>
      <p>This is an overview for an area about 5 km across, not a survey of this plot. Rating: significant “Worth checking”,
      moderate (or significant spots nearby) “For information”, low “No issue found”.</p>`,
    actions: status === "low" ? [] : [
      "Ask your surveyor to look for subsidence cracks and to note any large trees close to the house.",
      "Ask your buildings insurer whether the area affects the price or the cover."
    ],
    seller: status === "medium" ? ["Has the house ever had subsidence, underpinning or an insurance claim for cracks?"] : []
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const clayTopic = {
  id: "clay", group: "ground", title: "Shrinking and swelling clay",
  countries: ["England", "Wales", "Scotland"],
  data: {
    shrinkSwell: ["Shrinking and swelling clay", getShrinkSwell, "British Geological Survey"]
  },
  deps: ["shrinkSwell"],
  build: checkClay,
  icon: ['<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 12h18M9 5v7M15 12v7"/>', "Clay"],
  viewing: ["Cracks wider than a coin near doors and windows, and big trees close to the house (their roots dry out clay)."]
};

export { checkClay, clayTopic, getShrinkSwell };
