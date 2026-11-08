// Property Location Check – topic: Landslides and ground movement. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { byDistance, distanceKm, escapeHTML, formatDistance, formatRadius, link, LINKS, plural } from "../core.js";
import { API, arcgisQuery } from "../api.js";
import { unavailable } from "./helpers.js";

async function getLandslides(loc) {
  const f = await arcgisQuery(API.landslides, loc, loc.radius, {
    outFields: "LANDSLIDE_NAME,LOCALITY_DETAILS", returnGeometry: "true", outSR: "4326"
  });
  return f.map(x => {
    const p = x.geometry && Number.isFinite(x.geometry.y) ? { lat: x.geometry.y, lon: x.geometry.x } : null;
    return {
      name: x.attributes.LANDSLIDE_NAME || x.attributes.LOCALITY_DETAILS || "Recorded landslide",
      lat: p?.lat, lon: p?.lon, distanceKm: p ? distanceKm(loc, p) : null
    };
  }).sort(byDistance);
}

function checkLandslides(R) {
  const base = {
    source: { name: "British Geological Survey, National Landslide Database", url: LINKS.landslides }
  };
  if (!R.landslides.ok) return unavailable(base, R, "landslides");
  const s = R.landslides.value;
  return {
    // Only a landslide within 500 m is worth checking; further ones are for information.
    ...base, status: !s.length ? "low" : (s[0].distanceKm ?? 0) <= 0.5 ? "medium" : "info",
    found: s.length
      ? `${plural(s.length, "recorded landslide")} within ${formatRadius(R.loc.radius)}. The nearest is about ${formatDistance(s[0].distanceKm)} away.`
      : `No recorded landslides within ${formatRadius(R.loc.radius)}.`,
    details: s.length ? `<ul class="site-list">${s.slice(0, 5).map(x => `<li>${escapeHTML(x.name)} (${escapeHTML(formatDistance(x.distanceKm))})</li>`).join("")}</ul>` : "",
    meaning: `<p>Rating: a recorded landslide within 500 m is “Worth checking”; further away it is “For information”.</p>
      <p>Clay soil that shrinks and swells in dry and wet weather, the most common cause of subsidence in England, is
      covered by its own topic, “Shrinking and swelling clay”.</p>`,
    actions: [`For clay soil, sinkholes and other ground hazards, the environmental search or a ${link(LINKS.geosure, "British Geological Survey GeoSure")} report can help.`],
    seller: ["Has there been any subsidence, cracking or underpinning?"]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const landslidesTopic = {
  id: "landslides", group: "ground", title: "Landslides and ground movement",
  countries: ["England", "Wales", "Scotland"],
  data: {
    landslides: ["Landslides", getLandslides, "British Geological Survey"]
  },
  deps: ["landslides"],
  build: checkLandslides,
  icon: ['<path d="M3 20l6-10 4 6 3-4 5 8z"/>', "Ground"],
  viewing: ["Cracks in walls, paths or garden walls, leaning walls or fences, and wet or slipping slopes."]
};

export { landslidesTopic };
