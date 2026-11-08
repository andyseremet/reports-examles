// Property Location Check – topic: Past use of the land: landfill and contamination. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { boundingBox, byDistance, distanceKm, escapeHTML, formatDistance, formatRadius, geometryCentre, ICON_PATHS,
  link, LINKS, okValue, plural, term, today } from "../core.js";
import { API, arcgisQuery, fetchJSON } from "../api.js";
import { distanceToGeometryKm, geometryHas, inNI, inScotland, inWales, wmsInfo } from "../data.js";
import { tidy } from "../data-wales.js";
import { tidyCaps } from "../data-scotland.js";
import { backupFor, byDataset, isScotland, isWales, unavailable } from "./helpers.js";

async function getLandfill(loc) {
  // The Environment Agency's landfill map covers England only (Wales: getCoalTips; Scotland: getWasteSites).
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return [];
  const sites = list => list.map(([props, geometry]) => {
    const c = geometryCentre(geometry);
    return { ...props, lat: c?.lat, lon: c?.lon, distanceKm: c ? distanceKm(loc, c) : null };
  }).filter(s => s.distanceKm == null || s.distanceKm <= loc.radius / 1000).sort(byDistance);
  try {
    const d = await fetchJSON(API.landfill + "?f=json&limit=100&bbox=" + boundingBox(loc.lat, loc.lon, loc.radius).join(","));
    return sites((d.features || []).map(f => [f.properties, f.geometry]));
  } catch (error) {
    // The map server is not answering: Defra's copy of the same register. Its answer travels with the failure
    // (error.backup), so only checkLanduse uses it and says where it came from. Its dates come as timestamps
    // (or numbers): kept as the live service gives them, YYYY-MM-DD.
    const date = v => v == null ? v : (typeof v === "number" ? new Date(v).toISOString() : String(v)).slice(0, 10);
    const copy = await arcgisQuery(API.landfillBackup, loc, loc.radius, { outFields: "*", returnGeometry: "true", outSR: "4326", resultRecordCount: "100" })
      .catch(() => null);
    if (copy) error.backup = { sites: sites(copy.map(f => [{ ...f.attributes, firstinput: date(f.attributes.firstinput), lastinput: date(f.attributes.lastinput) },
      { coordinates: f.geometry?.rings }])) };
    throw error;
  }
}

// Welsh Government disused coal tips map (categories set how often a tip is inspected: C and D most often).
// It is a map image service, so we ask for the tips drawn in a square a little larger than the search
// distance, then keep those whose edge is within it.
const COAL_TIP_CATEGORY = {
  A: "A (low potential to affect public safety)", B: "B (unlikely to affect public safety)",
  C: "C (inspected once a year)", D: "D (inspected twice a year)", R: "R (often removed, levelled or built over)"
};

async function getCoalTips(loc) {
  if (!(await inWales(loc))) return null;
  const d = 1.2 * loc.radius / 111320;
  const features = await wmsInfo(API.dataMapWales, "geonode:disused_coal_tips_in_wales_public", loc, d,
    { width: 31, height: 31, i: 15, j: 15, buffer: 15, feature_count: 200, bbox: [loc.lat - d, loc.lon - d / Math.cos(loc.lat * Math.PI / 180), loc.lat + d, loc.lon + d / Math.cos(loc.lat * Math.PI / 180)].join(",") });
  return features
    .map(f => {
      const p = f.properties || {}, c = geometryCentre(f.geometry);
      const km = !f.geometry ? null : geometryHas(f.geometry, loc) ? 0 : distanceToGeometryKm(f.geometry, loc);
      return { id: tidy(p.uid), category: tidy(p.cat).toUpperCase(), inspected: tidy(p.last_inspected), council: tidy(p.authority_english),
        lat: c?.lat, lon: c?.lon, distanceKm: km };
    })
    .filter(t => t.distanceKm == null || t.distanceKm <= loc.radius / 1000)
    .sort(byDistance);
}

// SEPA licensed waste sites (landfill, transfer stations, scrapyards, recycling centres) near the pin.
// "KE - Transfer Station; TR - Transfer Station" -> ["Transfer Station"].
const wasteKinds = text => [...new Set(String(text || "").split(";")
  .map(part => tidy(part.replace(/^\s*[A-Z]{2,3}\s*[-:]\s*/, "").replace(/^Waste\s*-\s*/i, "")))
  .filter(Boolean))];

