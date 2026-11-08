"use strict";
// Property Location Check – outside data service addresses (API), request pacing and the fetch helpers.
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
  // Backup only (the Environment Agency map server not answering): Defra's copy of the same register on ArcGIS Online.
  landfillBackup: "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/HistoricLandfill/FeatureServer/0/query",
  // Past floods, England (2.1.0, owner, 8 November 2026): Defra's copy of the Environment Agency Historic Flood Map.
  pastFloods: "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/HistoricFloodMap/FeatureServer/0/query",
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
