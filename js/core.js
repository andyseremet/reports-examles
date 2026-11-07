"use strict";
// Property Location Check – data sources, settings and shared helpers.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   DATA SOURCES
========================================================= */

const API = {
  nominatim: "https://nominatim.openstreetmap.org/search",
  // Backups (used only when the main service fails): OpenStreetMap reverse lookup for the place, Photon for address search.
  nominatimReverse: "https://nominatim.openstreetmap.org/reverse",
  photon: "https://photon.komoot.io/api/",
  postcodes: "https://api.postcodes.io/postcodes",
  places: "https://api.postcodes.io/places",
  planning: "https://www.planning.data.gov.uk/entity.json",
  // Backups when planning.data.gov.uk does not answer: the original publishers' own map services.
  heritageEngland: "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer",
  natureEngland: "https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services",
  conservationEngland: "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/Conservation_Areas/FeatureServer/0/query",
  radon: "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/radon/MapServer/0/query",
  landslides: "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer/2/query",
  // BGS 5 km and 1 km hexagon overviews (Open Government Licence): 6 = shrink-swell clay, 1 = mining other than coal.
  shrinkSwell: "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/6/query",
  otherMining: "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/1/query",
  coalHigh: "https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentHighRiskArea/FeatureServer/0/query",
  coalLow: "https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentLowRiskArea/FeatureServer/0/query",
  roadNoise: "https://environment.data.gov.uk/spatialdata/road-noise-all-metrics-england-round-4/wms",
  railNoise: "https://environment.data.gov.uk/spatialdata/rail-noise-england-round-4-all/wms",
  landfill: "https://environment.data.gov.uk/spatialdata/historic-landfill/ogc/features/v1/collections/Historic_Landfill_Sites/items",
  coastal: "https://environment.data.gov.uk/spatialdata/ncern-national-2024/ogc/features/v1/collections/",
  airModel: "https://air-quality-api.open-meteo.com/v1/air-quality",
  crime: "https://data.police.uk/api/crimes-street/all-crime",
  police: "https://data.police.uk/api/",
  surfaceWater: "https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms",
  // Backup only (planning.data.gov.uk not answering): the Environment Agency's own Flood Map for Planning.
  floodZones: "https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones/wms",
  sepaFlood: "https://map.sepa.org.uk/server/rest/services/Open/Flood_Maps/MapServer",
  nrwFlood: "https://datamap.gov.wales/geoserver/ows",
  dataMapWales: "https://datamap.gov.wales/geoserver/ows",
  hes: "https://inspire.hes.scot/arcgis/rest/services/HES/",
  natureScot: "https://ogc.nature.scot/geoserver/ows",
  scotProtected: "https://maps.gov.scot/server/rest/services/ScotGov/ProtectedSites/MapServer/",
  simd: "https://maps.gov.scot/server/rest/services/ScotGov/PeopleSociety/MapServer/7/query",
  scotAir: "https://geoserver.rcdo.co.uk/geoserver/scotarc/ows",
  sepaNoise: "https://map.sepa.org.uk/server/rest/services/Noise/",
  sepaWaste: "https://map.sepa.org.uk/server/rest/services/Open/Utility_and_Governmental_Services/MapServer/416/query",
  niHeritage: "https://services2.arcgis.com/BdBkthNLO9mzGAMO/arcgis/rest/services/Historic_Environment_Division_GIS_Data/FeatureServer/",
  niProtected: "https://gis.daera-ni.gov.uk/server/rest/services/NIEAEnvironmentViewer/ProtectedAreas/MapServer/",
  niNoise: "https://gis.daera-ni.gov.uk/server/rest/services/NoiseMapsRound4/",
  niCoast: "https://gis.daera-ni.gov.uk/server/rest/services/Marine/CoastalErosionStudy/MapServer/3/query",
  ods: "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations",
  landRegistry: "https://landregistry.data.gov.uk/landregistry/query",
  msoaBoundary: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Middle_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V3/FeatureServer/0/query"
};