async function getWasteSites(loc) {
  if (!(await inScotland(loc))) return null;
  const features = await arcgisQuery(API.sepaWaste, loc, loc.radius, {
    outFields: "authorisation_activity,authorisation_description,authorisation_holder", returnGeometry: "true", outSR: "4326"
  });
  return features
    .map(f => {
      const a = f.attributes || {}, g = f.geometry || {};
      const kinds = wasteKinds(a.authorisation_activity);
      const where = tidy(String(a.authorisation_description || "").split(" --- ").pop());
      return { name: tidyCaps(where || a.authorisation_holder).replace(/\.$/, ""), kinds, landfill: kinds.some(k => /landfill/i.test(k)),
        mobile: /mobile plant/i.test(a.authorisation_description || ""),
        lat: g.y, lon: g.x, distanceKm: Number.isFinite(g.y) ? distanceKm(loc, { lat: g.y, lon: g.x }) : null };
    })
    .filter(s => !s.mobile)     // permits for mobile machines, not places
    .sort(byDistance);
}

// Past use of the land: old landfill (Environment Agency) and brownfield, contaminated land and major hazard sites
// (planning.data.gov.uk). In November 2026 the national contaminated land and major hazard datasets held no
// records at all, so finding none of those proves nothing: the topic never says "No issue found" because of them.
function checkLanduse(R) {
  if (isWales(R)) return checkLanduseWales(R);
  if (isScotland(R)) return checkLanduseScotland(R);
  const base = {
    source: { name: "Environment Agency Historic Landfill Sites; council brownfield registers on planning.data.gov.uk", url: LINKS.landfill }
  };
  const backup = backupFor(R, "landfill");
  if (!R.landfill.ok && !backup) return unavailable(base, R, "landfill");
  const sites = R.landfill.ok ? R.landfill.value : backup.sites;
  if (backup) base.source = { name: "Environment Agency Historic Landfill Sites, from Defra's copy (the Environment Agency map server was not answering); council brownfield registers on planning.data.gov.uk", url: LINKS.landfill };
  const nearest = sites[0];
  const nearby = okValue(R, "planningNearby") || [];
  const here = byDataset(okValue(R, "planningPoint"), "contaminated-land");
  const contaminated = byDataset(nearby, "contaminated-land");
  const comah = byDataset(nearby, "control-of-major-accident-hazards-site");
  const brownfield = byDataset(nearby, "brownfield-land");
  const council = okValue(R, "place")?.admin_district ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);

  // Landfill sets the rating: within 250 m "Look into this", up to 1 km "Worth checking", further "For information".
  let status = "info";
  const parts = [];
  if (sites.length) {
    const d = nearest.distanceKm ?? 0;
    status = d <= 0.25 ? "high" : d <= 1 ? "medium" : "info";
    parts.push(`${plural(sites.length, "old landfill site")} within ${within}, the nearest about ${formatDistance(nearest.distanceKm)} away.`);
  } else {
    parts.push(`No old landfill sites recorded within ${within}.`);
  }
  if (here.length) { status = "high"; parts.push("The council has recorded this land as contaminated."); }
  else if (contaminated.length) { if (status !== "high") status = "medium"; parts.push(`${plural(contaminated.length, "contaminated land site")} recorded nearby.`); }
  if (comah.length) { if (status !== "high") status = "medium"; parts.push(`${plural(comah.length, "major hazard site")} nearby.`); }
  if (!here.length && !contaminated.length) parts.push("Contaminated land is not published nationally: ask the council or rely on the environmental search.");
  // planning.data.gov.uk not answering: say so, rather than let these sites silently look absent.
  if (!R.planningNearby.ok || !R.planningPoint.ok) parts.push("Major hazard sites, brownfield land and council contaminated land records could not be checked right now (planning.data.gov.uk is not answering).");

  const wasteTypes = s => [s.household && "household", s.special && "hazardous (“special”)", s.industrial && "industrial",
    s.commercial && "commercial", s.inert && "inert (soil, rubble)"].filter(Boolean).join(", ") || "not recorded";
  const years = s => (s.firstinput || s.lastinput) ? `${(s.firstinput || "").slice(0, 4) || "?"}–${(s.lastinput || "").slice(0, 4) || "?"}` : "not recorded";
  const lines = [];
  if (comah.length) lines.push(`<li>Major hazard sites (${term("COMAH", "Control of Major Accident Hazards: sites storing large amounts of dangerous substances, such as chemicals or fuel")}): ${escapeHTML(comah.map(c => c.name).filter(Boolean).slice(0, 5).join(", "))}</li>`);
  if (brownfield.length) lines.push(`<li>${plural(brownfield.length, "brownfield site")} within ${within}. These are previously developed plots, often earmarked for new homes, which may mean building work nearby. Some were industrial in the past.</li>`);

  return {
    ...base, status, found: parts.join(" "),
    details: (sites.length ? `<div class="table-wrap"><table class="site-list"><thead><tr><th>Old landfill site</th><th>Distance</th><th>Waste</th><th>Years used</th></tr></thead><tbody>${
      sites.slice(0, 10).map(s => `<tr><td>${escapeHTML(s.site_name || "Unnamed site")}</td><td>${escapeHTML(formatDistance(s.distanceKm))}</td><td>${escapeHTML(wasteTypes(s))}</td><td>${escapeHTML(years(s))}</td></tr>`).join("")
    }</tbody></table></div>` : "") + (lines.length ? `<ul>${lines.join("")}</ul>` : ""),
    meaning: `<p>Old landfill can give off gas or affect the ground. Sites within 250 m usually get a closer look. Household and hazardous
      waste carry more risk than inert waste such as soil and rubble. The orange dots on the map show where the sites are.</p>
      <p>Rating: landfill within 250 m “Look into this”, 250 m to 1 km “Worth checking”, further away “For information”.</p>
      <p>Councils must keep a register of contaminated land, but registers are not published nationally, so this check cannot rule
      contamination out. Former petrol stations, factories, railways and gasworks are common sources. The environmental search your
      conveyancer orders looks at the past uses of the land.</p>`,
    actions: [
      ...(sites.length ? ["If a landfill site is very close, ask the council whether it has been investigated."] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

// Wales: old landfill sites and contaminated land are not published nationally, so with no coal tip nearby
// the topic stays "Check yourself" (missing data is never good news).
const COAL_TIP_CLOSE_KM = 0.25;

function checkLanduseWales(R) {
  const base = { source: { name: "Welsh Government, disused coal tips in Wales (DataMapWales)", url: LINKS.walesCoalTips } };
  if (!R.coalTips.ok) return unavailable(base, R, "coalTips");
  const tips = R.coalTips.value || [];
  const council = okValue(R, "place")?.admin_district ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);
  const close = tips.filter(t => t.distanceKm != null && t.distanceKm <= COAL_TIP_CLOSE_KM);
  const higher = tips.filter(t => t.category === "C" || t.category === "D");
  const status = close.length ? "medium" : tips.length ? "info" : "manual";
  const found = tips.length
    ? `${plural(tips.length, "disused coal tip")} within ${within}${tips[0].distanceKm == null ? "" : `, the nearest about ${formatDistance(tips[0].distanceKm)} away`}${higher.length ? ` (${plural(higher.length, "tip")} in the more often inspected categories C and D)` : ""}. Landfill and contaminated land are not published for Wales.`
    : `No disused coal tips within ${within}. Old landfill sites and contaminated land are not published for Wales, so check these another way.`;
  return {
    ...base, status, found,
    dataDate: `Coal tip map as of March 2026. Checked live on ${today()}`,
    details: tips.length ? `<div class="table-wrap"><table class="site-list"><thead><tr><th>Coal tip</th><th>Distance</th><th>Category</th><th>Last inspected</th></tr></thead><tbody>${
      tips.slice(0, 10).map(t => `<tr><td>${escapeHTML(t.id || "Unnamed tip")}</td><td>${escapeHTML(t.distanceKm == null ? "Nearby" : formatDistance(t.distanceKm))}</td><td>${escapeHTML(COAL_TIP_CATEGORY[t.category] || t.category || "Not recorded")}</td><td>${escapeHTML(t.inspected || "Not recorded")}</td></tr>`).join("")
    }</tbody></table></div>` : "",
    meaning: `<p>Wales has more than 2,000 disused coal tips, mostly in the south Wales valleys. The Welsh Government gives each one
      a category that sets how often it is inspected. Categories C and D are inspected most often, to check drainage and
      stability. This does not mean they are about to move. Categories A, B and R are much less likely to affect public safety.</p>
      <p>Rating: a coal tip within 250 m is “Worth checking”; further away it is “For information”. With no coal tip nearby this
      topic says “Check yourself”, because old landfill sites and contaminated land are not published for Wales.</p>
      <p>Former factories, petrol stations, railways and gasworks are common sources of contamination. The environmental search
      your conveyancer orders looks at the past uses of the land.</p>`,
    actions: [
      ...(tips.length ? [`See the tips on the ${link(LINKS.walesCoalTips, "Welsh Government's disused coal tips map")}, and ask ${escapeHTML(council)} about any close to the property.`] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area, and Natural Resources Wales about old landfill sites.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

// Scotland: SEPA licensed waste sites. Old (closed) landfill and contaminated land are not published nationally,
// so with no licensed landfill nearby the topic is never "No issue found".
function checkLanduseScotland(R) {
  const base = { source: { name: "SEPA, licensed waste sites (waste management licences and permits)", url: LINKS.sepaPermits } };
  if (!R.wasteSites.ok) return unavailable(base, R, "wasteSites");
  const sites = R.wasteSites.value || [];
  const council = okValue(R, "place")?.admin_district ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);
  const landfill = sites.filter(s => s.landfill);
  // Landfill uses the England rule: within 250 m "Look into this", up to 1 km "Worth checking". Other waste sites are for information.
  const d = landfill.length ? (landfill[0].distanceKm ?? 0) : null;
  const status = d != null ? (d <= 0.25 ? "high" : d <= 1 ? "medium" : "info") : sites.length ? "info" : "manual";
  const others = sites.length - landfill.length;
  const found = [
    landfill.length ? `${plural(landfill.length, "licensed landfill site")} within ${within}, the nearest about ${formatDistance(landfill[0].distanceKm)} away.` : "",
    others ? `${plural(others, "other licensed waste site")} (such as recycling centres, transfer stations or scrapyards) within ${within}.` : "",
    !sites.length ? `No licensed waste sites within ${within}.` : "",
    "Old, closed landfill sites and contaminated land are not published for Scotland, so check these another way."
  ].filter(Boolean).join(" ");
  return {
    ...base, status, found,
    details: sites.length ? `<div class="table-wrap"><table class="site-list"><thead><tr><th>Waste site</th><th>Distance</th><th>Activity</th></tr></thead><tbody>${
      sites.slice(0, 10).map(s => `<tr><td>${escapeHTML(s.name || "Unnamed site")}</td><td>${escapeHTML(formatDistance(s.distanceKm))}</td><td>${escapeHTML(s.kinds.join(", ") || "Not recorded")}</td></tr>`).join("")
    }</tbody></table></div>` : "",
    meaning: `<p>These are sites SEPA licenses to handle waste today, including landfill. Landfill can give off gas or affect the ground.
      Busy waste sites can also bring lorries, noise or smells. The dark green dots on the map show where the sites are.</p>
      <p>Rating: licensed landfill within 250 m “Look into this”, 250 m to 1 km “Worth checking”; other waste sites are “For information”.
      With no waste site nearby this topic says “Check yourself”, because old landfill sites and contaminated land are not published for Scotland.</p>
      <p>Former factories, petrol stations, railways, gasworks and mines are common sources of contamination. The environmental search
      your solicitor orders looks at the past uses of the land.</p>`,
    actions: [
      ...(sites.length ? [`Find out more about a site in ${link(LINKS.sepaPermits, "SEPA's authorisations and permits")} (search by its address).`] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area, and about any old landfill sites.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const landuseTopic = {
  id: "landuse", group: "ground", title: "Past use of the land: landfill and contamination",
  countries: ["England", "Scotland", "Wales"],
  data: {
    landfill: ["Old landfill sites", getLandfill, "Environment Agency"],
    coalTips: ["Disused coal tips in Wales", getCoalTips, "DataMapWales"],
    wasteSites: ["Licensed waste sites in Scotland", getWasteSites, "SEPA"]
  },
  deps: ["landfill", "planningPoint", "planningNearby", "coalTips", "wasteSites"],
  build: checkLanduse,
  icon: [ICON_PATHS.bin, "Land use"],
  viewing: ["Signs of past industrial use nearby: bare or patchy ground, vent pipes or fenced-off land."]
};

export { checkLanduse, getCoalTips, getLandfill, getWasteSites, landuseTopic };
