"use strict";
// Property Location Check – fetching data for Wales (DataMapWales).
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* ---------------------------------------------------------------
   Wales: DataMapWales (Welsh Government, Natural Resources Wales and Cadw), for the topics whose
   England data stops at the border. Outside Wales these return null without asking DataMapWales.
--------------------------------------------------------------- */
// Ask a DataMapWales layer for the features in a square around the pin (no shapes, only the named fields).
async function walesFeaturesNear(layer, fields, loc, metres, count = 50) {
  return (await wfsFeatures(API.dataMapWales, layer, loc, metres, { propertyName: fields.join(","), count })).map(f => f.properties || {});
}

// Areas the pin is inside: one request for all of them. The key is the layer name without its workspace.
const WALES_AT = {
  conservation: "geonode:conservation_areas_wales", monument: "inspire-wg:Cadw_SAM",
  park: "geonode:cadw_rhpg_registeredareas", heritage: "inspire-wg:vGeoServer_WorldHeritageSites_Public",
  nationalPark: "inspire-nrw:NRW_NATIONAL_PARK", landscape: "inspire-nrw:NRW_AONB",
  aqma: "geonode:aqmas_wales", sssi: "inspire-nrw:NRW_SSSI"
};
// Protected nature sites near the pin, with the field that holds each site's name.
const WALES_NATURE = [
  ["inspire-nrw:NRW_SSSI", "sssi_name", "Site of Special Scientific Interest"],
  ["inspire-nrw:NRW_SAC", "SAC_name", "Special Area of Conservation"],
  ["inspire-nrw:NRW_SPA", "SPA_Name", "Special Protection Area (birds)"],
  ["inspire-nrw:NRW_RAMSAR", "RAM_name", "Ramsar wetland"],
  ["inspire-nrw:NRW_NNR", "NNR_Name", "National Nature Reserve"],
  ["inspire-nrw:NRW_LNR", "lnr_name", "Local Nature Reserve"],
  ["inspire-nrw:NRW_ANCIENT_WOODLAND_INVENTORY_2021", "category_name", "Ancient woodland"]
];
const LISTED_NEAR_M = 200, LISTED_HERE_M = 20;
const tidy = v => String(v ?? "").replace(/\s+/g, " ").trim();

// Cadw listed buildings (points) within LISTED_NEAR_M, with the distance to each, in one request.
const WALES_LISTED_MAX = 500;
async function walesListedNear(loc) {
  const m = LISTED_NEAR_M, dLat = m / 111320, dLon = m / (111320 * Math.cos(loc.lat * Math.PI / 180));
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "inspire-wg:Cadw_ListedBuildings",
    propertyName: "geom,Name,Grade", srsName: "EPSG:4326", count: WALES_LISTED_MAX, outputFormat: "application/json",
    bbox: [loc.lat - dLat, loc.lon - dLon, loc.lat + dLat, loc.lon + dLon, "urn:ogc:def:crs:EPSG::4326"].join(",")
  });
  return ((await fetchJSON(API.dataMapWales + "?" + params)).features || []).map(f => {
    const c = geometryCentre(f.geometry);
    return { name: tidy(f.properties?.Name), grade: tidy(f.properties?.Grade), km: c ? distanceKm(loc, c) : Infinity };
  });
}

async function getWalesSites(loc) {
  if (!(await inWales(loc))) return null;
  const layers = Object.values(WALES_AT);
  const [atFeatures, nature, listed, aqmaNear] = await Promise.all([
    wmsInfo(API.dataMapWales, layers.join(","), loc, 0.00005, { feature_count: 50, buffer: 0 }),
    Promise.all(WALES_NATURE.map(([layer, field, kind]) => walesFeaturesNear(layer, [field], loc, loc.radius)
      .then(list => list.map(p => ({ kind, name: tidy(p[field]) }))))).then(lists => lists.flat()),
    walesListedNear(loc),
    walesFeaturesNear("geonode:aqmas_wales", ["title"], loc, loc.radius)
  ]);
  const at = {};
  Object.entries(WALES_AT).forEach(([key, layer]) => {
    const short = layer.split(":")[1] + ".";
    at[key] = atFeatures.filter(f => String(f.id || "").startsWith(short)).map(f => f.properties || {});
  });
  const name = (key, field) => [...new Set(at[key].map(p => tidy(p[field])).filter(Boolean))];
  return {
    conservation: name("conservation", "sitename"), monument: name("monument", "Name"), park: name("park", "site_name_en"),
    heritage: name("heritage", "Name"), nationalPark: name("nationalPark", "np_name"), landscape: name("landscape", "AONB_NAME"),
    aqma: name("aqma", "title"), sssi: name("sssi", "sssi_name"),
    nature, aqmaNear: [...new Set(aqmaNear.map(p => tidy(p.title)).filter(Boolean))],
    listedNear: listed.filter(b => b.km <= LISTED_NEAR_M / 1000).length,
    listedNearCapped: listed.length >= WALES_LISTED_MAX,
    listedHere: listed.filter(b => b.km <= LISTED_HERE_M / 1000).map(b => ({ name: b.name, rank: b.grade ? "Grade " + b.grade : "" }))
  };
}

// Welsh Government strategic noise maps (2022, Round 4): road ("RD") or railway ("RL"), at first-floor height.
// Wales publishes a 16-hour daytime level (7am to 11pm) instead of separate day and evening levels. 0 means not mapped (quiet).
const NOISE_PERIODS_16H = [
  { key: "l16h", metric: "L16H", name: "Daytime", when: "7am to 11pm" },
  { key: "lnight", metric: "LNGT", name: "Night", when: "11pm to 7am" },
  { key: "lden", metric: "LDEN", name: "24-hour average", when: "with extra weight for evening and night noise" }
];
async function getWalesNoise(loc, source) {
  const values = await wmsValuesAt(API.dataMapWales, NOISE_PERIODS_16H.map(p => `geonode:cog_WG_${source}_${p.metric}_All`), loc);
  return { wales: true, ...Object.fromEntries(NOISE_PERIODS_16H.map((p, i) => [p.key, roundNoise(values[i])])) };
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