const LINKS = {
  floodLongTerm: "https://www.gov.uk/check-long-term-flood-risk",
  floodWarnings: "https://check-for-flooding.service.gov.uk/",
  floodMapPlanning: "https://flood-map-for-planning.service.gov.uk/",
  floodRe: "https://www.floodre.co.uk/",
  ukradon: "https://www.ukradon.org/",
  bgsRadon: "https://www.bgs.ac.uk/datasets/radon-data-indicative-atlas-of-radon/",
  coalInfo: "https://www.gov.uk/guidance/using-coal-mining-information",
  geosure: "https://www.bgs.ac.uk/datasets/geosure/",
  otherMiningInfo: "https://www.bgs.ac.uk/datasets/mining-hazard-not-including-coal/",
  coalMap: "https://datamine-cauk.hub.arcgis.com/",
  noise: "https://www.gov.uk/government/publications/strategic-noise-mapping-2022",
  ukair: "https://uk-air.defra.gov.uk/aqma/",
  landfill: "https://www.data.gov.uk/dataset/17edf94f-6de3-4034-b66b-004ebd0dd010/historic-landfill-sites",
  planningData: "https://www.planning.data.gov.uk/",
  landslides: "https://www.bgs.ac.uk/datasets/national-landslide-database/",
  coastalMap: "https://www.gov.uk/check-coastal-erosion-management-in-your-area",
  walesCoast: "https://datamap.gov.wales/layers/geonode:nrw_ncerm_all_smp",
  walesCoalTips: "https://www.gov.wales/find-disused-coal-tips",
  walesNoise: "https://datamap.gov.wales/layergroups/geonode:Environmental_Noise_Mapping_2022",
  walesAir: "https://airquality.gov.wales/",
  cadw: "https://cadw.gov.wales/advice-support/cof-cymru/search-cadw-records",
  walesNature: "https://naturalresources.wales/guidance-and-advice/environmental-topics/wildlife-and-biodiversity/protected-areas-of-land-and-seas/",
  walesConservation: "https://datamap.gov.wales/layers/geonode:conservation_areas_wales",
  dataMapWales: "https://datamap.gov.wales/",
  hesPortal: "https://portal.historicenvironment.scot/",
  natureScotSites: "https://sitelink.nature.scot/home",
  scotNoise: "https://noise.environment.gov.scot/",
  dynamicCoast: "https://www.dynamiccoast.com/webmaps.html",
  scotAir: "https://www.scottishairquality.scot/laqm/aqma",
  sepaPermits: "https://www.sepa.org.uk/regulations/authorisations-and-permits/",
  simd: "https://simd.scot/",
  niHeritageViewer: "https://www.communities-ni.gov.uk/services/historic-environment-map-viewer",
  niNatureViewer: "https://www.daera-ni.gov.uk/services/natural-environment-map-viewer",
  niNoise: "https://www.daera-ni.gov.uk/services/noise-maps",
  niCoast: "https://www.infrastructure-ni.gov.uk/publications/baseline-study-and-gap-analysis-coastal-erosion-risk-management-ni",
  niAir: "https://www.airqualityni.co.uk/laqm/aqma",
  walesSchools: "https://mylocalschool.wales/",
  scotSchools: "https://www.gov.scot/publications/school-contact-details/",
  scotNhs: "https://www.nhsinform.scot/",
  niSchools: "https://www.education-ni.gov.uk/services/schools-plus",
  niGps: "https://www.nidirect.gov.uk/services/gp-practices",
  translink: "https://www.translink.co.uk/",
  niFloodMaps: "https://www.infrastructure-ni.gov.uk/topics/rivers-and-flooding/flood-maps-ni",
  simdAbout: "https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/",
  scotCrime: "https://www.gov.scot/collections/recorded-crime-in-scotland/",
  coastalData: "https://environment.data.gov.uk/dataset/9fede91f-5acd-4fd2-9bd8-98153fa3c2ff",
  geosure: "https://www.bgs.ac.uk/datasets/geosure/",
  police: "https://www.police.uk/",
  policeData: "https://data.police.uk/",
  epc: "https://www.gov.uk/find-energy-certificate",
  ofcom: "https://www.ofcom.org.uk/mobile-coverage-checker",
  historicEngland: "https://historicengland.org.uk/listing/the-list/",
  magic: "https://magic.defra.gov.uk/",
  sepaMaps: "https://map.sepa.org.uk/floodmaps",
  nrwMaps: "https://flood-risk-maps.naturalresources.wales/",
  osm: "https://www.openstreetmap.org/copyright",
  onsCrime: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/yearendingmarch2025",
  onsPopulation: "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/bulletins/populationestimatesforenglandandwales/mid2024",
  nomisCensus: "https://www.nomisweb.co.uk/sources/census_2021",
  whoNoise: "https://www.who.int/europe/publications/i/item/9789289053563",
  whoAir: "https://www.who.int/publications/i/item/9789240034228",
  whoRadon: "https://www.who.int/publications/i/item/9789241547673",
  ukRadonLevels: "https://www.ukradon.org/information/level",
  soldPrices: "https://www.gov.uk/search-house-prices",
  pricePaidData: "https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads"
};

