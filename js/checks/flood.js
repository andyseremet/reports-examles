"use strict";
// Property Location Check – checks in the "Flooding" section.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

function checkFlood(R) {
  const base = {
    source: { name: "Environment Agency Flood Map for Planning (via planning.data.gov.uk)", url: LINKS.floodMapPlanning }
  };
  const country = okValue(R, "place")?.country || null;
  if (country === "Scotland" || country === "Wales") {
    if (!R.floodNational.ok) return unavailable(base, R, "floodNational");
    return country === "Scotland" ? floodScotland(base, R.floodNational.value) : floodWales(base, R.floodNational.value);
  }
  // planning.data.gov.uk not answering: the flood zone at the pin can come from the Environment Agency instead.
  const backup = backupFor(R, "planningPoint");
  const fromBackup = backup && !backup.missing.includes("flood-risk-zone");
  if (!R.planningPoint.ok && !fromBackup) return unavailable(base, R, "planningPoint");
  if (fromBackup) base.source = { name: "Environment Agency Flood Map for Planning (planning.data.gov.uk was not answering)", url: base.source.url };

  const levels = byDataset(planningList(R, "planningPoint"), "flood-risk-zone").map(e => Number(e["flood-risk-level"])).filter(Number.isFinite);
  const zone = levels.length ? Math.max(...levels) : 1;
  const nearbyZones = byDataset(okValue(R, "planningNearby"), "flood-risk-zone");
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
  if (fromBackup) details = backupNote(backup, ["flood-risk-zone"], ["flood zones and main rivers nearby"]) + details;

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

// Flood Zones 1 to 3 (England and Wales): the rating and a one-line finding.
const zoneLevel = z => z >= 3 ? 3 : z === 2 ? 2 : 1;
const zoneNumber = text => text ? zoneLevel(Number((String(text).match(/\d/) || [1])[0])) : 1;
const ZONE_STATUS = { 3: "high", 2: "medium", 1: "low" };
function zoneFound(level, from, nameZone1 = true) {
  const chance = { 3: "High", 2: "Medium", 1: "Low" }[level];
  return `${chance} chance of flooding from ${from}` + (level > 1 || nameZone1 ? ` (Flood Zone ${level}).` : ".");
}
const SURFACE_MEANING = "Surface water flooding happens when heavy rain cannot drain away, even far from rivers.";

// SEPA likelihoods: high about 10% each year, medium 0.5%, low 0.1%.
const SEPA_CHANCE = { High: "about a 1 in 10 chance each year", Medium: "about a 1 in 200 chance each year", Low: "about a 1 in 1,000 chance each year" };
const LEVEL_STATUS = { High: "high", Medium: "medium", Low: "low" };

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

// Everyday places nearby.
