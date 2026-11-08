// Property Location Check – topic: Flooding from heavy rain (surface water). Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { link, LINKS, okValue, today } from "../core.js";
import { API } from "../api.js";
import { inNI, inScotland, inWales, wmsFeaturesAt } from "../data.js";
import { LEVEL_STATUS, SEPA_CHANCE, unavailable, ZONE_STATUS, zoneFound, zoneNumber } from "./helpers.js";

// England: Environment Agency "Risk of flooding from surface water" (2025 national assessment).
async function getSurfaceWater(loc) {
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return null;   // SEPA and NRW: getFloodNational
  const props = await wmsFeaturesAt(API.surfaceWater, "rofsw", loc);
  const order = ["High", "Medium", "Low"];
  const bands = props.map(x => x.risk_band).filter(b => order.includes(b));
  return { band: bands.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || null };
}

const SURFACE_MEANING = "Surface water flooding happens when heavy rain cannot drain away, even far from rivers.";

function checkSurfaceWater(R) {
  const base = {
    source: { name: "Environment Agency, Risk of Flooding from Surface Water (2025)", url: LINKS.floodLongTerm },
    dataDate: "Surface water flood map published in 2025; checked live on " + today()
  };
  const country = okValue(R, "place")?.country || null;
  const actions = ["Ask the seller whether water has ever collected around the house or garden after heavy rain."];
  if (country === "Scotland" || country === "Wales") {
    if (!R.floodNational.ok) return unavailable(base, R, "floodNational");
    const f = R.floodNational.value;
    if (country === "Scotland") {
      const l = f.surface;
      return {
        ...base, source: { name: "SEPA surface water and small watercourses flood map", url: LINKS.sepaMaps },
        status: l ? LEVEL_STATUS[l] : "low",
        found: l ? `${l} likelihood of flooding from heavy rain or small watercourses (${SEPA_CHANCE[l]}).`
          : "Not in an area SEPA maps as at risk of flooding from heavy rain.",
        meaning: `<p>${SURFACE_MEANING}</p>`,
        actions: [`Check the street on the ${link(LINKS.sepaMaps, "SEPA flood maps")}.`, ...actions]
      };
    }
    const z = zoneNumber(f.surface);
    return {
      ...base, source: { name: "Natural Resources Wales, Flood Map for Planning (surface water)", url: LINKS.nrwMaps },
      status: ZONE_STATUS[z], found: zoneFound(z, "heavy rain or small watercourses", false),
      meaning: `<p>${SURFACE_MEANING}</p>`,
      actions: [`Check the street on the ${link(LINKS.nrwMaps, "Natural Resources Wales flood risk maps")}.`, ...actions]
    };
  }
  if (!R.surfaceWater.ok) return unavailable(base, R, "surfaceWater");
  const band = R.surfaceWater.value.band;
  const text = {
    High: "High chance of flooding from heavy rain: more than 3.3% (1 in 30) each year.",
    Medium: "Medium chance of flooding from heavy rain: between 1% and 3.3% each year.",
    Low: "Low chance of flooding from heavy rain: between 0.1% and 1% each year."
  };
  return {
    ...base, status: band ? LEVEL_STATUS[band] : "low",
    found: band ? text[band] : "Very low chance of flooding from heavy rain: less than 0.1% (1 in 1,000) each year.",
    meaning: `<p>${SURFACE_MEANING} It is the most
      common type of flooding in England. The result is for the exact pin location: a garden or road can be at higher risk
      than the house itself, so check the map around the property.</p>`,
    actions: [`See the surface water map around the property on ${link(LINKS.floodLongTerm, "GOV.UK long-term flood risk")}.`, ...actions],
    seller: band ? ["Has water ever come into the house or collected in the garden after heavy rain?"] : [],
    conveyancer: band === "High" ? ["A flood risk report (often part of the environmental search)."] : []
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const surfacewaterTopic = {
  id: "surfacewater", group: "flood", title: "Flooding from heavy rain (surface water)",
  countries: ["England", "Scotland", "Wales"],
  data: {
    surfaceWater: ["Flooding from heavy rain", getSurfaceWater, "Environment Agency"]
  },
  deps: ["surfaceWater", "floodNational"],
  build: checkSurfaceWater,
  icon: ['<path d="M7 15a4 4 0 1 1 .6-8 5 5 0 0 1 9.4 1.6A3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>', "Rain flood"],
  viewing: ["Where rain would run: slopes towards the house, low doorways, blocked drains or gullies in the street."]
};

export { surfacewaterTopic };