const PLANNING_AT_POINT = [
  "flood-risk-zone", "air-quality-management-area", "conservation-area", "green-belt",
  "listed-building-outline", "site-of-special-scientific-interest",
  "ancient-woodland", "area-of-outstanding-natural-beauty", "national-park",
  "world-heritage-site", "contaminated-land", "hs2-safeguarded-area",
  "scheduled-monument"
];

const PLANNING_NEARBY = [
  "flood-risk-zone", "main-river", "air-quality-management-area",
  "contaminated-land", "brownfield-land", "control-of-major-accident-hazards-site",
  "listed-building", "conservation-area", "scheduled-monument",
  "site-of-special-scientific-interest", "ancient-woodland",
  "special-area-of-conservation", "special-protection-area",
  "local-nature-reserve", "hs2-safeguarded-area"
];

const STATUS_LABEL = {
  high: "Look into this",
  medium: "Worth checking",
  low: "No issue found",
  info: "For information",
  manual: "Check yourself",
  error: "Not available"
};
// A symbol for each rating, shown next to its colour, so the rating does not rely on colour alone.
const STATUS_SYMBOL = { high: "❗", medium: "⚠️", low: "✓", info: "ℹ️", manual: "?", error: "✕" };
// Small line icons for buttons (decorative: the button text says what it does).
const ICON_PATHS = {
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  bin: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'
};
const icon = name => `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;

const STATUS_ORDER = { high: 0, medium: 1, error: 2, info: 3, manual: 4, low: 5 };

const MAP_COLOURS = { landfill: "#b45309", landslide: "#7c3aed", hazard: "#b42318", contaminated: "#4b5563", coalTip: "#1f2937", wasteSite: "#166534" };

const REQUEST_TIMEOUT = 15000;   // a hung service gives up after 15 s; its topic is then tried once more (startTask)
const APP_VERSION = "1.36.0";
const APP_UPDATED = "7 November 2026";

let map, marker, radiusCircle, featureLayer, noiseLayer, reportMap;
let selected = null;      // {lat, lon, label}
let reportData = null;

const $ = id => document.getElementById(id);

/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function link(url, text) {
  return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(text)}</a>`;
}

// Words explained on the "What the words mean" page (glossary.html): the word as written → its id there.
const GLOSSARY = {
  "aqma": "aqma", "ancient woodland": "ancient-woodland", "brownfield": "brownfield", "con29m": "coal-mining-report",
  "coal tip": "coal-tip", "comah": "comah", "conservation area": "conservation-area", "contaminated land": "contaminated-land",
  "conveyancer": "conveyancer", "data zone": "data-zone", "deprivation": "deprivation", "environmental search": "environmental-search",
  "flood defence": "flood-defence", "flood zone": "flood-zone", "green belt": "green-belt", "groundwater flooding": "groundwater-flooding",
  "hs2": "hs2", "landfill": "landfill", "landslide": "landslide", "lden": "lden", "listed building": "listed-building",
  "local search": "local-search", "median": "median", "national landscape": "national-landscape", "no2": "no2", "pm2.5": "pm25",
  "radon": "radon", "scheduled monument": "scheduled-monument", "shoreline management plan": "shoreline-management-plan",
  "shrink-swell": "shrink-swell", "special area of conservation": "special-area", "sssi": "sssi", "surface water": "surface-water"
};
// A full address, so the links still work in a downloaded report.
const GLOSSARY_PAGE = new URL("glossary.html", location.href).href;

