// Property Location Check – topic: Coastal erosion. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { boundingBox, escapeHTML, formatDistance, link, LINKS, term, today } from "../core.js";
import { API, arcgisQuery, fetchJSON } from "../api.js";
import { distanceToGeometryKm, geometryHas, inNI, inScotland, inWales, wfsFeatures, withDistance } from "../data.js";
import { tidy } from "../data-wales.js";
import { isNI, isScotland, isWales, unavailable } from "./helpers.js";

// England's coast: Environment Agency National Coastal Erosion Risk Map (NCERM 2024).
// Each area is land expected to be lost to the sea, with the shoreline plan in place and the
// sea level rise the Environment Agency advises planning for (the "70CC" layers).
// One request covers 1 km around the pin; a second, small one is made only if the pin is
// inside the area expected to be lost by 2105. Inland, nothing is found.
const COAST_NEAR_M = 1000;

async function getCoastalErosion(loc) {
  if (await inWales(loc)) return getWalesCoast(loc);
  if (await inScotland(loc)) return getScotlandCoast(loc);
  if (await inNI(loc)) return getNICoast(loc);
  const items = (layer, radiusM) => fetchJSON(API.coastal + layer + "/items?f=json&limit=200&bbox=" +
    boundingBox(loc.lat, loc.lon, radiusM).join(",")).then(d => d.features || []);
  const zones = await items("NCERM_SMP_2105_70CC", COAST_NEAR_M);
  const eroding = zones.filter(f => Number(f.properties.smp2105_70) > 0);
  const nearest = eroding
    .map(f => ({ f, km: geometryHas(f.geometry, loc) ? 0 : distanceToGeometryKm(f.geometry, loc) }))
    .sort((a, b) => a.km - b.km)[0];
  const closest = nearest ? nearest.f : zones
    .map(f => ({ f, km: distanceToGeometryKm(f.geometry, loc) })).sort((a, b) => a.km - b.km)[0]?.f;
  const inside2105 = !!nearest && nearest.km === 0;
  let metres2055 = null;
  if (inside2105) {
    const near = await items("NCERM_SMP_2055_70CC", 100);
    const hit = near.find(f => Number(f.properties.smp2055_70) > 0 && geometryHas(f.geometry, loc));
    if (hit) metres2055 = Number(hit.properties.smp2055_70);
  }
  const p = closest ? closest.properties : {};
  return {
    nearCoast: zones.length > 0,
    inside2105, inside2055: metres2055 != null,
    erosionKm: nearest ? nearest.km : null,
    metres2105: nearest ? Number(nearest.f.properties.smp2105_70) : null,
    metres2055,
    plan: { now: p.mt_smp || null, later: p.lt_smp || null, area: p.smp_name || null, defence: p.def_type || null },
    published: Math.max(0, ...zones.map(f => Number(f.properties.published) || 0)) || null
  };
}

// Natural Resources Wales coastal erosion map (NCERM), with the shoreline plans in place. Each area is the land
// expected to be lost by the end of one period: short term (to 2025), medium term (2025 to 2055), long term (2055 to 2105).
// Returned in the same shape as the England check, so the report reads the same.
async function getWalesCoast(loc) {
  const dLat = COAST_NEAR_M / 111320, dLon = COAST_NEAR_M / (111320 * Math.cos(loc.lat * Math.PI / 180));
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "geonode:nrw_ncerm_all_smp", count: 300,
    propertyName: "geom,epoch,short_smp,medium_smp,long_smp,smp_name", srsName: "EPSG:4326", outputFormat: "application/json",
    bbox: [loc.lat - dLat, loc.lon - dLon, loc.lat + dLat, loc.lon + dLon, "urn:ogc:def:crs:EPSG::4326"].join(",")
  });
  const zones = (await fetchJSON(API.dataMapWales + "?" + params)).features || [];
  // "21.7 - 28.3 metres" -> 28.3; "Negligible" -> 0.
  const upper = text => Math.max(0, ...(String(text || "").match(/[\d.]+/g) || []).map(Number));
  const period = (f, word) => String(f.properties.epoch || "").startsWith(word);
  const withKm = list => withDistance(list, loc);
  const by2105 = withKm(zones.filter(f => period(f, "Long") && upper(f.properties.long_smp) > 0));
  // Land lost by 2055: the short-term areas (to 2025) and the medium-term ones (2025 to 2055).
  const lostBy2055 = f => Math.max(upper(f.properties.short_smp), upper(f.properties.medium_smp));
  const by2055 = withKm(zones.filter(f => (period(f, "Medium") && upper(f.properties.medium_smp) > 0) ||
    (period(f, "Short") && upper(f.properties.short_smp) > 0)));
  const nearest = by2105[0] || by2055[0];
  const inside2055 = !!by2055[0] && by2055[0].km === 0;
  const inside2105 = inside2055 || (!!by2105[0] && by2105[0].km === 0);
  const anyZone = zones[0];
  return {
    country: "Wales",
    nearCoast: zones.length > 0,
    inside2105, inside2055,
    erosionKm: nearest ? nearest.km : null,
    metres2105: by2105[0] ? upper(by2105[0].f.properties.long_smp) : null,
    metres2055: inside2055 ? lostBy2055(by2055[0].f) : null,
    plan: { now: null, later: null, area: anyZone ? tidy(anyZone.properties.smp_name) : null, defence: null },
    published: null
  };
}

