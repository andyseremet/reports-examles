// Property Location Check – topic: Flooding from rivers and the sea. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, formatRadius, link, LINKS, okValue, STATUS_LABEL } from "../core.js";
import { API, arcgisQuery } from "../api.js";
import { inNI, inScotland, inWales } from "../data.js";
import { backupFor, backupNote, byDataset, LEVEL_STATUS, planningList, SEPA_CHANCE, unavailable, WAVE, ZONE_STATUS,
  zoneFound, zoneLevel, zoneNumber } from "./helpers.js";

// Reservoir flooding (2.3.0): the reservoirs whose flood map covers the pin, if one failed on a normal day ("dry day")
// and if one failed while rivers were already flooding ("wet day"). England only: Wales, Scotland and Northern Ireland
// publish no such open map a web page can read, so the line is left out there.
async function getReservoirFlood(loc) {
  if (await inScotland(loc) || await inWales(loc) || await inNI(loc)) return null;
  // High-risk reservoirs (serious harm if one failed) first, then by name.
  const names = async base => [...new Map((await arcgisQuery(base, loc, 0, { outFields: "reservoir,risk_designation" }))
    .map(f => f.attributes || {}).filter(a => a.reservoir)
    .sort((a, b) => (b.risk_designation === "High-risk") - (a.risk_designation === "High-risk") || a.reservoir.localeCompare(b.reservoir))
    .map(a => [a.reservoir, a.reservoir])).keys()];
  const [dry, wet] = await Promise.all([names(API.reservoirDry), names(API.reservoirWet)]);
  return { dry, wet };
}

function checkFlood(R) {
  const base = {
    source: { name: "Environment Agency Flood Map for Planning (via planning.data.gov.uk)", url: LINKS.floodMapPlanning }
  };
  const country = okValue(R, "place")?.country || null;
  if (country === "Scotland" || country === "Wales") {
    if (!R.floodNational.ok) return unavailable(base, R, "floodNational");
    return country === "Scotland" ? floodScotland(base, R.floodNational.value) : floodWales(base, R.floodNational.value);
  }
  // planning.data.gov.uk not answering: the flood zones come from Defra's copy of the Environment Agency map instead.
  const backup = backupFor(R, "planningPoint");
  const fromBackup = backup && !backup.missing.includes("flood-risk-zone");
  if (!R.planningPoint.ok && !fromBackup) return unavailable(base, R, "planningPoint");
  if (fromBackup) base.source = { name: "Environment Agency Flood Map for Planning, via Defra (planning.data.gov.uk was not answering)", url: base.source.url };

  const levels = byDataset(planningList(R, "planningPoint"), "flood-risk-zone").map(e => Number(e["flood-risk-level"])).filter(Number.isFinite);
  const zone = levels.length ? Math.max(...levels) : 1;
  // Nearby flood zones: from planning.data.gov.uk, or from the backup when it is not answering (2.3.2).
  const nearbyBackup = backupFor(R, "planningNearby");
  const nearbyZonesChecked = R.planningNearby && (R.planningNearby.ok || (nearbyBackup && !nearbyBackup.missing.includes("flood-risk-zone")));
  const nearbyZones = byDataset(planningList(R, "planningNearby") || [], "flood-risk-zone");
  const rivers = [...new Set(byDataset(okValue(R, "planningNearby"), "main-river").map(r => r.name).filter(Boolean))].slice(0, 5);

  const level = zoneLevel(zone);
  const status = ZONE_STATUS[level], found = zoneFound(level, "rivers or the sea");
  const meaning = {
    3: "In any one year there is a 1 in 100 or greater chance of flooding from rivers, or 1 in 200 or greater from the sea, if there were no flood defences. Buildings insurance may cost more, and some lenders ask extra questions.",
    2: "In any one year there is between a 1 in 1,000 and a 1 in 100 chance of flooding from rivers (1 in 1,000 to 1 in 200 from the sea), if there were no flood defences.",
    1: "Less than a 1 in 1,000 chance of flooding from rivers or the sea in any one year. This does not cover flooding from heavy rain (surface water) or groundwater, so check those separately."
  }[level];

  let details = "";
  if (zone < 2 && nearbyZones.length) details += `<p>Land in Flood Zone 2 or 3 lies within ${formatRadius(R.loc.radius)}. Check how close it is on the ${link(LINKS.floodMapPlanning, "official flood map")}, especially for low-lying plots.</p>`;
  if (rivers.length) details += `<p>Main rivers within ${formatRadius(R.loc.radius)}: ${escapeHTML(rivers.join(", "))}.</p>`;
  if (fromBackup) details = backupNote(backup, ["flood-risk-zone"], [nearbyZonesChecked ? "main rivers nearby" : "flood zones and main rivers nearby"]) + details;
  details += reservoirNote(R.reservoirs);

  return {
    ...base, status, found, details, meaning: `<p>${meaning}</p>`,
    actions: [
      `Check flooding from groundwater and reservoirs on ${link(LINKS.floodLongTerm, "GOV.UK long-term flood risk")}.`,
      `See any flood warnings in force today on ${link(LINKS.floodWarnings, "GOV.UK Check for flooding")}.`,
      zone >= 2
        ? `Get a buildings insurance quote before you exchange contracts. Homes built before 2009 may be covered by ${link(LINKS.floodRe, "Flood Re")}, which helps keep insurance affordable.`
        : "Get a buildings insurance quote early, as a quick check."
    ],
    seller: ["Has the property ever flooded, and has there been any flood insurance claim?"],
    conveyancer: zone >= 2 ? ["A flood risk report (often part of the environmental search)."] : []
  };
}