// A plain word with the technical meaning shown on hover. A word on the glossary page links to it.
function term(text, explanation) {
  const id = GLOSSARY[String(text).toLowerCase()];
  if (id) return `<a class="term" href="${GLOSSARY_PAGE}#${id}" target="_blank" rel="noopener" title="${escapeHTML(explanation)}">${escapeHTML(text)}</a>`;
  return `<abbr title="${escapeHTML(explanation)}">${escapeHTML(text)}</abbr>`;
}

function today() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function monthName(yyyyMm) {
  if (!yyyyMm) return "the latest month";
  return new Date(yyyyMm + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function distanceKm(a, b) {
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function formatDistance(km) {
  if (km == null) return "distance unknown";
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
}

function formatRadius(m) {
  return m >= 1000 ? (m / 1000) + " km" : m + " m";
}

// "a, b and c"
const andList = items => items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];

function plural(n, one, many) {
  return n + " " + (n === 1 ? one : (many || one + "s"));
}

function circleWkt(lat, lon, radiusM, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = 2 * Math.PI * i / steps;
    const dLat = radiusM / 110540 * Math.cos(a);
    const dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180)) * Math.sin(a);
    pts.push((lon + dLon).toFixed(5) + " " + (lat + dLat).toFixed(5));
  }
  return "POLYGON((" + pts.join(",") + "))";
}