// Dynamic Coast (NatureScot): land expected to be lost to the sea by 2050 and by 2100, on the high-emissions
// forecast (the only one published as a map service). It maps Scotland's soft coasts (sand, gravel and soft
// rock); rocky coasts wear away too slowly to map. Returned in the same shape as the England check.
async function getScotlandCoast(loc) {
  const layer = name => wfsFeatures(API.natureScot, "dynamiccoast:" + name, loc, COAST_NEAR_M,
    { srsName: "EPSG:4326", count: 300, propertyName: "ERODETYPE,geom" });
  const [by2050, by2100, shore] = await Promise.all([
    layer("dc2erosion2050high"), layer("dc2erosion2100high"),
    wfsFeatures(API.natureScot, "dynamiccoast:dc2mhwsmodern", loc, COAST_NEAR_M, { count: 1, propertyName: "CELL" })
  ]);
  const lost = list => withDistance(list.filter(f => f.properties?.ERODETYPE === "ErodedArea" && f.geometry), loc);
  const soon = lost(by2050), later = lost(by2100);
  const inside2055 = !!soon[0] && soon[0].km === 0;
  const inside2105 = inside2055 || (!!later[0] && later[0].km === 0);
  const nearest = [soon[0], later[0]].filter(Boolean).sort((a, b) => a.km - b.km)[0];
  return {
    country: "Scotland", years: [2050, 2100],
    nearCoast: shore.length + by2050.length + by2100.length > 0,
    inside2105, inside2055,
    erosionKm: nearest ? nearest.km : null,
    metres2105: null, metres2055: null,
    plan: { now: null, later: null, area: null, defence: null },
    published: null
  };
}

// DfI and DAERA coastal erosion study (published 2019): the shoreline rated High, Moderate or Low for its potential to erode.
async function getNICoast(loc) {
  const features = await arcgisQuery(API.niCoast, loc, COAST_NEAR_M, { outFields: "risk", returnGeometry: "true", outSR: "4326" });
  const shore = features
    .map(f => ({ risk: tidy(f.attributes?.risk), km: f.geometry?.paths ? distanceToGeometryKm({ coordinates: f.geometry.paths }, loc) : null }))
    .filter(x => x.km != null).sort((a, b) => a.km - b.km);
  const nearest = risk => shore.find(x => x.risk === risk)?.km ?? null;
  return { country: "Northern Ireland", nearCoast: shore.length > 0, shoreKm: shore[0]?.km ?? null,
    highKm: nearest("High"), moderateKm: nearest("Moderate") };
}

const SHORELINE_PLAN = {
  "hold the line": "keep the existing sea defences",
  "advance the line": "build new defences further out to sea",
  "managed realignment": "let the coast move back in a planned way",
  "no active intervention": "no money is planned for sea defences"
};

