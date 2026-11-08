// Property Location Check – topic: Schools, doctors and transport. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { andList, distanceKm, escapeHTML, formatDistance, formatRadius, link, LINKS, okValue, parseWktPoint,
  sentenceStart } from "../core.js";
import { API, fetchJSON, once } from "../api.js";
import { getPlace, inCircle, inNI, inScotland, inWales, planningEntities, titleCase } from "../data.js";
import { unavailable } from "./helpers.js";

// Everyday places nearby, from official sources:
// - schools: Department for Education register, via planning.data.gov.uk
// - bus, tram and underground stops: NaPTAN (Department for Transport), via planning.data.gov.uk
// - GP surgeries and pharmacies: NHS Organisation Data Service, located with postcodes.io
// - railway stations: NaPTAN national station list, saved with the app (data/rail-stations.json)
// "covers": the countries each register includes. Schools and stops (planning.data.gov.uk) are England only; the NHS
// Organisation Data Service lists GP surgeries and pharmacies in England and Wales; NaPTAN stations cover Great Britain.
const AMENITY_TYPES = [
  { key: "school", many: "schools", label: "School", short: "school", within: 1, covers: ["England"] },
  { key: "gp", many: "GP surgeries", label: "GP surgery", short: "GP", within: 2, covers: ["England", "Wales"] },
  { key: "pharmacy", many: "pharmacies", label: "Pharmacy", short: "pharmacy", within: 2, covers: ["England", "Wales"] },
  { key: "station", many: "railway stations", label: "Railway station", short: "station", within: 3, covers: ["England", "Wales", "Scotland"] },
  { key: "tram", many: "tram and underground stops", label: "Tram, metro or underground stop", short: "tram or underground", within: 1, covers: ["England"] },
  { key: "bus_stop", many: "bus stops", label: "Bus stop", short: "bus stop", within: 0.5, covers: ["England"] }
];

const getStationList = once(() => fetchJSON(new URL("../../data/rail-stations.json", import.meta.url).href));

async function getPlanningPlaces(loc) {
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return { school: [], bus_stop: [], tram: [] };   // England only
  const [schools, stops] = await Promise.all([
    planningEntities(inCircle(loc, 2000), ["educational-establishment"]),
    planningEntities(inCircle(loc, 1000), ["transport-access-node"])
  ]);
  const place = e => { const p = parseWktPoint(e.point); return p ? { name: e.name || "", ...p, distanceKm: distanceKm(loc, p) } : null; };
  const open = e => ["1", "3"].includes(String(e["educational-establishment-status"])) && !e["end-date"];
  return {
    school: schools.filter(open).map(place).filter(Boolean),
    bus_stop: stops.filter(e => ["BCT", "BCS", "BCQ"].includes(e["transport-access-node-type"])).map(place).filter(Boolean),
    tram: stops.filter(e => ["TMU", "MET", "PLT"].includes(e["transport-access-node-type"])).map(place).filter(Boolean)
  };
}

async function getNhsPlaces(loc) {
  if (await inScotland(loc) || await inNI(loc)) return { gp: [], pharmacy: [] };   // the NHS register covers England and Wales
  const [place, near] = await Promise.all([getPlace(loc), fetchJSON(API.postcodes.replace("/postcodes", "/outcodes") +
    "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=4000&limit=6").catch(() => ({ result: [] }))]);
  const outcodes = [...new Set([place && place.outcode, ...((near.result || []).map(o => o.outcode))].filter(Boolean))].slice(0, 6);
  if (!outcodes.length) return { gp: [], pharmacy: [] };
  const roles = { gp: "PrimaryRoleId=RO177&NonPrimaryRoleId=RO76", pharmacy: "PrimaryRoleId=RO182" };
  const lists = await Promise.all(Object.entries(roles).flatMap(([type, role]) => outcodes.map(oc =>
    fetchJSON(`${API.ods}?${role}&PostCode=${encodeURIComponent(oc)}&Status=Active&Limit=100`)
      .then(d => (d.Organisations || []).filter(o => (o.PostCode || "").startsWith(oc + " ")).map(o => ({ type, name: titleCase(o.Name), postcode: o.PostCode }))))));
  const orgs = lists.flat();
  // Find where each postcode is (postcodes.io accepts up to 100 at a time).
  const postcodes = [...new Set(orgs.map(o => o.postcode))];
  const where = {};
  for (let i = 0; i < postcodes.length; i += 100) {
    const res = await fetchJSON(API.postcodes, { body: { postcodes: postcodes.slice(i, i + 100) } });
    (res.result || []).forEach(r => { if (r.result) where[r.query] = { lat: r.result.latitude, lon: r.result.longitude }; });
  }
  const out = { gp: [], pharmacy: [] };
  orgs.forEach(o => { const p = where[o.postcode]; if (p) out[o.type].push({ name: o.name, ...p, distanceKm: distanceKm(loc, p) }); });
  return out;
}

async function getStations(loc) {
  if (await inNI(loc)) return { station: [] };   // NaPTAN covers Great Britain
  const data = await getStationList();
  return { station: data.stations.map(([name, lat, lon]) => ({ name, lat, lon, distanceKm: distanceKm(loc, { lat, lon }) }))
    .filter(x => x.distanceKm <= 10) };
}