// Reservoir flooding (2.3.0, owner, 8 November 2026): one line in this card, "For information", which never changes the
// card's rating. England only (getReservoirFlood answers null elsewhere, and this card's England part is the only one
// that shows it). A map that could not be read is said so, never taken as "not in an area".
function reservoirNote(result) {
  const label = `<strong>${STATUS_LABEL.info}, reservoirs:</strong>`;
  if (!result || !result.ok) return `<p>${label} the reservoir flood maps could not be checked just now. See them on ${link(LINKS.floodLongTerm, "GOV.UK long-term flood risk")}.</p>`;
  const r = result.value;
  if (!r) return "";
  const names = [...new Set([...r.dry, ...r.wet])];
  if (!names.length) return `<p>${label} not in an area that could flood if a large reservoir failed.</p>`;
  // At most 2 names (some contain commas, such as "Pen Pond Lower Lake, Richmond"), then how many more.
  const shown = names.length > 2 ? `${names.slice(0, 2).join("; ")} and ${names.length - 2} more` : names.join(" or ");
  const when = r.dry.length && r.wet.length ? "on a normal day or when rivers are already flooding"
    : r.dry.length ? "on a normal day" : "when rivers are already flooding";
  return `<p>${label} in an area that could flood if a large reservoir failed (${escapeHTML(shown)}), ${when}.
    The Environment Agency says reservoir flooding is extremely unlikely: large reservoirs are inspected regularly by
    qualified engineers, as the law requires.</p>`;
}

function floodScotland(base, f) {
  const worst = ["High", "Medium", "Low"].find(l => f.river === l || f.coastal === l) || null;
  // One source: "High likelihood of flooding from rivers." Two: "... from rivers (high) and the sea (low)."
  const sources = f.river && f.coastal
    ? [`rivers (${f.river.toLowerCase()})`, `the sea (${f.coastal.toLowerCase()})`]
    : [f.river ? "rivers" : "the sea"];
  return {
    ...base,
    source: { name: "SEPA flood maps (Scottish Environment Protection Agency)", url: LINKS.sepaMaps },
    status: worst ? LEVEL_STATUS[worst] : "low",
    found: worst ? `${worst} likelihood of flooding from ${sources.join(" and ")}.` : "Not in an area SEPA maps as at risk of flooding from rivers or the sea.",
    details: worst ? `<p>${worst} likelihood means ${SEPA_CHANCE[worst]}.</p>` : "",
    meaning: `<p>SEPA's maps show areas that could flood, with high (about 1 in 10 each year), medium (1 in 200) and low
      (1 in 1,000) likelihood. They do not account for every local defence.</p>`,
    actions: [`Look at the property on the ${link(LINKS.sepaMaps, "SEPA flood maps")}.`, "Get a buildings insurance quote early."],
    seller: ["Has the property ever flooded, and has there been any flood insurance claim?"],
    conveyancer: worst ? ["A flood risk report (often part of the environmental search)."] : []
  };
}

function floodWales(base, f) {
  const z = zoneNumber(f.zone);
  return {
    ...base,
    source: { name: "Natural Resources Wales, Flood Map for Planning", url: LINKS.nrwMaps },
    ...(f.published && { dataDate: "Published " + new Date(f.published).toLocaleDateString("en-GB") }),
    status: ZONE_STATUS[z], found: zoneFound(z, "rivers or the sea"),
    meaning: `<p>Natural Resources Wales maps Flood Zone 3 (1% or more chance each year from rivers, 0.5% from the sea) and
      Flood Zone 2 (0.1% to 1%), without flood defences. The map's official planning status depends on Welsh Government
      planning guidance (TAN 15).</p>`,
    actions: [`Look at the property on the ${link(LINKS.nrwMaps, "Natural Resources Wales flood risk maps")}.`, "Get a buildings insurance quote early."],
    seller: ["Has the property ever flooded, and has there been any flood insurance claim?"],
    conveyancer: z >= 2 ? ["A flood risk report (often part of the environmental search)."] : []
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const floodTopic = {
  id: "flood", group: "flood", title: "Flooding from rivers and the sea",
  countries: ["England", "Scotland", "Wales"],
  data: {
    reservoirs: ["Flooding if a reservoir failed", getReservoirFlood, "Environment Agency via Defra"]
  },
  deps: ["planningPoint", "planningNearby", "floodNational", "reservoirs"],
  build: checkFlood,
  icon: [WAVE(9) + WAVE(14) + WAVE(19), "Flood"],
  viewing: ["Water marks, staining or new plaster low on the walls, and flood doors, barriers or raised air bricks."]
};

export { checkFlood, floodTopic, getReservoirFlood, reservoirNote };