function shorelinePlan(policy) {
  const words = SHORELINE_PLAN[String(policy || "").trim().toLowerCase()];
  return words ? `“${escapeHTML(policy)}” (${words})` : policy ? `“${escapeHTML(policy)}”` : "";
}

// Northern Ireland: the DfI and DAERA coastal erosion study (2019) rates the shoreline High, Moderate or Low for its
// potential to erode. It has no "land lost by year" areas, so the rating goes by the distance to the shore.
function checkCoastalNI(R) {
  const base = { source: { name: "Department for Infrastructure and DAERA, Baseline Study and Gap Analysis of Coastal Erosion Risk Management (2019, high-level risk appraisal)", url: LINKS.niCoast } };
  if (!R.coastal.ok) return unavailable(base, R, "coastal");
  const c = R.coastal.value;
  const meaning = `<p>The study rates each stretch of shoreline for its potential to wear away: High, Moderate or Low. It is a
      high-level, national appraisal: it does not say how far the coast will move or when, and it cannot give exact details for
      a single property.</p>
    <p>Rating: High-risk shore within 200 m is “Worth checking”; Moderate-risk shore within 200 m, or High-risk shore within 1 km,
      is “For information”.</p>`;
  if (!c.nearCoast) {
    return { ...base, status: "low", found: "Not near the coast: no shoreline is mapped within 1 km.",
      meaning: "<p>This check looks for shoreline within 1 km of the property that the coastal erosion study rates for erosion risk.</p>" };
  }
  const near = km => km != null && km <= 0.2;
  let status = "low", found;
  if (near(c.highKm)) {
    status = "medium";
    found = `Shoreline rated High for erosion risk is about ${formatDistance(c.highKm)} from the property.`;
  } else if (near(c.moderateKm) || c.highKm != null) {
    status = "info";
    found = near(c.moderateKm)
      ? `Shoreline rated Moderate for erosion risk is about ${formatDistance(c.moderateKm)} from the property.`
      : `The nearest shoreline rated High for erosion risk is about ${formatDistance(c.highKm)} away.`;
  } else {
    found = `The shore is about ${formatDistance(c.shoreKm)} away${c.moderateKm != null ? ", and the nearby coast is rated Low or Moderate for erosion risk" : " and rated Low for erosion risk"}.`;
  }
  return {
    ...base, status, found, meaning,
    actions: status === "low" ? [] : [
      `Read about the study on the ${link(LINKS.niCoast, "Department for Infrastructure website")}.`,
      "Ask the council how the coast here is changing, and whether any sea defences will be kept."
    ],
    seller: status === "low" ? [] : ["Has the cliff or shore near the property moved, or have the sea defences been repaired, in your time here?"],
    conveyancer: status === "low" ? [] : ["Does the environmental search cover coastal erosion, and will lenders and insurers accept the property?"]
  };
}