async function getAmenities(loc) {
  const sources = [getPlanningPlaces, getNhsPlaces, getStations];
  const parts = await Promise.allSettled(sources.map(fn => fn(loc)));
  // A part that failed (for example a slow school search) is tried once more by itself, so one slow
  // service does not leave a gap in the report.
  if (parts.some(p => p.status === "rejected") && parts.some(p => p.status === "fulfilled")) {
    await new Promise(r => setTimeout(r, 3000));
    await Promise.all(parts.map(async (p, i) => {
      if (p.status === "rejected") parts[i] = (await Promise.allSettled([sources[i](loc)]))[0];
    }));
  }
  if (parts.every(p => p.status === "rejected")) throw parts[0].reason;
  const groups = {};
  parts.forEach(p => { if (p.status === "fulfilled") Object.assign(groups, p.value); });
  Object.values(groups).forEach(list => list.sort((a, b) => a.distanceKm - b.distanceKm));
  groups.missing = [["schools and stops", parts[0]], ["GP surgeries and pharmacies", parts[1]], ["railway stations", parts[2]]]
    .filter(([, p]) => p.status === "rejected").map(([name]) => name);
  return groups;
}

function checkAmenities(R) {
  const base = {
    source: { name: "Department for Education and the Department for Transport's list of stops, NaPTAN (via planning.data.gov.uk); NHS Organisation Data Service; Department for Transport railway stations (NaPTAN)", url: LINKS.planningData }
  };
  if (!R.amenities.ok) return unavailable(base, R, "amenities");
  const g = R.amenities.value;
  // Each register covers only some countries (AMENITY_TYPES "covers"); outside them a row says "Not covered".
  const country = okValue(R, "place")?.country || null;
  const notCoveredHere = t => !!country && !t.covers.includes(country);
  const rows = AMENITY_TYPES.map(t => {
    const list = notCoveredHere(t) ? [] : (g[t.key] || []);
    return { t, near: list[0], count: list.filter(x => x.distanceKm <= t.within).length, notCovered: notCoveredHere(t) };
  });
  const uncovered = rows.filter(x => x.notCovered);
  const noneCovered = uncovered.length === rows.length;
  const uncoveredText = uncovered.length
    ? ` ${sentenceStart(andList(uncovered.map(x => x.t.many)))} are not covered in ${country}.` : "";
  const nationalLinks = {
    Wales: [`Find schools on ${link(LINKS.walesSchools, "My Local School")}.`],
    Scotland: [`Find GP surgeries and pharmacies on ${link(LINKS.scotNhs, "NHS inform")}, and schools in the ${link(LINKS.scotSchools, "Scottish Government's school list")}.`],
    "Northern Ireland": [`Find GP practices on ${link(LINKS.niGps, "nidirect")}, schools on ${link(LINKS.niSchools, "Schools Plus")}, and trains and buses on ${link(LINKS.translink, "Translink")}.`]
  }[country] || [];
  const summary = rows.filter(x => x.near && x.near.distanceKm <= 5 && x.t.key !== "bus_stop" && x.t.key !== "tram").slice(0, 4)
    .map(x => `${x.t.short} ${formatDistance(x.near.distanceKm)}`);
  const missing = (g.missing || []).length
    ? `<p><strong>Not available right now:</strong> ${escapeHTML(g.missing.join(", "))}. Press “Refresh” later.</p>` : "";
  if (noneCovered) {
    return {
      ...base, status: "manual",
      found: `Not covered in ${country}: the registers we use for schools, GP surgeries, pharmacies and stations do not include it.`,
      meaning: "<p>Use the national services below to find schools, GP practices and public transport near the property.</p>",
      actions: [...nationalLinks, "Check school admission areas with the education authority before relying on a nearby school."]
    };
  }
  return {
    ...base, status: "info",
    found: ((summary.length ? "Nearest: " + summary.join(", ") + "." : (g.missing || []).length ? "" : "None of the places we check were found nearby.")
      + ((g.missing || []).length ? (summary.length ? " " : "") + "Not available right now: " + g.missing.join(", ") + "." : "") + uncoveredText).trim(),
    details: missing + `<div class="table-wrap"><table><thead><tr><th>Place</th><th>Nearest</th><th>Distance</th><th>Number nearby</th></tr></thead><tbody>${
      rows.map(x => x.notCovered
        ? `<tr><td>${escapeHTML(x.t.label)}</td><td colspan="3">Not covered in ${escapeHTML(country)}: this register covers ${escapeHTML(andList(x.t.covers))} only</td></tr>`
        : `<tr><td>${escapeHTML(x.t.label)}</td><td>${x.near ? escapeHTML(x.near.name || "Unnamed") : "None found nearby"}</td>
        <td>${x.near ? formatDistance(x.near.distanceKm) : "–"}</td><td>${x.count} within ${formatRadius(x.t.within * 1000)}</td></tr>`).join("")
    }</tbody></table></div>`,
    meaning: `<p>Distances are in a straight line from the pin, from official registers. Schools come from the Department
      for Education (England only). GP surgeries and pharmacies come from the NHS Organisation Data Service; each is placed
      by its postcode, so the distance is approximate. Bus, tram and underground stops and railway stations come from the
      Department for Transport's national list of public transport stops.</p>
      <p>Supermarkets and shops are not included because there is no official open list. School catchment areas and
      Ofsted ratings are not shown: check them with the council and on the Ofsted website.</p>`,
    actions: [...nationalLinks, "Check school admission areas with the council before relying on a nearby school.", "Try the journey to work or school at rush hour."]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const amenitiesTopic = {
  id: "amenities", group: "living", title: "Schools, doctors and transport",
  // countries: all four (England, Wales, Scotland and Northern Ireland)
  data: {
    amenities: ["Schools, doctors and transport", getAmenities, "NHS and planning.data.gov.uk"]
  },
  deps: ["amenities"],
  build: checkAmenities,
  icon: ['<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>', "Nearby"]
};

export { amenitiesTopic, checkAmenities, getAmenities };