// A square around a point, [west, south, east, north] in degrees: the one box used for every map query.
function boundingBox(lat, lon, radiusM) {
  const dLat = radiusM / 110540;
  const dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function parseWktPoint(wkt) {
  const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt || "");
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

function geometryCentre(geometry) {
  if (!geometry) return null;
  let sumLat = 0, sumLon = 0, n = 0;
  (function walk(c) {
    if (typeof c[0] === "number") { sumLon += c[0]; sumLat += c[1]; n++; }
    else c.forEach(walk);
  })(geometry.coordinates || []);
  return n ? { lat: sumLat / n, lon: sumLon / n } : null;
}

// The value of a data task that worked, otherwise null.
const okValue = (R, key) => R && R[key] && R[key].ok ? R[key].value : null;

// Nearest first; places with no known distance go last.
// ["a", "b", "c"] -> "a, b and c".
const listWords = items => items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
const sentenceStart = text => text.charAt(0).toUpperCase() + text.slice(1);
const byDistance = (a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99);

// A planning.data.gov.uk point ("POINT(lon lat)") with its distance from the pin.
function pointFrom(loc, wkt) {
  const p = parseWktPoint(wkt);
  return { distanceKm: p ? distanceKm(loc, p) : null, lat: p?.lat, lon: p?.lon };
}

// Load something once per visit; if it fails, the next call tries again.
function once(load) {
  let promise = null;
  return () => {
    if (!promise) { promise = load(); promise.catch(() => { promise = null; }); }
    return promise;
  };
}

// Fetch JSON, trying once more after a short pause if the service is briefly busy
// (network blip, "too many requests" or a server error).
// options.timeout: give up sooner on services that sometimes hang, then retry straight away.
// options.body: send a JSON body with POST (for example a list of postcodes).
// Some services refuse visitors who send many requests at once. Requests to
// these are queued: only a few at a time, with a short gap between starts,
// and a longer wait before trying again if one is refused.
const PACED_HOSTS = [
  { prefix: "https://environment.data.gov.uk/spatialdata/", maxAtOnce: 2, gapMs: 300, retryWaitsMs: [2000, 6000], timeoutMs: 35000 },
  // DataMapWales (Welsh Government): a report for a Welsh address asks it about 15 things, so they go a few at a time.
  { prefix: "https://datamap.gov.wales/", maxAtOnce: 4, gapMs: 100, retryWaitsMs: [1500, 4000], timeoutMs: 30000 },
  // Scotland: Historic Environment Scotland and NatureScot each get about 8 requests for a Scottish address.
  { prefix: "https://inspire.hes.scot/", maxAtOnce: 4, gapMs: 100, retryWaitsMs: [1500, 4000], timeoutMs: 30000 },
  { prefix: "https://ogc.nature.scot/", maxAtOnce: 4, gapMs: 100, retryWaitsMs: [1500, 4000], timeoutMs: 30000 },
  // Northern Ireland: DAERA's map server gets about 12 requests for an address there.
  { prefix: "https://gis.daera-ni.gov.uk/", maxAtOnce: 4, gapMs: 100, retryWaitsMs: [1500, 4000], timeoutMs: 30000 },
  // SEPA: a Scottish report asks it about 16 things (flood maps, noise, waste sites), and it sometimes slows to
  // 10-20 seconds an answer (6 November 2026), so they go a few at a time, with a longer wait and one more try.
  { prefix: "https://map.sepa.org.uk/", maxAtOnce: 4, gapMs: 100, retryWaitsMs: [1500, 4000], timeoutMs: 30000 }
];
const pacing = new Map();

function pacedSlot(rule) {
  let state = pacing.get(rule);
  if (!state) { state = { active: 0, lastStart: 0, waiting: [] }; pacing.set(rule, state); }
  const tryStart = () => {
    while (state.active < rule.maxAtOnce && state.waiting.length) {
      const wait = state.lastStart + rule.gapMs - Date.now();
      if (wait > 0) { clearTimeout(state.timer); state.timer = setTimeout(tryStart, wait); return; }
      state.active++;
      state.lastStart = Date.now();
      state.waiting.shift()();
    }
  };
  return new Promise(resolve => { state.waiting.push(resolve); tryStart(); })
    .then(() => {
      let done = false;
      return () => { if (!done) { done = true; state.active--; tryStart(); } };
    });
}

async function fetchJSON(url, options = {}, attempt = 1) {
  const rule = PACED_HOSTS.find(r => url.startsWith(r.prefix));
  const retryWaits = rule ? rule.retryWaitsMs : [options.timeout ? 300 : 1500];
  const release = rule ? await pacedSlot(rule) : null;
  try {
    return await fetchJSONOnce(url, options.timeout || (rule && rule.timeoutMs) || REQUEST_TIMEOUT, !!options.timeout || !!rule, options.body);
  } catch (error) {
    if (release) release();
    // A slow answer is tried once more; waiting for a third would keep the visitor too long.
    const slowAgain = error.timedOut && attempt > 1;
    if (attempt <= retryWaits.length && !slowAgain && (error.retryable || (rule && error.refused))) {
      await new Promise(resolve => setTimeout(resolve, retryWaits[attempt - 1]));
      return fetchJSON(url, options, attempt + 1);
    }
    throw error;
  } finally {
    if (release) release();
  }
}

async function fetchJSONOnce(url, timeoutMs, retryOnTimeout, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = { signal: controller.signal, headers: { "Accept": "application/json" } };
    if (body !== undefined) {
      request.method = "POST";
      request.body = JSON.stringify(body);
      request.headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, request);
    if (!response.ok) {
      const err = new Error("the data service replied with error " + response.status);
      err.retryable = response.status === 429 || response.status >= 500;
      err.refused = response.status === 403;
      throw err;
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      const err = new Error("the data service took too long to respond");
      err.retryable = retryOnTimeout;
      err.timedOut = true;
      throw err;
    }
    if (error instanceof TypeError) {
      const err = new Error("the data service could not be reached");
      err.retryable = true;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ArcGIS map services: what lies at the pin (or within distanceM of it).
function arcgisRequest(base, loc, distanceM, extra = {}) {
  const params = new URLSearchParams({
    geometry: loc.lon + "," + loc.lat, geometryType: "esriGeometryPoint", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: "false", f: "json", ...extra
  });
  if (distanceM) { params.set("distance", distanceM); params.set("units", "esriSRUnit_Meter"); }
  return fetchJSON(base + "?" + params).then(d => {
    if (d.error) throw new Error(d.error.message || "query failed");
    return d;
  });
}
const arcgisQuery = (base, loc, distanceM, extra) => arcgisRequest(base, loc, distanceM, extra).then(d => d.features || []);