function checkCoastal(R) {
  if (isNI(R)) return checkCoastalNI(R);
  const wales = isWales(R), scot = isScotland(R);
  const agency = wales ? "Natural Resources Wales" : "the Environment Agency";
  const base = {
    source: scot
      ? { name: "Dynamic Coast (NatureScot and the Scottish Government), 2021, higher-emissions forecast", url: LINKS.dynamicCoast }
      : wales
      ? { name: "Natural Resources Wales, National Coastal Erosion Risk Map (NCERM, via DataMapWales)", url: LINKS.walesCoast }
      : { name: "Environment Agency, National Coastal Erosion Risk Map (NCERM 2024)", url: LINKS.coastalData }
  };
  if (!R.coastal.ok) return unavailable(base, R, "coastal");
  const c = R.coastal.value;
  if (c.published) base.dataDate = `Map last updated ${c.published}. Checked live on ${today()}`;
  const checker = scot ? link(LINKS.dynamicCoast, "Dynamic Coast map")
    : wales ? link(LINKS.walesCoast, "Natural Resources Wales coastal erosion map") : link(LINKS.coastalMap, "Check coastal erosion management in your area");
  const [soon, later] = c.years || [2055, 2105];
  const upTo = m => m != null ? ` (up to about ${m} m of land lost)` : "";
  if (!c.nearCoast) {
    return {
      ...base, status: "low",
      found: scot ? "No soft coast (sand, gravel or soft rock) is mapped within 1 km." : "Not near the coast: no coastline is mapped within 1 km.",
      meaning: "<p>This check looks for coast within 1 km of the property that is expected to wear away over the next 100 years.</p>" +
        (scot ? "<p>Dynamic Coast maps all of Scotland's soft coast. Rocky coasts wear away too slowly to be mapped.</p>" : "")
    };
  }
  const plan = c.plan.now || c.plan.later;
  const planLine = wales && c.plan.area
    ? `<p>This stretch of coast is covered by the ${term("shoreline management plan", `The long-term plan for this stretch of coast, agreed by the councils and ${agency}`)} ${escapeHTML(c.plan.area)}.</p>`
    : plan
    ? `<p>The local ${term("shoreline management plan", `The long-term plan for this stretch of coast, agreed by the council and ${agency}`)}
      ${c.plan.area ? `(${escapeHTML(c.plan.area)}) ` : ""}says ${shorelinePlan(c.plan.now)} until about 2055${c.plan.later && c.plan.later !== c.plan.now ? `, then ${shorelinePlan(c.plan.later)}` : ""}.</p>`
    : "";
  let status, found;
  if (c.inside2055) {
    status = "high";
    found = `The property is inside the area the coast is expected to reach by ${soon}${upTo(c.metres2055)}.`;
  } else if (c.inside2105) {
    status = "medium";
    found = `The property is inside the area the coast is expected to reach by ${later}${upTo(c.metres2105)}, but not by ${soon}.`;
  } else if (c.erosionKm != null && c.erosionKm <= 0.2) {
    status = "info";
    found = `The coast nearby is expected to wear away. The edge of the area expected to be lost by ${later} is about ${formatDistance(c.erosionKm)} from the property.`;
  } else {
    status = "low";
    found = c.erosionKm != null
      ? `The coast is within 1 km. The nearest area expected to be lost by ${later} is about ${formatDistance(c.erosionKm)} away.`
      : `The coast is within 1 km, but no land there is expected to be lost to the sea by ${later}.`;
  }
  return {
    ...base, status, found,
    meaning: `<p>Rating: inside the area expected to be lost by ${soon} is “Look into this”; by ${later} is “Worth checking”;
      within 200 m of it is “For information”.</p>
      ${planLine}
      <p>${scot
        ? `Dynamic Coast projects past shoreline change forward with rising sea levels. The online map uses the higher-emissions
          forecast, so it is a cautious view: with lower emissions, less land would be lost. It maps soft coasts (sand, gravel and soft rock) only.
          It is a national guide and cannot give exact details for a single property.`
        : `${wales ? "The map assumes the shoreline plan is carried out." : "The map assumes the shoreline plan is carried out and the sea level rise the Environment Agency advises planning for."}
      ${wales ? "Natural Resources Wales" : "The Environment Agency"} says it is a national guide and cannot give exact details for a single property.`}</p>`,
    actions: status === "low" ? [] : [
      scot ? `See how this stretch of coast is changing on the ${checker}.` : `See the map and the plan for this stretch of coast on ${checker}.`,
      "Ask the council's coastal team how the coast here is changing, and whether the defences will be kept."
    ],
    seller: status === "low" ? [] : ["Has the cliff or shore near the property moved, or have the sea defences been repaired, in your time here?"],
    conveyancer: status === "low" ? [] : ["Does the environmental search cover coastal erosion, and will lenders and insurers accept the property?"]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const coastalTopic = {
  id: "coastal", group: "ground", title: "Coastal erosion",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  data: {
    coastal: ["Coastal erosion", getCoastalErosion, "Environment Agency (Wales: DataMapWales; Scotland: NatureScot; NI: DAERA)"]
  },
  deps: ["coastal"],
  build: checkCoastal,
  icon: ['<path d="M3 20V8l5-2 3 4h2v10"/>' + '<path d="M13 17c2 0 2-1.5 4-1.5s2 1.5 4 1.5"/>', "Coast"],
  viewing: ["How far the house is from the cliff edge or shore, and the state of any sea defences."]
};

export { checkCoastal, coastalTopic, getCoastalErosion };
