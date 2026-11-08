// Property Location Check – topic: Planning restrictions and heritage. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { andList, escapeHTML, link, LINKS, PLANNING_AT_POINT, plural } from "../core.js";
import { LISTED_HERE_M, LISTED_NEAR_M } from "../data-wales.js";
import { backupFor, backupFrom, backupNote, byDataset, isNI, isScotland, isWales, planningList, sitesKey,
  unavailable } from "./helpers.js";

function checkPlanning(R) {
  if (isWales(R) || isScotland(R) || isNI(R)) return checkPlanningDevolved(R);
  const base = {
    source: { name: "planning.data.gov.uk (Ministry of Housing, Communities and Local Government)", url: LINKS.planningData }
  };
  const backup = backupFor(R, "planningPoint");
  if (!R.planningPoint.ok && !backup) return unavailable(base, R, "planningPoint");
  if (backup) base.source = { name: backupFrom(backup, PLANNING_AT_POINT.filter(d => d !== "flood-risk-zone")) + " (planning.data.gov.uk was not answering)", url: LINKS.historicEngland };

  const here = planningList(R, "planningPoint");
  const rules = [
    ["conservation-area", "Conservation area", "Extra permission is needed for demolition, some extensions, and work on trees."],
    ["listed-building-outline", "Listed building", "Listed building consent is needed for most changes, inside and out."],
    ["green-belt", "Green Belt", "New building is strictly limited."],
    ["area-of-outstanding-natural-beauty", "National Landscape", "Stricter planning rules apply to protect the landscape."],
    ["national-park", "National Park", "The National Park authority deals with planning, with stricter rules."],
    ["world-heritage-site", "World Heritage Site", "Development must protect the site's heritage value."],
    ["scheduled-monument", "Scheduled monument", "Works need consent from Historic England."],
    ["hs2-safeguarded-area", "HS2 safeguarded area", "Land may be affected by the HS2 railway project."]
  ];
  const applies = rules.filter(([ds]) => byDataset(here, ds).length)
    .map(([ds, name, what]) => ({ name, what, detail: byDataset(here, ds)[0].name }));
  const nearby = planningList(R, "planningNearby");
  const listedNear = nearby ? byDataset(nearby, "listed-building").filter(e => e.distanceKm != null && e.distanceKm <= 0.2) : [];
  // From the backup, some restrictions could not be checked: never call that "No issue found".
  const unchecked = backup ? rules.filter(([ds]) => backup.missing.includes(ds)).map(([, name]) => name) : [];

  return {
    ...base, status: applies.length ? "info" : unchecked.length ? "manual" : "low", ...(!applies.length && unchecked.length && { gap: "down" }),
    found: applies.length
      ? "Planning restrictions here: " + applies.map(a => a.name).join(", ") + "." +
        (unchecked.length ? ` ${andList(unchecked.map(n => n.replace(/^HS2 safeguarded area$/, "the HS2 safeguarded area")))} could not be checked right now.` : "")
      : unchecked.length
      ? `No conservation area, listed building, scheduled monument or protected landscape found here, but ${andList(unchecked.map(n => n.replace(/^Conservation area$/, "conservation areas").replace(/^HS2 safeguarded area$/, "the HS2 safeguarded area")))} could not be checked right now.`
      : "No conservation area, listed building, Green Belt or similar restriction found here.",
    details: (backup ? backupNote(backup, rules.map(([ds]) => ds), unchecked) : "") + (applies.length ? `<ul>${applies.map(a => `<li><strong>${escapeHTML(a.name)}</strong>${a.detail ? " (" + escapeHTML(a.detail) + ")" : ""}: ${escapeHTML(a.what)}</li>`).join("")}</ul>` : "") +
      (listedNear.length ? `<p>${plural(listedNear.length, "listed building")} within 200 m.</p>` : ""),
    meaning: "<p>These rules mainly matter if you plan to extend, alter or build. Not every council publishes this data yet.</p>",
    actions: [
      "Search the council's planning website by postcode for applications on and next to the property.",
      `Check listed buildings on the ${link(LINKS.historicEngland, "National Heritage List for England")}.`
    ],
    seller: ["Have any extensions or alterations been made? Are there planning permissions and building regulations sign-offs for them?"]
  };
}

// Wales: Cadw (listed buildings, scheduled monuments, historic parks and gardens, World Heritage Sites),
// conservation areas, and Natural Resources Wales (National Parks and National Landscapes), from DataMapWales.
// Scotland: Historic Environment Scotland (the same, plus gardens and designed landscapes and battlefields)
// and the Scottish Government (National Parks and National Scenic Areas).
function checkPlanningDevolved(R) {
  const scot = isScotland(R), ni = isNI(R), key = sitesKey(R);
  const base = { source: ni
    ? { name: "Department for Communities, Historic Environment Division (listed buildings, scheduled monuments, historic parks, battle sites); DAERA (AONBs and the World Heritage Site)", url: LINKS.niHeritageViewer }
    : scot
    ? { name: "Historic Environment Scotland (listed buildings, conservation areas, monuments, gardens, battlefields, World Heritage Sites); Scottish Government (National Parks and National Scenic Areas)", url: LINKS.hesPortal }
    : { name: "Cadw, Welsh councils' conservation areas and Natural Resources Wales (via DataMapWales)", url: LINKS.dataMapWales } };
  if (!R[key].ok) return unavailable(base, R, key);
  const w = R[key].value;
  const listedHere = w.listedHere.length
    ? [{ name: "Listed building", what: `A listed building is recorded within ${LISTED_HERE_M} m of the pin. It may be this property: listed building consent is needed for most changes, inside and out.`,
      detail: w.listedHere.map(b => b.name + (b.rank ? ` (${b.rank})` : "")).slice(0, 3).join("; ") }] : [];
  const rules = [
    [w.conservation, "Conservation area", "Extra permission is needed for demolition, some extensions, and work on trees."],
    [w.nationalPark, "National Park", "The National Park authority deals with planning, with stricter rules."],
    [w.landscape, scot ? "National Scenic Area" : ni ? "Area of Outstanding Natural Beauty" : "National Landscape", "Stricter planning rules apply to protect the landscape."],
    [w.heritage, "World Heritage Site", "Development must protect the site's heritage value."],
    [w.monument, "Scheduled monument", scot ? "Works need consent from Historic Environment Scotland." : ni ? "Works need consent from the Department for Communities." : "Works need consent from Cadw."],
    [w.park, scot ? "Garden or designed landscape" : ni ? "Historic park, garden or demesne" : "Registered historic park or garden", "The council must take the park or garden into account when deciding planning applications."],
    [w.battlefield || [], "Historic battlefield", "The council must take the battlefield into account when deciding planning applications."]
  ];
  const applies = [...rules.filter(([names]) => names.length).map(([names, name, what]) => ({ name, what, detail: names.slice(0, 3).join("; ") })), ...listedHere];
  // Northern Ireland publishes no national map of conservation areas, so "nothing found" is never "No issue found".
  const unknownConservation = !!w.conservationUnknown;
  const conservationNote = " Conservation areas are not published nationally for Northern Ireland: check with the council.";
  return {
    ...base, status: applies.length ? "info" : unknownConservation ? "manual" : "low",
    found: (applies.length
      ? "Planning restrictions here: " + applies.map(a => a.name).join(", ") + "."
      : unknownConservation ? "No listed building, scheduled monument, Area of Outstanding Natural Beauty or similar restriction found here."
      : "No conservation area, listed building, National Park or similar restriction found here.") + (unknownConservation ? conservationNote : ""),
    details: (applies.length ? `<ul>${applies.map(a => `<li><strong>${escapeHTML(a.name)}</strong>${a.detail ? " (" + escapeHTML(a.detail) + ")" : ""}: ${escapeHTML(a.what)}</li>`).join("")}</ul>` : "") +
      (w.listedNear ? `<p>${w.listedNearCapped ? "More than " + w.listedNear : plural(w.listedNear, "listed building")}${w.listedNearCapped ? " listed buildings" : ""} within ${LISTED_NEAR_M} m.</p>` : ""),
    meaning: unknownConservation
      ? `<p>These rules mainly matter if you plan to extend, alter or build. Conservation areas are drawn by each council and are not
        published as a national map, so this check cannot rule them out.</p>`
      : `<p>These rules mainly matter if you plan to extend, alter or build. Conservation areas are drawn by each council;
      the national map may be a little out of date, so check with the council.</p>`,
    actions: [
      unknownConservation ? "Ask the council's planning service whether the property is in a conservation area, and search its planning website for applications nearby."
        : "Search the council's planning website by postcode for applications on and next to the property.",
      ni ? `Check listed buildings and other historic sites on the ${link(LINKS.niHeritageViewer, "Historic Environment Map Viewer")}.`
      : scot ? `Check listed buildings and other historic sites on the ${link(LINKS.hesPortal, "Historic Environment Scotland portal")}.`
        : `Check listed buildings and other historic sites in ${link(LINKS.cadw, "Cadw's records")}.`
    ],
    seller: ["Have any extensions or alterations been made? Are there planning permissions and building regulations sign-offs for them?"]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const planningTopic = {
  id: "planning", group: "planning", title: "Planning restrictions and heritage",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  // data: only shared data (js/sources.js)
  deps: ["planningPoint", "planningNearby", "walesSites", "scotlandSites", "niSites"],
  build: checkPlanning,
  icon: ['<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>', "Planning"]
};

export { checkPlanning, planningTopic };
