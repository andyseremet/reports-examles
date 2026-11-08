// Property Location Check – automatic test
//
// Checks that every data service the page relies on still answers (and still
// allows web pages to read it), then opens the page in a browser on desktop,
// phone and tablet, runs reports and tests the main features.
//
// Usage:
//   BASE=https://andyseremet.github.io/reports-examles/ node tests/live-check.mjs
//   BASE=http://localhost:8080/index.html node tests/live-check.mjs
//
// Writes test-results/summary.md, test-results/results.json and screenshots.
// Exits with code 1 if anything failed.

import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";

const BASE = process.env.BASE || "https://andyseremet.github.io/reports-examles/";
const OUT = process.env.OUT || "test-results";
const ORIGIN = "https://andyseremet.github.io";
const UA = "property-location-check-tests (https://github.com/andyseremet/reports-examles)";
mkdirSync(OUT, { recursive: true });

const results = [];
// pass: true, false, or "warn". A warning is shown in the summary but does not fail the run.
// QUIET=1 prints only warnings, failures and the total (shorter output to read). On GitHub, each failure
// and warning is also an annotation, so it shows on the pull request without opening the full log.
const QUIET = process.env.QUIET === "1";
const ON_GITHUB = process.env.GITHUB_ACTIONS === "true";
// DATA_SERVICES=0 leaves out the outside services that only supply report data (the list in data/data-services.csv):
// pull requests do this, so they test the app itself. The daily run and manual runs (by default) check them all.
// The postcode lookup and address search (marked alwaysChecked) are always checked: the app needs them to find the place.
const CHECK_DATA_SERVICES = process.env.DATA_SERVICES !== "0";
// ONLY_SERVICES="name|name": check just these data services and stop (after-merge.sh asks failed ones again).
const ONLY_SERVICES = (process.env.ONLY_SERVICES || "").split("|").filter(Boolean);
const isReportDataService = ([, , , options = {}]) => !options.alwaysChecked && !options.sameSite;

// Steady pull request checks (2.0.0, quiz of 7 November 2026). RECORD=1 (daily and manual runs) saves each answer the
// report pages get from outside data services to recordings.json, which the workflow publishes to the "status" branch.
// REPLAY=<address or file> (pull requests) answers the report pages from that copy, so an outside outage cannot turn a
// pull request red. A question that was never recorded (for example a new topic) is asked live and named in the result.
// Only data requests (fetch/XHR) from the page to other sites are recorded or replayed: map pictures, the app's own
// files and the map library (which sw.js downloads for offline use) stay live.
// A test step's own stub (page.route) always comes first, so stubs are never recorded and still apply on replay.
const RECORD = process.env.RECORD === "1";
const REPLAY = process.env.REPLAY || "";
const recorded = {};
let replayData = null, replayed = 0;
const askedLive = new Set();
const recKey = req => {
  const dated = s => String(s || "").replace(/\d{4}-\d{2}-\d{2}/g, "DATE");   // a date in a query (sale prices since…) changes daily
  return `${req.method()} ${dated(req.url())}${req.postData() ? " " + dated(req.postData()) : ""}`;
};
const isOutsideData = req => {
  if (!["fetch", "xhr"].includes(req.resourceType())) return false;
  if (req.serviceWorker()) return false;   // sw.js saving the map library for offline use: app files, not data
  const host = new URL(req.url()).host;
  return host !== new URL(BASE).host && host !== "raw.githubusercontent.com";
};
const TEXT_TYPE = /json|text|xml|javascript/;
async function loadReplay() {
  if (!REPLAY) return;
  try {
    replayData = /^https?:/.test(REPLAY) ? await (await fetch(REPLAY, { headers: { "User-Agent": UA } })).json()
      : JSON.parse(readFileSync(REPLAY, "utf8"));
    if (!replayData || !replayData.answers) throw new Error("no answers in the file");
  } catch (e) {
    replayData = null;
    console.log(`No recorded answers (${e.message}): every outside service is asked live.`);
  }
}
// Called for every browser context the test opens.
async function steadyContext(context) {
  if (!RECORD && !replayData) return;
  const goneLive = new WeakSet();
  await context.route(() => true, route => {
    const req = route.request();
    if (!isOutsideData(req)) return route.fallback();
    if (replayData) {
      const hit = replayData.answers[recKey(req)];
      if (hit) {
        replayed++;
        return route.fulfill({ status: hit.status, contentType: hit.type, headers: { "access-control-allow-origin": "*" },
          body: hit.text !== undefined ? hit.text : Buffer.from(hit.base64, "base64") });
      }
      askedLive.add(new URL(req.url()).host);
    }
    goneLive.add(req);
    return route.fallback();
  });
  if (RECORD) context.on("requestfinished", async req => {
    if (!goneLive.has(req)) return;
    try {
      const res = await req.response();
      if (!res || res.status() >= 400) return;          // only working answers are kept
      const type = res.headers()["content-type"] || "application/octet-stream";
      const body = await res.body();
      recorded[recKey(req)] = { at: new Date().toISOString(), status: res.status(), type,
        ...(TEXT_TYPE.test(type) ? { text: body.toString("utf8") } : { base64: body.toString("base64") }) };
    } catch (e) { /* the page was closed before the answer was read */ }
  });
}
const annotation = text => String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const record = (group, name, pass, info = "", ms) => {
  results.push({ group, name, pass: pass === "warn" ? true : pass, warn: pass === "warn", info: String(info).slice(0, 900), ...(ms !== undefined && { ms }) });
  const label = pass === "warn" ? "WARN" : pass ? "PASS" : "FAIL";
  if (!QUIET || label !== "PASS") console.log(`${label}  [${group}] ${name}${info ? "  – " + String(info).slice(0, 160) : ""}`);
  if (ON_GITHUB && label !== "PASS")
    console.log(`::${label === "FAIL" ? "error" : "warning"} title=${annotation(`[${group}] ${name}`).replace(/[,:]/g, " ")}::${annotation(String(info).slice(0, 300))}`);
};
// Runs one test step and records its result and how long it took (tests/digest.mjs lists the slowest).
// A step returns its details (a string), false for a plain failure, or { warn } for an allowed warning.
const timedStep = group => async (name, fn) => {
  const t0 = Date.now(), ms = () => Date.now() - t0;
  try {
    const info = await fn();
    if (info && info.warn) record(group, name, "warn", info.warn, ms());
    else record(group, name, info !== false, info === false ? "" : info || "", ms());
  } catch (e) { record(group, name, false, e.message.split("\n")[0], ms()); }
};

// The Environment Agency map server sometimes refuses GitHub's shared test machines
// outright ("403 Forbidden") for many minutes, while answering everyone else. That
// refusal, and only that, is recorded as a warning instead of a failure. Anything
// else from this server (slow, wrong content, other errors) still fails.
const EA_MAP_SERVER = "environment.data.gov.uk/spatialdata/";
const EA_TOPICS = ["surfacewater", "landuse", "coastal", "noise"];
const EA_REFUSAL_NOTE = "the Environment Agency map server refused GitHub's test machine (403), as it often does with GitHub's shared machines; if this repeats for days, check the live site by hand";

/* ---------------------------------------------------------------
   1. Data services: answer, expected content, and readable by web pages (CORS)
--------------------------------------------------------------- */
const LAT = 53.5526, LON = -1.4797;            // Barnsley town centre
const box = (lat, lon, d = 0.0005) => [lat - d, lon - d, lat + d, lon + d].join(",");
const wms = (base, layer, lat = LAT, lon = LON, d = 0.0005) => `${base}?` + new URLSearchParams({
  service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers: layer, query_layers: layer, styles: "",
  crs: "EPSG:4326", bbox: box(lat, lon, d), width: 11, height: 11, i: 5, j: 5, info_format: "application/json"
});
const arcgis = (base, extra = "") => `${base}?geometry=${LON},${LAT}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json${extra}`;

const SERVICES = [
  ["Postcodes (postcodes.io)", `https://api.postcodes.io/postcodes?lon=${LON}&lat=${LAT}&limit=1`, d => d.result && d.result[0].postcode, { alwaysChecked: true }],
  ["Planning data (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?latitude=${LAT}&longitude=${LON}&limit=5`, d => Array.isArray(d.entities)],
  ["Surface water (Environment Agency)", wms("https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms", "rofsw"), d => Array.isArray(d.features)],
  ["Radon (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/radon/MapServer/0/query"), d => d.features && d.features.length === 1],
  ["Landslides (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer/2/query", "&distance=1000&units=esriSRUnit_Meter"), d => Array.isArray(d.features)],
  ["Coal mining (Mining Remediation Authority)", arcgis("https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentLowRiskArea/FeatureServer/0/query"), d => d.features && d.features.length >= 1],
  ["Road noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/road-noise-all-metrics-england-round-4/wms", "Road_Noise_Lden_England_Round_4_All"), d => Array.isArray(d.features)],
  ["Rail noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/rail-noise-england-round-4-all/wms", "Rail_Noise_Lden_England_Round_4_All_1000Hz"), d => Array.isArray(d.features)],
  ["Historic landfill (Environment Agency)", `https://environment.data.gov.uk/spatialdata/historic-landfill/ogc/features/v1/collections/Historic_Landfill_Sites/items?f=json&limit=5&bbox=${LON - 0.02},${LAT - 0.02},${LON + 0.02},${LAT + 0.02}`, d => Array.isArray(d.features)],
  ["Coastal erosion (Environment Agency)", "https://environment.data.gov.uk/spatialdata/ncern-national-2024/ogc/features/v1/collections/NCERM_SMP_2105_70CC/items?f=json&limit=5&bbox=1.52,52.82,1.54,52.83",
    d => Array.isArray(d.features) && d.features.some(f => f.properties.smp2105_70 > 0)],
  ["Sold prices (HM Land Registry)", "https://landregistry.data.gov.uk/landregistry/query?query=" + encodeURIComponent(
    'PREFIX ppi: <http://landregistry.data.gov.uk/def/ppi/> PREFIX lrc: <http://landregistry.data.gov.uk/def/common/> ' +
    'SELECT ?price WHERE { VALUES ?pc { "S70 2TA" "S70 1SL" "S70 2AT" } ?a lrc:postcode ?pc . ?s ppi:propertyAddress ?a ; ppi:pricePaid ?price } LIMIT 5'),
    d => d.results && d.results.bindings.length > 0],
  ["Air quality model (Open-Meteo)", `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&hourly=pm2_5&past_days=1&forecast_days=0&timeformat=unixtime`, d => d.hourly && d.hourly.pm2_5.length > 0],
  ["Crime (data.police.uk)", `https://data.police.uk/api/crimes-street/all-crime?lat=${LAT}&lng=${LON}`, d => Array.isArray(d) && d.length > 0, { alwaysChecked: true }],
  ["Police force for a place (data.police.uk)", `https://data.police.uk/api/locate-neighbourhood?q=${LAT},${LON}`, d => d.force === "south-yorkshire"],
  ["Census boundaries (ONS)", "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Middle_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V3/FeatureServer/0/query?where=MSOA21CD%3D%27E02001521%27&outFields=MSOA21CD&returnGeometry=false&f=json", d => d.features && d.features.length === 1],
  ["Scotland flood maps (SEPA)", "https://map.sepa.org.uk/server/rest/services/Open/Flood_Maps/MapServer/2/query?geometry=-3.43,56.404&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnCountOnly=true&f=json", d => Number.isFinite(d.count)],
  ["Wales flood maps (Natural Resources Wales)", wms("https://datamap.gov.wales/geoserver/ows", "inspire-nrw:NRW_FLOODZONE_RIVERS_SEAS_MERGED", 51.47, -3.188, 0.00005), d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales heritage, nature and air sites (DataMapWales)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:conservation_areas_wales", 51.4816, -3.1791, 0.00005),
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales noise maps (Welsh Government)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:cog_WG_RD_LDEN_All", 51.488, -3.16),
    d => Array.isArray(d.features) && d.features[0] && d.features[0].properties.GRAY_INDEX > 0],
  ["Wales coastal erosion (Natural Resources Wales)", "https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geonode:nrw_ncerm_all_smp&propertyName=epoch&count=5&outputFormat=application/json&bbox=52.48,-4.06,52.49,-4.04,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales disused coal tips (Welsh Government)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:disused_coal_tips_in_wales_public", 51.6265, -3.452, 0.01),
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland heritage sites (Historic Environment Scotland)", "https://inspire.hes.scot/arcgis/rest/services/HES/Conservation_Areas/MapServer/0/query?geometry=-3.1907,55.9497&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DES_TITLE&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland protected nature sites (NatureScot)", "https://ogc.nature.scot/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=protectedareas:sssi&propertyName=NAME&count=5&outputFormat=application/json&bbox=55.94,-3.17,55.95,-3.15,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland National Parks and Scenic Areas (Scottish Government)", "https://maps.gov.scot/server/rest/services/ScotGov/ProtectedSites/MapServer/0/query?geometry=-3.95,57.08&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=npname&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland air pollution hotspots (Scottish Air Quality)", "https://geoserver.rcdo.co.uk/geoserver/scotarc/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=scotarc:scottland_aqma_3857&propertyName=title&count=5&outputFormat=application/json&bbox=55.949,-3.191,55.950,-3.190,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland noise maps (SEPA)", "https://map.sepa.org.uk/server/rest/services/Noise/Noise_Road_LDEN_ALL/ImageServer/identify?geometry=" + encodeURIComponent('{"x":-3.1907,"y":55.9497,"spatialReference":{"wkid":4326}}') + "&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json",
    d => Number(d.value) > 0],
  ["Scotland coastal erosion (Dynamic Coast)", "https://ogc.nature.scot/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=dynamiccoast:dc2erosion2100high&propertyName=ERODETYPE&count=5&outputFormat=application/json&bbox=55.946,-3.12,55.964,-3.09,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland licensed waste sites (SEPA)", "https://map.sepa.org.uk/server/rest/services/Open/Utility_and_Governmental_Services/MapServer/416/query?geometry=-4.25,55.86&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=3000&units=esriSRUnit_Meter&outFields=authorisation_activity&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland crime rank (Scottish Government, SIMD 2020)", "https://maps.gov.scot/server/rest/services/ScotGov/PeopleSociety/MapServer/7/query?geometry=-3.1907,55.9497&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=crimerank&returnGeometry=false&f=json",
    d => d.features && d.features.length === 1 && d.features[0].attributes.crimerank > 0],
  ["Northern Ireland heritage (Department for Communities)", "https://services2.arcgis.com/BdBkthNLO9mzGAMO/arcgis/rest/services/Historic_Environment_Division_GIS_Data/FeatureServer/1/query?geometry=-5.9301,54.5964&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=200&units=esriSRUnit_Meter&returnCountOnly=true&f=json",
    d => d.count > 0],
  ["Northern Ireland protected areas (DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/NIEAEnvironmentViewer/ProtectedAreas/MapServer/2/query?geometry=-5.893,54.212&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NAME&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Northern Ireland noise maps (DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/NoiseMapsRound4/Agglomeration_Roads/MapServer/identify?geometry=-5.946,54.592&geometryType=esriGeometryPoint&sr=4326&layers=all:0&tolerance=0&mapExtent=-5.96,54.58,-5.93,54.60&imageDisplay=200,200,96&returnGeometry=false&f=json",
    d => Array.isArray(d.results) && Number(d.results[0]?.attributes?.["Classify.Pixel Value"]) > 0],
  ["Northern Ireland coastal erosion (DfI and DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/Marine/CoastalErosionStudy/MapServer/3/query?geometry=-5.90,54.66&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=1000&units=esriSRUnit_Meter&outFields=risk&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Address search (OpenStreetMap Nominatim)", "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=Barnsley%20Town%20Hall", d => Array.isArray(d) && d.length > 0],
  ["Schools register (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?dataset=educational-establishment&latitude=${LAT}&longitude=${LON}&limit=1`, d => Array.isArray(d.entities)],
  ["Heritage backup (Historic England)", "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query?geometry=-2.3590,51.3811&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=100&units=esriSRUnit_Meter&outFields=Name&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Clay shrink-swell (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/6/query"), d => d.features && d.features.length === 1],
  ["Mining other than coal (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/1/query"), d => d.features && d.features.length === 1],
  ["Conservation areas backup (Historic England)", "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/Conservation_Areas/FeatureServer/0/query?geometry=-2.3590,51.3811&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NAME&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Place backup (OpenStreetMap reverse lookup)", `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${LAT}&lon=${LON}`, d => d.address && d.address["ISO3166-2-lvl4"] === "GB-ENG", { alwaysChecked: true }],
  ["Address search backup (Photon)", "https://photon.komoot.io/api/?limit=1&q=Barnsley", d => Array.isArray(d.features) && d.features.length > 0, { alwaysChecked: true }],
  ["Landfill backup (Defra copy)", "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/HistoricLandfill/FeatureServer/0/query?geometry=-1.4797,53.5526&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=2000&units=esriSRUnit_Meter&outFields=site_name&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Flood zone backup (Environment Agency)", wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones/wms", "Flood_Zones_2_3_Rivers_and_Sea"), d => Array.isArray(d.features)],
  ["Nature backup (Natural England)", arcgis("https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/SSSI_England/FeatureServer/0/query", "&distance=5000&units=esriSRUnit_Meter"), d => Array.isArray(d.features)],
  ["GP surgeries and pharmacies (NHS Organisation Data Service)", "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?PrimaryRoleId=RO182&PostCode=S70&Status=Active&Limit=5", d => Array.isArray(d.Organisations) && d.Organisations.length > 0],
  ["Postcode lookup for many postcodes (postcodes.io)", "https://api.postcodes.io/postcodes", d => Array.isArray(d.result) && d.result[0].result,
    { method: "POST", body: JSON.stringify({ postcodes: ["S70 2TA"] }), headers: { "Content-Type": "application/json" } }],
  ["Railway station list (saved with the app)", new URL("data/rail-stations.json", BASE).href, d => Array.isArray(d.stations) && d.stations.length > 2000, { sameSite: true }],
  ["Census 2021 residents (saved with the app)", new URL("data/census2021-msoa-residents.json", BASE).href, d => Object.keys(d.residents || {}).length === 7264 && d.residents.E02001521 > 0, { sameSite: true }]
];

// The report topics each service feeds, shown on the data service status page (status.html).
// Every row of SERVICES must have an entry here; the check fails if one is missing.
const SERVICE_TOPICS = {
  "Postcodes (postcodes.io)": ["Every topic (finds the nearest postcode, council and country)", "Recent sale prices nearby"],
  "Planning data (planning.data.gov.uk)": ["Flooding from rivers and the sea", "Past use of the land", "Air quality", "Planning restrictions and heritage", "Protected nature sites"],
  "Surface water (Environment Agency)": ["Flooding from heavy rain (surface water)"],
  "Radon (British Geological Survey)": ["Radon gas"],
  "Landslides (British Geological Survey)": ["Landslides and ground movement"],
  "Coal mining (Mining Remediation Authority)": ["Mining (coal and other)"],
  "Road noise (Defra)": ["Noise: road, railway and aircraft"],
  "Rail noise (Defra)": ["Noise: road, railway and aircraft"],
  "Historic landfill (Environment Agency)": ["Past use of the land"],
  "Coastal erosion (Environment Agency)": ["Coastal erosion"],
  "Sold prices (HM Land Registry)": ["Recent sale prices nearby"],
  "Air quality model (Open-Meteo)": ["Air quality"],
  "Crime (data.police.uk)": ["Reported crime"],
  "Police force for a place (data.police.uk)": ["Reported crime"],
  "Census boundaries (ONS)": ["Reported crime (crime per 1,000 residents)"],
  "Scotland flood maps (SEPA)": ["Flooding, for homes in Scotland"],
  "Wales flood maps (Natural Resources Wales)": ["Flooding, for homes in Wales"],
  "Wales heritage, nature and air sites (DataMapWales)": ["Planning restrictions and heritage, for homes in Wales", "Protected nature sites, for homes in Wales", "Air quality, for homes in Wales"],
  "Wales noise maps (Welsh Government)": ["Noise, for homes in Wales"],
  "Wales coastal erosion (Natural Resources Wales)": ["Coastal erosion, for homes in Wales"],
  "Wales disused coal tips (Welsh Government)": ["Past use of the land, for homes in Wales"],
  "Scotland heritage sites (Historic Environment Scotland)": ["Planning restrictions and heritage, for homes in Scotland"],
  "Scotland protected nature sites (NatureScot)": ["Protected nature sites, for homes in Scotland"],
  "Scotland National Parks and Scenic Areas (Scottish Government)": ["Planning restrictions and heritage, for homes in Scotland"],
  "Scotland air pollution hotspots (Scottish Air Quality)": ["Air quality, for homes in Scotland"],
  "Scotland noise maps (SEPA)": ["Noise, for homes in Scotland"],
  "Scotland coastal erosion (Dynamic Coast)": ["Coastal erosion, for homes in Scotland"],
  "Scotland licensed waste sites (SEPA)": ["Past use of the land, for homes in Scotland"],
  "Scotland crime rank (Scottish Government, SIMD 2020)": ["Reported crime, for homes in Scotland"],
  "Northern Ireland heritage (Department for Communities)": ["Planning restrictions and heritage, for homes in Northern Ireland"],
  "Northern Ireland protected areas (DAERA)": ["Planning restrictions and heritage, for homes in Northern Ireland", "Protected nature sites, for homes in Northern Ireland"],
  "Northern Ireland noise maps (DAERA)": ["Noise, for homes in Northern Ireland"],
  "Northern Ireland coastal erosion (DfI and DAERA)": ["Coastal erosion, for homes in Northern Ireland"],
  "Address search (OpenStreetMap Nominatim)": ["Finding the property by address"],
  "Schools register (planning.data.gov.uk)": ["Schools, doctors and transport"],
  "Heritage backup (Historic England)": ["Planning restrictions and heritage, when planning.data.gov.uk is not answering"],
  "Clay shrink-swell (British Geological Survey)": ["Shrinking and swelling clay"],
  "Mining other than coal (British Geological Survey)": ["Mining (coal and other)"],
  "Conservation areas backup (Historic England)": ["Planning restrictions and heritage, when planning.data.gov.uk is not answering"],
  "Place backup (OpenStreetMap reverse lookup)": ["Every topic (finds the country), when postcodes.io is not answering"],
  "Address search backup (Photon)": ["Finding the property by address, when the main address search is not answering"],
  "Landfill backup (Defra copy)": ["Past use of the land, when the Environment Agency map server is not answering"],
  "Flood zone backup (Environment Agency)": ["Flooding from rivers and the sea, when planning.data.gov.uk is not answering"],
  "Nature backup (Natural England)": ["Planning restrictions and heritage, and Protected nature sites, when planning.data.gov.uk is not answering"],
  "GP surgeries and pharmacies (NHS Organisation Data Service)": ["Schools, doctors and transport"],
  "Postcode lookup for many postcodes (postcodes.io)": ["Schools, doctors and transport"],
  "Railway station list (saved with the app)": ["Schools, doctors and transport"],
  "Census 2021 residents (saved with the app)": ["Reported crime (crime per 1,000 residents)"]
};

async function checkService([name, url, expect, options = {}]) {
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { sameSite, ...fetchOptions } = options;
      const res = await fetch(url, { ...fetchOptions, headers: { Origin: ORIGIN, "User-Agent": UA, Accept: "application/json", ...(options.headers || {}) },
        signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const cors = res.headers.get("access-control-allow-origin");
      if (!options.sameSite && (!cors || (cors !== "*" && cors !== ORIGIN))) throw new Error("web pages are not allowed to read it (no CORS header)");
      const data = await res.json();
      if (!expect(data)) throw new Error("unexpected content");
      return record("Data services", name, true, `${Date.now() - started} ms`);
    } catch (e) {
      if (attempt === 2) {
        const refusedByEA = e.message === "HTTP 403" && url.includes(EA_MAP_SERVER);
        return record("Data services", name, refusedByEA ? "warn" : false, refusedByEA ? `HTTP 403: ${EA_REFUSAL_NOTE}` : e.message);
      }
      // A refusal (403) from the Environment Agency map server is its short block on
      // busy addresses (it lasts up to about 40 s), so wait it out before trying again.
      await new Promise(r => setTimeout(r, e.message === "HTTP 403" ? 45000 : 3000));
    }
  }
}

/* ---------------------------------------------------------------
   2. The page in a browser
--------------------------------------------------------------- */
// A minute between reports keeps the Environment Agency map server under its limit. Skipped when the report pages
// are answered from the recording (REPLAY), until a question missing from it has to ask that server live.
const PAUSE_BEFORE_REPORT_MS = Number(process.env.PAUSE_MS ?? 60000);

const DEVICES = [
  { name: "Desktop", options: { viewport: { width: 1366, height: 900 } } },
  { name: "Phone (iPhone 13)", options: { ...devices["iPhone 13"] } },
  { name: "Tablet (iPad Pro 11, landscape)", options: { ...devices["iPad Pro 11 landscape"] } }
];
const FIXED = [["S70 2TA", "Barnsley"], ["CF11 7HW", "Cardiff"], ["YO1 7HH", "York"]];

async function randomEnglishPostcode() {
  for (let i = 0; i < 8; i++) {
    try {
      const r = (await (await fetch("https://api.postcodes.io/random/postcodes", { headers: { "User-Agent": UA } })).json()).result;
      if (r && r.country === "England") return [r.postcode, r.admin_district];
    } catch (e) { /* try again */ }
  }
  return ["CM8 1AY", "Braintree"];
}

const reportDone = page => page.waitForFunction(() => typeof run !== "undefined" && run && run.done, null, { timeout: 240000 });

// Map data for Wales, Scotland and Northern Ireland, nearby places and sale prices. These test the data
// functions, not the screen, so they run once (on a desktop page) instead of on every device. They run
// during the pause before the first report: none of them uses the Environment Agency map server, and the
// page counts any request to it, so this part never adds to the requests the pause protects.
async function testCountryData() {
  const group = "Country data (desktop)";
  const context = await browser.newContext({ ...DEVICES[0].options });
  await steadyContext(context);
  const page = await context.newPage();
  let eaRequests = 0;
  await page.route("https://environment.data.gov.uk/spatialdata/**", r => { eaRequests++; return r.fulfill({ json: { features: [] } }); });
  const step = timedStep(group);
  try {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForFunction(() => typeof getScotlandSites === "function", null, { timeout: 30000 });
    await step("Backups: heritage and nature answer when planning.data.gov.uk does not", async () => {
      // Central Bath, with planning.data.gov.uk pretending to be down: the World Heritage Site, the Roman Baths and
      // listed buildings must come from Historic England, and the topic must name what it could not check.
      // The flood zone comes from the Environment Agency's Flood Map for Planning: here a stand-in answer (Flood Zone 3),
      // so this step sends nothing to its map server (the real service is checked in SERVICES).
      // Air quality has no backup and must still say "not answering", never "no issue".
      const floodMap = "**/flood-map-for-planning-flood-zones/**";
      await page.route(floodMap, r => r.fulfill({ json: { type: "FeatureCollection", features: [{ properties: { flood_zone: "FZ3", flood_source: "river" } }] } }));
      const r = await page.evaluate(async () => {
        const loc = { name: "Bath test", lat: 51.3811, lon: -2.3590, radius: 500 };
        const fail = msg => Promise.reject(new Error(msg));
        const failed = async (datasets, radius) => {
          try { await withBackup(() => fail("the data service replied with error 503"), loc, radius, datasets); }
          catch (e) { return { ok: false, error: e.message, backup: e.backup }; }
        };
        const R = { loc, planningPoint: await failed(PLANNING_AT_POINT, 0), planningNearby: await failed(PLANNING_NEARBY, loc.radius),
          floodNational: { ok: true, value: null }, air: { ok: true, value: { no2: 15, pm25: 7 } }, place: { ok: true, value: { country: "England" } } };
        const planning = checkPlanning(R), nature = checkNature(R), flood = checkFlood(R), air = checkAir(R);
        // A service that does not answer: this place's earlier answer is shown instead, with its date.
        const keep = run;
        run = { previous: { savedAt: "2026-11-03T10:00:00Z", results: [{ id: "flood", status: "medium", found: "Flood zone 2." }] } };
        let saved;
        try { saved = savedInstead({ id: "flood" }, { status: "error" }); } finally { run = keep; }
        return { saved: [saved.status, saved.fromSaved], floodSource: flood.source.name,
          planning: [planning.status, planning.found, planning.details.includes("Historic England")],
          nature: nature.status, flood: flood.status, air: air.status, airFound: air.found,
          listed: (R.planningNearby.backup?.entities || []).filter(e => e.dataset === "listed-building").length,
          missing: R.planningPoint.backup?.missing || [] };
      });
      if (r.planning[0] !== "info" || !/World Heritage Site/.test(r.planning[1]) || !/Scheduled monument/.test(r.planning[1]))
        throw new Error(`planning from the backup: ${r.planning[0]}: ${r.planning[1]}`);
      if (!r.planning[2]) throw new Error("the planning topic does not say it came from Historic England");
      // Conservation areas come from Historic England's map (the City of Bath conservation area); Green Belt has no backup.
      if (!/Conservation area/.test(r.planning[1])) throw new Error(`no conservation area from Historic England in central Bath: ${r.planning[1]}`);
      if (r.missing.includes("conservation-area") || !r.missing.includes("green-belt")) throw new Error(`backup coverage is wrong; not checked: ${r.missing.join(", ")}`);
      if (!r.listed) throw new Error("no listed buildings from Historic England in central Bath");
      if (!["low", "info"].includes(r.nature)) throw new Error(`nature from the backup rated ${r.nature}`);
      await page.unroute(floodMap);
      if (r.flood !== "high" || !/Environment Agency/.test(r.floodSource)) throw new Error(`flooding from the backup: ${r.flood} (${r.floodSource})`);
      // Air quality: the Open-Meteo estimate is the main source; without the council hotspot list it is "For information".
      if (r.air !== "info" || !/hotspots could not be checked/.test(r.airFound)) throw new Error(`with the hotspot list down, air quality is ${r.air}: ${r.airFound}`);
      if (r.saved.join() !== "medium,2026-11-03T10:00:00Z") throw new Error(`the saved answer came back as ${r.saved.join(", ")}`);
      return `${r.planning[1]} ${r.listed} listed buildings nearby`;
    });

    await step("Landfill backup: Defra's copy answers when the Environment Agency map server does not", async () => {
      // Barnsley has many old landfill sites. The Environment Agency's landfill service is made to fail here (no request
      // reaches it); the sites must come from Defra's copy on ArcGIS Online, with dates as text, and the topic must say so.
      const fail = r => r.fulfill({ status: 503, body: "" });
      await page.route("https://environment.data.gov.uk/spatialdata/historic-landfill/**", fail);
      try {
        const r = await page.evaluate(async () => {
          const loc = { lat: 53.5527, lon: -1.4797, radius: 1000 };
          const backup = await getLandfill(loc).then(() => null, e => e.backup);
          if (!backup) return { sites: 0 };
          const R = { loc, landfill: { ok: false, error: "the data service replied with error 503", backup },
            place: { ok: true, value: { country: "England", admin_district: "Barnsley" } }, planningNearby: { ok: true, value: [] }, planningPoint: { ok: true, value: [] } };
          const topic = checkLanduse(R);
          return { sites: backup.sites.length, years: backup.sites.map(x => x.firstinput).find(Boolean), nearest: backup.sites[0].distanceKm,
            status: topic.status, source: topic.source.name };
        });
        if (!r.sites) throw new Error("no landfill sites from the backup");
        if (typeof r.years !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.years)) throw new Error(`dates from the backup are not text: ${r.years}`);
        if (r.status === "error" || !/Defra's copy/.test(r.source)) throw new Error(`the topic did not use the backup: ${r.status}, "${r.source}"`);
        return `${r.sites} sites within 1 km, nearest ${r.nearest.toFixed(2)} km; ${r.status}`;
      } finally { await page.unroute("https://environment.data.gov.uk/spatialdata/historic-landfill/**", fail); }
    });

    await step("Backups for the place, the address search and recent answers", async () => {
      // postcodes.io not answering: OpenStreetMap gives the country (Leith → Scotland). Nominatim not answering: Photon
      // finds the address. A service that fails reuses its answer from the last 7 days, but never an older one.
      const r = await page.evaluate(async () => {
        const place = await placeFromOsm({ lat: 55.9755, lon: -3.17 });
        const found = await searchPhoton("May Day Green, Barnsley");
        const loc = { lat: 50.1, lon: -5.1, radius: 1000 };
        rememberAnswer(loc, "radon", { CLASS_MAX: 3 });
        const fresh = recentAnswer(loc, "radon");
        const k = "plc-recent:" + reportKey(loc), all = JSON.parse(localStorage.getItem(k));
        all.radon.at = new Date(Date.now() - 8 * 864e5).toISOString(); localStorage.setItem(k, JSON.stringify(all));
        const old = recentAnswer(loc, "radon");
        forgetAnswers(reportKey(loc));
        return { country: place && place.country, backup: place && place.fromBackup, photon: found.length, near: found[0] && Math.abs(found[0].lat - 53.55) < 0.1,
          fresh: !!fresh && fresh.value.CLASS_MAX === 3, old: old === null, gone: localStorage.getItem(k) === null };
      });
      if (r.country !== "Scotland" || r.backup !== "OpenStreetMap") throw new Error(`OpenStreetMap place for Leith: ${r.country} (${r.backup})`);
      if (!r.photon || !r.near) throw new Error(`Photon found ${r.photon} result(s), first near Barnsley: ${r.near}`);
      if (!r.fresh) throw new Error("a recent answer was not kept");
      if (!r.old) throw new Error("an answer older than 7 days was still used");
      if (!r.gone) throw new Error("recent answers were not forgotten with the saved property");
      return `Leith → Scotland (OpenStreetMap); Photon: ${r.photon} result(s); recent answers kept 7 days`;
    });

    await step("Clay and other mining from the British Geological Survey", async () => {
      // Islington (London Clay): clay "significant" → Worth checking. Camborne (Cornwall): old tin and copper mines →
      // the mining topic is Worth checking and asks for a mining search. Cotswolds: no known mining, so no such note.
      const r = await page.evaluate(async () => {
        const at = async (lat, lon) => { const loc = { lat, lon, radius: 1000 };
          const [ss, om, coal] = await Promise.all([getShrinkSwell(loc), getOtherMining(loc), getCoal(loc)]);
          return { clay: checkClay({ loc, shrinkSwell: { ok: true, value: ss } }),
            mining: checkCoal({ loc, coal: { ok: true, value: coal }, otherMining: { ok: true, value: om } }) }; };
        const [islington, camborne, cotswolds] = await Promise.all([at(51.5465, -0.1058), at(50.2132, -5.2977), at(52.0, -1.5)]);
        // With the other-mining overview not answering, a place outside the coalfield must not say "No issue found".
        const down = checkCoal({ loc: {}, coal: { ok: true, value: {} }, otherMining: { ok: false, error: "test" } });
        return { islington: islington.clay.status, camborne: [camborne.mining.status, camborne.mining.found, camborne.mining.conveyancer.join(" ")],
          cotswolds: cotswolds.mining.found + cotswolds.mining.conveyancer.join(" "), down: down.status };
      });
      if (r.islington !== "medium") throw new Error(`Islington clay rated ${r.islington}, not Worth checking`);
      if (r.camborne[0] !== "medium" || !/tin, copper/.test(r.camborne[1]) || !/mining search/.test(r.camborne[2]))
        throw new Error(`Camborne mining: ${r.camborne.join(" | ")}`);
      if (/other than coal/.test(r.cotswolds)) throw new Error("the other-mining note shows in the Cotswolds");
      if (r.down !== "manual") throw new Error(`with other mining not answering, the topic is ${r.down}, not Check yourself`);
      return "Islington clay: Worth checking; Camborne: other mining Worth checking";
    });

    await step("Missing data is never No issue found: noise, clay and mining when a service fails", async () => {
      // Built from made-up answers (nothing is sent): a failed road noise service, a blank clay rating and a failed
      // coal service must never read "No issue found", and the coal outage must not hide other mining.
      const r = await page.evaluate(() => {
        const loc = { lat: 53.5542, lon: -1.4827, radius: 1000, name: "test" };
        const place = { ok: true, value: { country: "England", admin_district: "Barnsley" } };
        const down = { ok: false, error: "HTTP 503" };
        const noise = checkNoise({ loc, place, noise: down, railNoise: { ok: true, value: {} } });
        const clay = checkClay({ loc, place, shrinkSwell: { ok: true, value: { level: NaN, localised: false } } });
        const sig = checkCoal({ loc, place, coal: down, otherMining: { ok: true, value: { level: "Significant" } } });
        const none = checkCoal({ loc, place, coal: down, otherMining: { ok: true, value: { level: "NA" } } });
        // Near Heathrow the airport already rates noise "Worth checking": road noise that failed must still be named.
        const heathrow = checkNoise({ loc: { ...loc, lat: 51.47, lon: -0.45 }, place, noise: down, railNoise: { ok: true, value: {} } });
        // A railway service that answered only in part (no night figure) is not "quiet".
        const partRail = checkNoise({ loc, place, noise: { ok: true, value: {} }, railNoise: { ok: true, value: { lden: null, lnight: null, unavailable: ["lnight"] } } });
        return { noise: [noise.status, /Road noise could not be checked/.test(noise.found)], clay: clay.status,
          sig: [sig.status, /Coal mining could not be checked/.test(sig.found) && /known or considered likely/.test(sig.found), sig.gap, sig.failedService], none: none.status,
          heathrow: [heathrow.status, heathrow.gap, /Road noise could not be checked/.test(heathrow.found)], partRail: [partRail.status, /Railway noise could not be checked/.test(partRail.found)] };
      });
      const ok = r.noise[0] === "manual" && r.noise[1] && r.clay === "manual" && r.sig[0] === "medium" && r.sig[1] && r.sig[2] === "down" &&
        r.sig[3] === "coal" && r.none === "error" && r.heathrow[0] === "medium" && r.heathrow[1] === "down" && r.heathrow[2] &&
        r.partRail[0] === "manual" && r.partRail[1];
      return ok ? "noise (also near an airport, and with a partial railway answer), clay and mining name what was not checked" : (() => { throw new Error(JSON.stringify(r)); })();
    });

    await step("Wales: coal tips, coast, noise, heritage and nature from Welsh data", async () => {
      // Treorchy (Rhondda): disused coal tips nearby. Borth: an eroding coast. Cardiff centre: a conservation
      // area, road noise and an air pollution hotspot nearby. Each must be answered from Welsh data, not "Check yourself".
      const r = await page.evaluate(async () => {
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          const fns = { coalTips: getCoalTips, coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, walesSites: getWalesSites };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: false, error: "not asked" }; out.planningPoint = { ok: false, error: "England only" };
          return out;
        };
        const tre = await R({ lat: 51.653995, lon: -3.520821, radius: 1000 }, ["coalTips"]);
        const borth = await R({ lat: 52.486107, lon: -4.05112, radius: 1000 }, ["coastal"]);
        const cdf = await R({ lat: 51.485167, lon: -3.178668, radius: 1000 }, ["noise", "railNoise", "walesSites"]);
        return {
          tips: checkLanduse(tre), coast: checkCoastal(borth), noise: checkNoise(cdf),
          planning: checkPlanning(cdf), nature: checkNature(cdf), air: checkAir(cdf), country: cdf.place.value.country,
          // Missing hotspot data must never read as "not in a hotspot".
          airNoHotspotData: checkAir({ ...cdf, walesSites: { ok: false, error: "test" }, air: { ok: true, value: { no2: 10, pm25: 5 } } }).status
        };
      });
      if (r.country !== "Wales") throw new Error(`postcodes.io says Cardiff is in ${r.country}`);
      // The Open-Meteo estimate is the main source (owner, 7 November 2026): without hotspot data it is "For information", never "No issue found".
      if (r.airNoHotspotData !== "info") throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}", not For information`);
      const bad = Object.entries(r).filter(([k, c]) => !["country", "airNoHotspotData"].includes(k) && ["manual", "error"].includes(c.status));
      if (bad.length) throw new Error(bad.map(([k, c]) => `${k}: ${c.found}`).join(" | "));
      if (!["medium", "info"].includes(r.tips.status)) throw new Error(`no coal tips found near Treorchy: ${r.tips.found}`);
      if (!/Conservation area/.test(r.planning.found)) throw new Error(`no conservation area in central Cardiff: ${r.planning.found}`);
      if (!/Road: (moderate|loud)/.test(r.noise.found)) throw new Error(`no road noise in central Cardiff: ${r.noise.found}`);
      if (r.coast.found.startsWith("Not near the coast")) throw new Error(`Borth not near the coast: ${r.coast.found}`);
      if (!/hotspot/.test(r.air.found) || !/within/.test(r.air.found)) throw new Error(`no air pollution hotspot near central Cardiff: ${r.air.found}`);
      return `coal tips ${r.tips.status}; Borth ${r.coast.status}; Cardiff: ${r.planning.found.slice(0, 50)}…`;
    });

    await step("Scotland: heritage, nature, air, noise, coast, waste sites and crime from Scottish data", async () => {
      // Edinburgh Old Town: a conservation area, World Heritage Site, listed building, air pollution hotspot, road noise
      // and a crime rank. Portobello: an eroding soft coast. Insh Marshes (Cairngorms): a National Park and an SSSI.
      // Oban: rocky coast and no waste site, so land use must say "Check yourself".
      const r = await page.evaluate(async () => {
        const fns = { coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, scotlandSites: getScotlandSites, wasteSites: getWasteSites, simdCrime: getSimdCrime };
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: false, error: "not asked" }; out.planningPoint = { ok: false, error: "England only" };
          out.crime = { ok: false, error: "England and Wales only" };
          return out;
        };
        const edi = await R({ lat: 55.9497, lon: -3.1907, radius: 1000 }, ["noise", "railNoise", "scotlandSites", "wasteSites", "simdCrime"]);
        const por = await R({ lat: 55.955, lon: -3.105, radius: 1000 }, ["coastal"]);
        const insh = await R({ lat: 57.08, lon: -3.95, radius: 1000 }, ["scotlandSites"]);
        const oban = await R({ lat: 56.415, lon: -5.472, radius: 1000 }, ["wasteSites"]);
        return {
          planning: checkPlanning(edi), nature: checkNature(edi), air: checkAir(edi), noise: checkNoise(edi), crime: checkCrime(edi),
          waste: checkLanduse(edi), coast: checkCoastal(por), park: checkPlanning(insh), sssi: checkNature(insh),
          country: edi.place.value.country, obanLand: checkLanduse(oban).status,
          // Missing hotspot data must never read as "not in a hotspot".
          airNoHotspotData: checkAir({ ...edi, scotlandSites: { ok: false, error: "test" }, air: { ok: true, value: { no2: 10, pm25: 5 } } }).status
        };
      });
      if (r.country !== "Scotland") throw new Error(`postcodes.io says Edinburgh is in ${r.country}`);
      // The Open-Meteo estimate is the main source (owner, 7 November 2026): without hotspot data it is "For information", never "No issue found".
      if (r.airNoHotspotData !== "info") throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}", not For information`);
      if (r.obanLand !== "manual") throw new Error(`Oban (no waste sites; old landfill not published) rated "${r.obanLand}", expected Check yourself`);
      const bad = Object.entries(r).filter(([k, c]) => !["country", "airNoHotspotData", "obanLand"].includes(k) && ["manual", "error"].includes(c.status));
      if (bad.length) throw new Error(bad.map(([k, c]) => `${k}: ${c.found}`).join(" | "));
      if (!/Conservation area/.test(r.planning.found) || !/World Heritage Site/.test(r.planning.found)) throw new Error(`Edinburgh Old Town planning: ${r.planning.found}`);
      if (!/National Park/.test(r.park.found)) throw new Error(`no National Park at Insh Marshes: ${r.park.found}`);
      if (!/Site of Special Scientific Interest/.test(r.sssi.found)) throw new Error(`no SSSI at Insh Marshes: ${r.sssi.found}`);
      if (!/Inside an air pollution hotspot/.test(r.air.found)) throw new Error(`Edinburgh centre not in its air pollution hotspot: ${r.air.found}`);
      if (!/Road: (moderate|loud)/.test(r.noise.found)) throw new Error(`no road noise in central Edinburgh: ${r.noise.found}`);
      if (!/ranked [\d,]+ of 6,976/.test(r.crime.found)) throw new Error(`no crime rank: ${r.crime.found}`);
      if (!/licensed/.test(r.waste.found)) throw new Error(`no licensed waste site near central Edinburgh: ${r.waste.found}`);
      if (!/expected to be lost by 2100/.test(r.coast.found)) throw new Error(`Portobello coast: ${r.coast.found}`);
      return `Edinburgh: ${r.planning.found.slice(0, 60)}…; Portobello ${r.coast.status}; crime ${r.crime.found.match(/ranked [\d,]+/)[0]}`;
    });

    await step("Northern Ireland: heritage, nature, noise and coast from NI data; Check yourself where nothing is published", async () => {
      // Belfast City Hall: listed buildings nearby and road noise; planning must say "Check yourself" because
      // conservation areas are not published, and air because hotspots are not mapped. Westlink: loud road noise.
      // Newcastle (Co Down): the Mourne AONB. Strangford Lough: protected nature sites. Belfast Lough shore: High erosion risk.
      const r = await page.evaluate(async () => {
        const fns = { coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, niSites: getNISites };
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: true, value: { no2: 15, pm25: 6 } };
          return out;
        };
        const bel = await R({ lat: 54.5964, lon: -5.9301, radius: 1000 }, ["noise", "railNoise", "niSites"]);
        const west = await R({ lat: 54.592, lon: -5.946, radius: 1000 }, ["noise", "railNoise"]);
        const newc = await R({ lat: 54.212, lon: -5.893, radius: 1000 }, ["niSites"]);
        const str = await R({ lat: 54.47, lon: -5.63, radius: 1000 }, ["niSites"]);
        const shore = await R({ lat: 54.66, lon: -5.90, radius: 1000 }, ["coastal"]);
        return { country: bel.place.value.country, listed: bel.niSites.value.listedNear,
          planning: checkPlanning(bel), air: checkAir(bel), noise: checkNoise(west), park: checkPlanning(newc),
          nature: checkNature(str), coast: checkCoastal(shore) };
      });
      if (r.country !== "Northern Ireland") throw new Error(`postcodes.io says Belfast is in ${r.country}`);
      if (r.planning.status !== "manual") throw new Error(`Belfast planning with no conservation area data rated "${r.planning.status}", expected Check yourself`);
      if (!(r.listed > 0)) throw new Error("no listed buildings near Belfast City Hall");
      if (r.air.status !== "info") throw new Error(`NI air quality (estimate only, no hotspot map) rated "${r.air.status}", expected For information`);
      if (!/Road: loud/.test(r.noise.found)) throw new Error(`Westlink road noise: ${r.noise.found}`);
      if (!/Area of Outstanding Natural Beauty/.test(r.park.found)) throw new Error(`no Mourne AONB at Newcastle: ${r.park.found}`);
      if (r.nature.status !== "info") throw new Error(`no protected sites at Strangford Lough: ${r.nature.found}`);
      if (!/erosion risk/.test(r.coast.found) || r.coast.status === "low") throw new Error(`Belfast Lough shore: ${r.coast.found}`);
      return `${r.listed} listed buildings near City Hall; Westlink loud; coast ${r.coast.status}`;
    });

    await step("Nearby places: each register only where it covers; Check yourself in Northern Ireland", async () => {
      // GP surgeries come from an England and Wales register, schools and stops from England only, stations from
      // Great Britain. Where a register does not reach, the row must say "Not covered", never "None found nearby".
      const r = await page.evaluate(async () => {
        const rate = async (lat, lon) => {
          const loc = { lat, lon, radius: 1000 };
          const c = checkAmenities({ loc, place: { ok: true, value: await getPlace(loc) }, amenities: { ok: true, value: await getAmenities(loc) } });
          return { status: c.status, found: c.found, details: c.details || "" };
        };
        return { bel: await rate(54.5964, -5.9301), edi: await rate(55.9497, -3.1907), cdf: await rate(51.4816, -3.1791) };
      });
      if (r.bel.status !== "manual") throw new Error(`Belfast (no register covers it) rated "${r.bel.status}": ${r.bel.found}`);
      if (!/GP surgery<\/td><td colspan="3">Not covered in Scotland/.test(r.edi.details)) throw new Error("Edinburgh GP row does not say Not covered");
      if (!/station/.test(r.edi.found)) throw new Error(`no station near Edinburgh Waverley: ${r.edi.found}`);
      if (!/GP|pharmacy/.test(r.cdf.found)) throw new Error(`no GP or pharmacy in central Cardiff: ${r.cdf.found}`);
      return `Belfast ${r.bel.status}; Edinburgh: ${r.edi.found.slice(0, 40)}…; Cardiff: ${r.cdf.found.slice(0, 40)}…`;
    });

    await step("Sold prices: sales in a town, Check yourself where there are none", async () => {
      // Barnsley town centre has home sales every year. Open moorland on Dartmoor has no postcodes within
      // 500 m, so no sales: that must say "Check yourself", never "No issue found".
      const r = await page.evaluate(async () => {
        const rate = async loc => checkSoldPrices({ loc, soldPrices: { ok: true, value: await getSoldPrices(loc) } });
        const town = await rate({ name: "Barnsley test", lat: 53.5526, lon: -1.4797, radius: 1000 });
        const moor = await rate({ name: "Dartmoor test", lat: 50.6, lon: -3.96, radius: 1000 });
        return { town: town.status, townFound: town.found, moor: moor.status };
      });
      if (r.town !== "info") throw new Error(`Barnsley rated "${r.town}": ${r.townFound}`);
      if (r.moor !== "manual") throw new Error(`Dartmoor (no sales) rated "${r.moor}", expected Check yourself`);
      return r.townFound.replace(/<[^>]+>/g, "").slice(0, 90) + "…";
    });

    record(group, "No requests to the Environment Agency map server", eaRequests === 0,
      eaRequests ? `${eaRequests} request(s): a Wales, Scotland or NI address was treated as England` : "none");
  } finally {
    await context.close();
  }
}

async function testDevice(device, [postcode, place]) {
  const group = `${device.name} – ${postcode}, ${place}`;
  const context = await browser.newContext({ ...device.options, acceptDownloads: true });
  await steadyContext(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  // Record data requests that fail, with the reply, to explain any topic that could not load.
  const failedRequests = [];
  const shortUrl = u => { const x = new URL(u); return x.host + x.pathname.replace(/\/(wms|query|items)$/, "/$1"); };
  page.on("response", res => {
    if (res.status() >= 400 && !/tile|png|jpg/.test(res.url()))
      failedRequests.push(`${shortUrl(res.url())} → HTTP ${res.status()}${res.headers()["retry-after"] ? " (retry-after " + res.headers()["retry-after"] + ")" : ""}`);
  });
  page.on("requestfailed", req => {
    if (!/tile|png|jpg/.test(req.url())) failedRequests.push(`${shortUrl(req.url())} → ${req.failure() ? req.failure().errorText : "failed"}`);
  });
  const step = timedStep(group);
  // Steps that do not depend on the screen size run once, on the desktop; layout steps run on every device.
  const desktopStep = device.name === "Desktop" ? step : async () => {};
  // Wait until the condition holds, at most a few seconds. Answers whether it did.
  const until = (fn, arg, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  // Wait until a smooth scroll has finished: the page stays still for 15 frames (a scroll that starts a little
  // late is still caught), at most 3 seconds. Never throws, so a page that is navigating cannot stop the run.
  const scrolled = () => page.evaluate(() => new Promise(done => {
    let y = scrollY, still = 0;
    const end = Date.now() + 3000;
    const frame = () => { still = scrollY === y ? still + 1 : 0; y = scrollY; still >= 15 || Date.now() > end ? done() : requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  })).catch(() => {});
  const file = name => `${OUT}/${device.name.replace(/\W+/g, "-")}-${name}.png`;

  let guideAtStart = false;
  await step("Page opens with the search ready", async () => {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForSelector("#map.leaflet-container");
    guideAtStart = await page.$eval("#guide", g => !g.classList.contains("hidden") && g.querySelectorAll("li").length === 3);
    // The search box shows above the map, outside it (1.36.0), and the map's own search button stays hidden.
    const r = await page.evaluate(() => {
      const box = document.getElementById("searchBox"), m = document.getElementById("map");
      const b = box.getBoundingClientRect(), mb = m.getBoundingClientRect();
      return { visible: b.height > 0 && getComputedStyle(box).visibility !== "hidden", above: b.bottom <= mb.top + 1,
        outside: !m.contains(box), mapBtn: getComputedStyle(document.querySelector(".search-ctl")).display };
    });
    return r.visible && r.above && r.outside && r.mapBtn === "none" ? "search box above the map" : false;
  });

  await step("Search finds the postcode", async () => {
    await page.fill("#q", postcode);
    await page.waitForSelector("#suggestions:not(.hidden) li", { timeout: 15000 });
    await page.click("#suggestions li");
    await page.waitForSelector("#confirm:not(.hidden)");
    const text = await page.$eval("#confirmText", x => x.textContent);
    return text.includes(postcode) ? text : false;
  });

  await step("Full-screen map covers the screen and closes", async () => {
    await page.$eval("#map", x => x.scrollIntoView({ block: "center" }));
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await until(() => mapIsFull);
    const r = await page.evaluate(() => { const b = document.getElementById("map").getBoundingClientRect(); return [b.left, b.top, b.width, b.height, innerWidth, innerHeight].map(Math.round); });
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("pressing the full-screen button moved the pin");
    const searchInMap = await page.evaluate(() => document.getElementById("map").contains(document.getElementById("searchBox"))
      && getComputedStyle(document.querySelector(".search-ctl")).display !== "none");
    if (!searchInMap) throw new Error("the full-screen map has no search button");
    await page.screenshot({ path: file("fullscreen") });
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await until(() => !mapIsFull);
    const closed = !(await page.evaluate(() => mapIsFull)) && await page.evaluate(() => !document.getElementById("map").contains(document.getElementById("searchBox")));
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("closing full screen moved the pin");
    return r[0] === 0 && r[1] === 0 && Math.abs(r[2] - r[4]) <= 1 && Math.abs(r[3] - r[5]) <= 1 && closed ? `map ${r[2]}×${r[3]}` : false;
  });

  await desktopStep("Offline: says so and waits to run the check", async () => {
    await page.context().setOffline(true);
    try {
      await page.click("#runBtn");
      await page.waitForSelector("#offlineBar:not(.hidden)", { timeout: 5000 });
      const text = await page.$eval("#offlineBar", x => x.textContent.replace(/\s+/g, " ").trim());
      const started = await page.evaluate(() => !!run);
      await page.click("#cancelQueued");
      if (started) throw new Error("a report started with no signal");
      if (!/will start by itself/.test(text)) throw new Error(`unexpected message: ${text}`);
    } finally { await page.context().setOffline(false); }
    const gone = await until(() => document.getElementById("offlineBar").classList.contains("hidden"));
    const started = await page.evaluate(() => !!run);
    if (started) throw new Error("the cancelled check still started");
    return gone ? "message shown, check waited and was cancelled" : false;
  });

  let topics = [];
  await step("Report runs with every topic", async () => {
    const started = Date.now();
    await page.click("#runBtn");
    await reportDone(page);
    const readTopics = () => page.evaluate(() => orderedResults().map(c => ({ id: c.id, status: c.status, found: c.found })));
    topics = await readTopics();
    const total = await page.evaluate(() => CHECKS.length);
    let failed = topics.filter(t => t.status === "error");
    // A government service that is slow for a moment shows "Try again" on that topic.
    // Press it once, as a person would (this also tests the button). A topic that
    // fails a second time still fails the test.
    const retried = failed.map(t => t.id);
    for (const id of retried) {
      await page.waitForTimeout(20000);
      // Retrying one topic reloads the data it shares with others, so another topic's button may already be gone
      // (reloaded or answered). Either way the topic is read again below and must not have failed.
      const btn = page.locator(`#check-${id} [data-retry="${id}"]`);
      if (!(await btn.count())) { await reportDone(page); continue; }
      await btn.click();
      await page.waitForTimeout(500);
      await reportDone(page);
    }
    if (retried.length) { topics = await readTopics(); failed = topics.filter(t => t.status === "error"); }
    const secs = Math.round((Date.now() - started) / 1000);
    if (topics.length !== total || failed.length) {
      const why = [...new Set(failedRequests)].slice(0, 6).join("; ");
      const refusedByEA = topics.length === total && failed.every(t => EA_TOPICS.includes(t.id)) &&
        failedRequests.some(r => r.includes(EA_MAP_SERVER) && r.includes("HTTP 403"));
      if (refusedByEA) return { warn: `${failed.map(t => t.id).join(", ")} could not load: ${EA_REFUSAL_NOTE}. Other ${total - failed.length} topics ok` };
      throw new Error(`${failed.length} topic(s) failed` + (retried.length ? " even after Try again" : "") + ": " +
        failed.map(t => `${t.id} (${t.found})`).join("; ") + (why ? ` | failed requests: ${why}` : ""));
    }
    const auto = await page.evaluate(() => run.autoRetried || []);
    return `${total} topics in ${secs} s` + (auto.length ? ` (retried by itself: ${auto.join(", ")})` : "")
      + (retried.length ? ` (needed Try again: ${retried.join(", ")})` : "");
  });
  await desktopStep("3-step guide on the first visit, hidden after the first report", async () => {
    const hiddenNow = await page.$eval("#guide", g => g.classList.contains("hidden"));
    return guideAtStart && hiddenNow ? "shown, then hidden" : false;
  });
  await page.$eval("#reportTop", x => x.scrollIntoView()).catch(() => {});
  await scrolled();
  await until(() => document.querySelector("#reportMap .leaflet-tile-loaded"));
  await page.screenshot({ path: file("report") });

  await step("Topic icons and section bar", async () => {
    const icons = await page.$$eval(".topic-strip li", l => l.length);
    await page.click('#reportNav a[data-nav="group-living"]');
    await scrolled();
    const active = await page.$eval("#reportNav a.active", x => x.textContent).catch(() => null);
    return icons >= 13 && active === "Living" ? `${icons} icons, section bar ok` : false;
  });

  await step("Finding your way: topic grid, folded no-issue topics, Open problems and Details", async () => {
    const r0 = await page.evaluate(() => {
      const results = orderedResults();
      const grid = document.querySelectorAll(".topic-strip [data-why]").length;
      const low = results.filter(c => c.status === "low").map(c => c.id).sort();
      const folded = [...document.querySelectorAll(".clear-fold .fold-body .slot")].map(el => el.id.slice(5)).sort();
      const symbols = [...document.querySelectorAll("#report .chip:is(.high,.medium,.low,.info,.manual,.error)")].filter(c => !c.querySelector(".chip-symbol")).length;
      return { total: results.length, grid, low, folded, symbols, countBoxes: document.querySelectorAll("a.count").length };
    });
    // The topic grid shows every topic once; the count boxes are gone; every chip has its symbol.
    if (r0.grid !== r0.total) throw new Error(`the topic grid shows ${r0.grid} topics, expected ${r0.total}`);
    if (r0.countBoxes) throw new Error("the old count boxes are still shown");
    if (r0.symbols) throw new Error(`${r0.symbols} rating chip(s) without a symbol`);
    // Every "No issue found" topic, and only those, sits in its section's folded row.
    if (r0.low.join() !== r0.folded.join()) throw new Error(`folded [${r0.folded}] but no-issue topics are [${r0.low}]`);
    // A link to a topic (here from the "why" box under the grid) opens it, opens its fold if it is folded,
    // focuses it and leaves it below the section bar.
    const first = page.locator(".topic-strip .topic").first();
    await first.click();
    const link = page.locator("#whyBox a[data-open]");
    const id = await link.getAttribute("data-open");
    await page.evaluate(i => { const d = document.getElementById(i); d.open = false; const f = d.closest(".clear-fold"); if (f) f.open = false; }, id);
    await link.click();
    await scrolled();
    const r = await page.evaluate(i => {
      const d = document.getElementById(i), bar = document.getElementById("reportNav").getBoundingClientRect().bottom;
      const f = d.closest(".clear-fold");
      return { open: d.open, foldOpen: !f || f.open, below: d.getBoundingClientRect().top >= bar - 1, focus: d.contains(document.activeElement),
        label: getComputedStyle(d.querySelector(".more-text"), "::before").content };
    }, id);
    if (!r.open || !r.focus || !r.foldOpen) throw new Error(`the link did not open and focus ${id}`);
    if (!r.below) throw new Error(`${id} is hidden under the section bar`);
    if (r.label !== '"Hide"') throw new Error(`an open topic says ${r.label}, not "Hide"`);
    // "Close all" closes every topic and fold; "Open problems" then opens only Look into this and Worth checking.
    const state = () => page.evaluate(() => {
      const open = [...document.querySelectorAll("#report details.check, #report details.clear-fold")].filter(d => d.open);
      return { text: document.getElementById("toggleAll").textContent, disabled: document.getElementById("toggleAll").disabled,
        open: open.map(d => d.id || "fold").sort().join(),
        problems: [...document.querySelectorAll("#report details.check.high, #report details.check.medium")].map(d => d.id).sort().join() };
    });
    if ((await state()).text !== "Close all") throw new Error("with a topic open, the button does not say Close all");
    await page.click("#toggleAll");
    const s1 = await state();
    if (s1.open || s1.text !== "Open problems") throw new Error(`after Close all: "${s1.text}", still open: ${s1.open}`);
    if (s1.problems) {
      await page.click("#toggleAll");
      const s2 = await state();
      if (s2.open !== s1.problems || s2.text !== "Close all") throw new Error(`Open problems opened [${s2.open}], expected [${s1.problems}]`);
    } else if (!s1.disabled) throw new Error("Open problems is not disabled when there are no problems");
    // The button stays on screen, even on a phone.
    const onScreen = await page.$eval("#toggleAll", b => { const x = b.getBoundingClientRect(); return x.left >= 0 && x.right <= innerWidth; });
    if (!onScreen) throw new Error("the Open problems button is off the screen");
    return `${r0.folded.length} no-issue topics folded; ${id.replace("check-", "")} opened; ${s1.problems ? s1.problems.split(",").length : 0} problems opened`;
  });

  await step("Shorter report: map always shown at 4:3, More in each topic, long lists show 3 first", async () => {
    // The map inside the report is always shown and drawn (owner, 7 November 2026: a hidden map could print blank),
    // 4:3 and centred, with its map pictures loaded.
    const m = await page.evaluate(() => { const el = document.getElementById("reportMap"), r = el.getBoundingClientRect();
      return { hidden: el.hidden || r.height === 0, drawn: el.classList.contains("leaflet-container"), ratio: r.width / r.height,
        tiles: el.querySelectorAll(".leaflet-tile-loaded").length, button: !!document.getElementById("showReportMap") }; });
    if (m.hidden || !m.drawn || m.button) throw new Error(`report map: hidden ${m.hidden}, drawn ${m.drawn}, Show map button ${m.button}`);
    if (Math.abs(m.ratio - 4 / 3) > 0.03) throw new Error(`report map is ${m.ratio.toFixed(2)}:1, expected 4:3`);
    if (!m.tiles) throw new Error("no map pictures loaded in the report map");
    // Inside a topic, "What we found" and "What this means" stay folded until "More" (sources and dates are in the table at the end).
    const more = page.locator("details.check[open] .more-btn").first();
    if (await more.count()) {
      const box = await more.getAttribute("aria-controls");
      const hiddenBefore = await page.$eval("#" + box, x => x.hidden);
      await more.click();
      const shown = await page.$eval("#" + box, x => !x.hidden && /What we found|What this means/.test(x.textContent));
      await more.click();
      if (!hiddenBefore || !shown) throw new Error(`"More" in ${box} did not fold and unfold what was found and what it means`);
    }
    // A list of more than 4 sites or sales shows the first 3, and "Show all N" shows the rest.
    const lists = await page.evaluate(() => [...document.querySelectorAll("#report .site-list")].map(l => {
      const rows = [...l.querySelectorAll(":scope > li, tbody > tr")];
      return { id: l.id, total: rows.length, shown: rows.filter(r => !r.hidden).length };
    }));
    const wrong = lists.filter(l => l.shown !== (l.total > 4 ? 3 : l.total));
    if (wrong.length) throw new Error(wrong.map(l => `a list shows ${l.shown} of ${l.total}`).join("; "));
    const long = lists.find(l => l.total > 4);
    if (long) {
      const all = await page.evaluate(id => {
        const btn = document.querySelector(`.show-all[aria-controls="${id}"]`);
        const d = btn.closest("details"); if (d) d.open = true;
        const f = btn.closest(".clear-fold"); if (f) f.open = true;
        const label = btn.textContent;
        btn.click();
        const shown = [...document.getElementById(id).querySelectorAll(":scope > li, tbody > tr")].filter(r => !r.hidden).length;
        btn.click();
        return { label, shown };
      }, long.id);
      if (all.label !== `Show all ${long.total}` || all.shown !== long.total) throw new Error(`"${all.label}" showed ${all.shown} of ${long.total}`);
    }
    return `map ok; ${lists.length} list(s), ${lists.filter(l => l.total > 4).length} shortened`;
  });

  await step("Phone tab bar: Summary, Problems, All topics, Next steps", async () => {
    const phone = await page.evaluate(() => innerWidth <= 600);
    const shown = await page.$eval("#tabBar", x => getComputedStyle(x).display !== "none");
    if (!phone) { if (shown) throw new Error("the phone tab bar shows on a wider screen"); return "not shown (wider screen)"; }
    if (!shown) throw new Error("the tab bar is not shown on a phone");
    const labels = await page.$$eval("#tabBar a, #tabBar button", x => x.map(b => b.textContent.replace(/\s+/g, " ").trim()));
    if (labels.length !== 4 || !/Problems \(\d+\)/.test(labels[1])) throw new Error(`the tab bar says: ${labels.join(" | ")}`);
    // A jump lands below the top bars and above the tab bar; Back to top sits above the tab bar.
    const landed = async () => page.evaluate(() => {
      const bar = document.getElementById("tabBar").getBoundingClientRect().top, top = document.getElementById("reportNav").getBoundingClientRect().bottom;
      const t = document.getElementById("nextSteps").getBoundingClientRect(), up = document.getElementById("toTop").getBoundingClientRect();
      return { below: t.top >= top - 1, above: t.top < bar, toTop: up.height === 0 || up.bottom <= bar + 1 };
    });
    await page.click('#tabBar a[data-tab="nextSteps"]');
    await scrolled();
    const r = await landed();
    if (!r.below || !r.above) throw new Error("Next steps did not land between the top bars and the tab bar");
    if (!r.toTop) throw new Error("the Back to top button covers the tab bar");
    // "Problems" opens the topics to look into and goes to the first; with none, it is greyed out.
    const n = await page.evaluate(() => problemTopics().length);
    if (!n) { if (!(await page.isDisabled("#tabProblems"))) throw new Error("Problems is not greyed out with no problems"); return "no problems here"; }
    await page.click("#tabProblems");
    await scrolled();
    const p = await page.evaluate(() => { const d = document.activeElement.closest("details.check");
      return { id: d && d.id, open: d && d.open, problem: d && (d.classList.contains("high") || d.classList.contains("medium")),
        visible: d && d.getBoundingClientRect().top >= document.getElementById("reportNav").getBoundingClientRect().bottom - 1 }; });
    if (!p.problem || !p.open || !p.visible) throw new Error(`Problems went to ${p.id || "nothing"} (open ${p.open}, in view ${p.visible})`);
    return `${labels.join(" · ")}; Problems went to ${p.id.replace("check-", "")}`;
  });

  await desktopStep("Tapping a topic shows why", async () => {
    await page.click('.topic-strip [data-why="radon"]');
    const text = await page.$eval("#whyBox", x => x.hidden ? "" : x.textContent.replace(/\s+/g, " ").trim());
    const expanded = await page.$eval('.topic-strip [data-why="radon"]', x => x.getAttribute("aria-expanded"));
    await page.click('.topic-strip [data-why="radon"]');   // tap again to close
    const closed = await page.$eval("#whyBox", x => x.hidden);
    return text.startsWith("Radon") && text.length > 25 && expanded === "true" && closed ? text.slice(0, 70) + "…" : false;
  });

  await step("Each topic says how current its data is (in the sources table at the end)", async () => {
    const r = await page.evaluate(() => {
      const rows = new Map([...document.querySelectorAll("#sources tbody tr")].map(tr => [tr.cells[0].textContent.trim(), tr.cells[2].textContent.trim()]));
      const missing = orderedResults().filter(c => !["manual", "error"].includes(c.status))
        .filter(c => !c.dataDate || c.dataDate.length < 12 || rows.get(c.title) !== c.dataDate).map(c => c.id);
      const inCards = document.querySelectorAll("details.check .data-date, details.check .source").length;
      return { missing, inCards, crime: rows.get((orderedResults().find(c => c.id === "crime") || {}).title) };
    });
    if (r.missing.length) throw new Error("no data date in the sources table for: " + r.missing.join(", "));
    if (r.inCards) throw new Error(`${r.inCards} date or source line(s) still inside topics`);
    return r.crime || "ok";
  });

  await desktopStep("Crime where the police publish no data", async () => {
    // Central Manchester: Greater Manchester Police has published no data since March 2025. Whatever the
    // police data says on the day, the report must not show a near-empty count as a real, low crime level.
    const r = await page.evaluate(async () => {
      const loc = { name: "Manchester test", lat: 53.4835, lon: -2.2312, radius: 1000 };
      const [crime, area] = await Promise.all([getCrime(loc), getCrimeArea(loc)]);
      const c = checkCrime({ loc, crime: { ok: true, value: crime }, crimeArea: { ok: true, value: area } });
      return { status: c.status, found: c.found, total: crime.total };
    });
    if (r.total <= 5 && r.status !== "manual") throw new Error(`only ${r.total} crimes, but rated "${r.status}": ${r.found}`);
    return `${r.total} crimes within a mile → ${r.status === "manual" ? "Check yourself" : "shown"}: ${r.found.slice(0, 70)}…`;
  });

  await desktopStep("Coastal erosion on an eroding coast", async () => {
    // Happisburgh, Norfolk: the village edge is inside the area the coast is expected to reach by 2105.
    const r = await page.evaluate(async () => {
      const loc = { name: "Happisburgh test", lat: 52.8245, lon: 1.5325, radius: 1000 };
      try {
        const c = checkCoastal({ loc, coastal: { ok: true, value: await getCoastalErosion(loc) } });
        return { status: c.status, found: c.found };
      } catch (e) { return { error: e.message }; }
    });
    if (r.error && /\b403\b/.test(r.error)) return { warn: `HTTP 403: ${EA_REFUSAL_NOTE}` };
    if (r.error) throw new Error(r.error);
    if (!["high", "medium"].includes(r.status)) throw new Error(`rated "${r.status}": ${r.found}`);
    return r.found.slice(0, 90) + "…";
  });

  await desktopStep("Data service status page", async () => {
    // Open status.html with a sample of today's results (the published file may not exist yet on a pull
    // request), and check it lists every service with a status, its topics and the 7-day dots.
    const sample = {
      checked: new Date().toISOString(),
      services: SERVICES.map(([name], i) => ({ name, status: i === 2 ? "fail" : "ok", detail: i === 2 ? "HTTP 503" : "120 ms", topics: SERVICE_TOPICS[name] || [] })),
      history: [{ date: new Date().toISOString().slice(0, 10), services: {} }]
    };
    const statusPage = await page.context().newPage();
    const errors = [];
    statusPage.on("pageerror", e => errors.push(e.message));
    await statusPage.route("https://raw.githubusercontent.com/**", r => r.fulfill({ json: sample }));
    await statusPage.goto(new URL("status.html", BASE).href);
    await statusPage.waitForSelector(".status-table tbody tr", { timeout: 15000 });
    const r = await statusPage.evaluate(() => ({
      rows: document.querySelectorAll(".status-table tbody tr").length,
      down: document.querySelectorAll(".status-table .chip.high").length,
      verdict: document.querySelector(".verdict")?.textContent || "",
      back: !!document.querySelector('a[href="./"]')
    }));
    await statusPage.close();
    if (errors.length) throw new Error("page errors: " + errors.join("; "));
    if (r.rows !== SERVICES.length) throw new Error(`${r.rows} rows for ${SERVICES.length} services`);
    if (r.down !== 1 || !/1 of \d+ services/.test(r.verdict)) throw new Error("the service that did not answer is not shown as such: " + r.verdict);
    if (!r.back) throw new Error("no link back to the app");
    return `${r.rows} services listed; ${r.verdict.trim()}`;
  });

  await desktopStep("What the words mean: every linked word has its meaning, linked from the report's words and the footer", async () => {
    const ids = await page.evaluate(() => [...new Set(Object.values(GLOSSARY))]);
    const links = await page.evaluate(() => ({
      footer: !!document.querySelector('footer a[href="glossary.html"]'),
      report: !!document.querySelector('#report a.term[href*="glossary.html#"]'),
      term: term("radon", "x").includes("glossary.html#radon")
    }));
    const g = await page.context().newPage();
    await g.goto(new URL("glossary.html", BASE).href);
    const r = await g.evaluate(ids => ({
      missing: ids.filter(id => !document.querySelector(`.glossary dt[id="${id}"] + dd`)),
      entries: document.querySelectorAll(".glossary dt").length,
      back: !!document.querySelector('a[href="./"]')
    }), ids);
    await g.close();
    if (r.missing.length) throw new Error("no meaning on the page for: " + r.missing.join(", "));
    if (!links.footer || !links.report || !links.term || !r.back) throw new Error("missing link: " + JSON.stringify({ ...links, back: r.back }));
    return `${r.entries} words explained`;
  });

  await desktopStep("Slow report names the service it is waiting for", async () => {
    // Every outside service answers at once with no data, except "flooding from heavy rain", which is held
    // back. After 8 seconds the summary must name the Environment Agency and that topic. Nothing is sent
    // to the outside services in this step.
    const slowPage = await page.context().newPage();
    const errors = [];
    slowPage.on("pageerror", e => errors.push(e.message));
    await slowPage.route(u => !u.href.startsWith(BASE), async r => {
      if (r.request().url().includes("risk-of-flooding-from-surface-water")) await new Promise(x => setTimeout(x, 15000));
      await r.fulfill({ json: { features: [] } }).catch(() => {});
    });
    try {
      await slowPage.goto(new URL("?lat=52.0&lon=-1.5&name=Slow%20test", BASE).href);
      await slowPage.waitForTimeout(5000);
      if (await slowPage.locator(".slow-note").count()) throw new Error("the note showed before 8 seconds");
      await slowPage.waitForSelector(".slow-note", { timeout: 6000 });
      const text = (await slowPage.locator(".slow-note").innerText()).replace(/\s+/g, " ");
      if (errors.length) throw new Error("page errors: " + errors.join("; "));
      if (!/Environment Agency: Flooding from heavy rain/.test(text)) throw new Error("unexpected note: " + text);
      return text.slice(0, 90) + "…";
    } finally { await slowPage.close(); }
  });

  await desktopStep("Next steps: notes, viewing and checklist folded, each with a count", async () => {
    const r = await page.evaluate(() => [...document.querySelectorAll("#nextSteps details.step-fold")]
      .map(d => ({ id: d.id, open: d.open, count: d.querySelector(":scope > summary .step-count").textContent })));
    const ids = r.map(x => x.id).join(",");
    if (ids !== "notes,viewing,checklist") throw new Error(`the parts are "${ids}", not notes, viewing, checklist`);
    const open = r.filter(x => x.open).map(x => x.id);
    if (open.length) throw new Error(`${open.join(", ")} open before being asked for`);
    const bad = r.filter(x => !(x.id === "notes" ? /^(Empty|Written)$/ : /^\d+ of \d+ done$/).test(x.count));
    if (bad.length) throw new Error(bad.map(x => `${x.id} says "${x.count}"`).join("; "));
    return r.map(x => `${x.id}: ${x.count}`).join(" · ");
  });

  await desktopStep("Send to my conveyancer", async () => {
    await page.click("#checklist > summary");
    const text = await page.evaluate(() => conveyancerText());
    if (!text.includes("?lat=") || !text.includes("Please could you include these searches")) throw new Error("the email text is incomplete");
    await page.click("#emailConveyancer");
    await until(() => document.getElementById("sendNote").textContent);
    const note = await page.$eval("#sendNote", x => x.textContent);
    if (!note.startsWith("Opening your email app")) throw new Error("the email button did not respond");
    return `email text ${text.length} characters`;
  });

  await step("Viewing checklist: short, serious topics first, ticks remembered", async () => {
    await page.click("#viewing > summary");
    await scrolled();
    const r = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#viewing input[data-tick]")].map(b => b.dataset.tick);
      const flagged = orderedResults().filter(c => ["high", "medium"].includes(c.status))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      const firstLook = flagged.map(c => (VIEWING_LOOK[c.id] || [])[0]).find(Boolean);
      const box = document.getElementById("viewing").getBoundingClientRect();
      return { items, firstLook, onScreen: document.getElementById("viewing").open && box.top < innerHeight && box.bottom > 0 };
    });
    if (!r.onScreen) throw new Error("At the viewing did not open in view");
    if (r.items.length < 5 || r.items.length > 12) throw new Error(`${r.items.length} items (expected 5 to 12)`);
    if (r.firstLook && r.items[0] !== r.firstLook) throw new Error(`first item is "${r.items[0]}", not the most serious topic's`);
    const first = page.locator("#viewing input[data-tick]").first();
    const countText = () => page.$eval("#viewing .tick-count", x => x.textContent);
    const before = await countText();
    await first.check();
    const after = await countText();
    await page.evaluate(() => restoreTicks());
    const kept = await first.isChecked();
    const afterRestore = await countText();
    await first.uncheck();
    if (!kept) throw new Error("a tick was not remembered");
    // Each list's heading counts its ticks: "0 of 7 done" becomes "1 of 7 done", also after reopening.
    const m = before.match(/^(\d+) of (\d+) done$/);
    if (!m) throw new Error(`the list heading says "${before}", not "N of M done"`);
    const want = `${Number(m[1]) + 1} of ${m[2]} done`;
    if (after !== want || afterRestore !== want) throw new Error(`after a tick the count says "${after}" / "${afterRestore}", not "${want}"`);
    return `${r.items.length} items; first: ${r.items[0].slice(0, 60)}…`;
  });

  await desktopStep("Back returns to the search, Forward reopens the report", async () => {
    await page.goBack();
    const backOk = await until(() => location.search === "" && document.getElementById("reportNav").classList.contains("hidden"));
    await page.goForward();
    await reportDone(page);
    return backOk ? "ok" : false;
  });

  await desktopStep("Saved property reopens instantly with notes", async () => {
    await page.click("#notes > summary");
    await page.fill("#notesText", "Automatic test note");
    await until(() => document.getElementById("notesFlash").textContent.includes("Saved"));
    const flash = await page.$eval("#notesFlash", x => x.textContent);
    if (!flash.includes("Saved")) throw new Error(`no "Saved" message after typing a note (got "${flash}")`);
    const written = await page.$eval("#notes .step-count", x => x.textContent);
    if (written !== "Written") throw new Error(`the Your notes fold says "${written}", not "Written"`);
    await page.reload();
    await reportDone(page);
    const instant = await page.$("#refreshBtn") !== null;
    const note = await page.$eval("#notesText", x => x.value);
    return instant && note === "Automatic test note" ? "ok" : false;
  });

  await step("Print summary and download", async () => {
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => { document.body.classList.add("print-summary"); dispatchEvent(new Event("beforeprint")); });
    // The printed map changes size and zoom: wait until its new tiles have loaded (the PDF is kept for people to look at).
    await until(() => { const m = document.getElementById("reportMap"), tiles = [...m.querySelectorAll("img.leaflet-tile")];
      return m.getBoundingClientRect().width === 360 && tiles.length && tiles.every(t => t.complete && t.classList.contains("leaflet-tile-loaded")); });
    try {   // the page is always put back on screen, even if a check below fails (later steps need it)
    // On paper: page 1 has the at-a-glance table (one row per topic); every page gets the place, date and page number;
    // app instructions, the tappable grid and the "saved results" note are left out.
    const paper = await page.evaluate(() => {
      const shown = sel => [...document.querySelectorAll(sel)].some(el => el.getClientRects().length > 0);
      const map = document.getElementById("reportMap").getBoundingClientRect();
      return { rows: document.querySelectorAll(".glance-table tbody tr:not(.glance-group)").length, topics: orderedResults().length,
        map: [Math.round(map.width), Math.round(map.height)], caption: shown("#mapCaption") && /^Figure 1\./.test(document.getElementById("mapCaption").textContent),
        cover: shown(".cover-details"), liveLink: shown(".live-link") && document.querySelector(".live-link").textContent.includes(location.href),
        keyFindings: document.querySelectorAll(".key-findings li").length, problems: orderedResults().filter(c => ["high", "medium"].includes(c.status)).length,
        keyShown: shown(".key-findings"), qr: shown(".cover-qr svg"),
        table: shown(".glance-table"), footer: (document.getElementById("printFooter") || {}).textContent || "",
        grid: shown(".topic-strip"), howTo: shown("#info-read"), saved: shown(".saved-note"), more: shown(".info-row"),
        icons: shown(".summary-head .icon-btn"), keep: shown(".keep-row"), checklists: shown(".next-steps"), notesPage: shown(".notes-page") };
    });
    if (!paper.table || paper.rows !== paper.topics) throw new Error(`the at-a-glance table shows ${paper.rows} of ${paper.topics} topics (visible: ${paper.table})`);
    if (paper.map[0] < 300 || Math.abs(paper.map[0] / paper.map[1] - 4 / 3) > 0.03 || !paper.caption) throw new Error(`printed map ${paper.map.join("×")} px, caption shown: ${paper.caption} (expected 4:3 with "Figure 1." caption)`);
    if (!paper.cover || !paper.liveLink || !paper.qr) throw new Error(`printed cover: details table ${paper.cover}, live report link ${paper.liveLink}, QR code ${paper.qr}`);
    const wantKey = Math.min(3, paper.problems);
    if (paper.keyFindings !== wantKey || (wantKey && !paper.keyShown)) throw new Error(`Key findings lists ${paper.keyFindings}, expected ${wantKey} (shown: ${paper.keyShown})`);
    if (!/counter\(page\)/.test(paper.footer) || !/counter\(pages\)/.test(paper.footer)) throw new Error("no page numbers in the printed footer");
    const onPaper = Object.entries({ grid: paper.grid, "how to read": paper.howTo, "saved note": paper.saved, "More button": paper.more, "share and print icons": paper.icons, "Keep this report buttons": paper.keep }).filter(([, v]) => v).map(([k]) => k);
    if (onPaper.length) throw new Error("printed but should not be: " + onPaper.join(", "));
    // The short printout is 2 pages: the cover, key findings and the topic table; checklists and the notes page are left out.
    if (paper.checklists || paper.notesPage) throw new Error("the short printout includes the checklists or the notes page");
    const pdf = await page.pdf({ path: `${OUT}/${device.name.replace(/\W+/g, "-")}-summary.pdf`, format: "A4" });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (pages < 1 || pages > 2) throw new Error(`the short printout is ${pages} pages (expected 2 at most)`);
    // The full printout adds a one-line contents under the summary and a lined notes page at the end.
    await page.evaluate(() => document.body.classList.remove("print-summary"));   // beforeprint already ran: only the mode changes
    const full = await page.evaluate(() => ({
      contents: [...document.querySelectorAll(".print-contents")].some(el => el.getClientRects().length > 0) && /Next steps/.test(document.querySelector(".print-contents").textContent),
      lines: document.querySelectorAll(".notes-page .note-line").length,
      notesShown: document.querySelector(".notes-page").getClientRects().length > 0 }));
    if (!full.contents || !full.notesShown || full.lines < 20) throw new Error(`full printout: contents line ${full.contents}, notes page ${full.notesShown} with ${full.lines} lines`);
    } finally {
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => { document.body.classList.remove("print-summary"); dispatchEvent(new Event("afterprint")); });
    }
    // Share and Print sit on the Summary heading's line as icons with spoken names; Download and Print full report
    // sit under the summary.
    const head = await page.evaluate(() => {
      const h = document.querySelector(".summary-title").getBoundingClientRect(), mid = r => r.top + r.height / 2;
      return ["shareBtn", "printSummary"].map(id => { const b = document.getElementById(id), r = b.getBoundingClientRect();
        return { id, label: b.getAttribute("aria-label") || "", inLine: r.width > 0 && Math.abs(mid(r) - mid(h)) < h.height, enabled: !b.disabled }; });
    });
    const off = head.filter(b => !b.inLine || !b.label || !b.enabled).map(b => b.id);
    if (off.length) throw new Error(`not usable on the Summary line: ${off.join(", ")}`);
    if (!(await page.isVisible(".keep-row #downloadHtml")) || !(await page.isVisible(".keep-row #printReport"))) throw new Error("Download report and Print full report are not under the summary");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadHtml")]);
    await download.saveAs(`${OUT}/${device.name.replace(/\W+/g, "-")}-report.html`);
    return download.suggestedFilename();
  });

  await step("One-line bar: the search and saved list shrink above the report", async () => {
    const hidden = id => page.evaluate(i => getComputedStyle(document.getElementById(i)).display === "none", id);
    const bar = await page.evaluate(() => ({ shown: !document.getElementById("placeBar").classList.contains("hidden"),
      name: document.getElementById("placeName").textContent, saved: document.getElementById("showSaved").textContent.trim() }));
    if (!bar.shown || !bar.name) throw new Error("the one-line bar is not shown above the report");
    if (!(await hidden("searchPanel")) || !(await hidden("savedPanel"))) throw new Error("the search or saved list is still shown in full");
    if (!/^Saved \(\d+\)$/.test(bar.saved)) throw new Error(`the saved button says "${bar.saved}"`);
    await page.click("#changePlace");
    const mapShown = !(await hidden("searchPanel")) && await page.$eval("#map", m => m.getBoundingClientRect().height > 100);
    await page.click("#changePlace");
    if (!mapShown || !(await hidden("searchPanel"))) throw new Error("Change did not show and hide the search map");
    await page.click("#showSaved");
    if (await hidden("savedPanel")) throw new Error("Saved did not show the saved list");
    return `${bar.name} · ${bar.saved}`;
  });

  await step("Saved properties are readable", async () => {
    // The name and details should use most of the row, not a thin column beside the buttons.
    const share = await page.evaluate(() => {
      const list = document.getElementById("savedList"), main = list && list.querySelector(".saved-main");
      return list && main && list.offsetWidth ? main.getBoundingClientRect().width / list.getBoundingClientRect().width : 0;
    });
    if (!share) throw new Error("the saved properties list did not show");
    if (share < 0.55) throw new Error(`names and details are squeezed into ${Math.round(share * 100)}% of the row`);
    return `text uses ${Math.round(share * 100)}% of the row`;
  });

  await desktopStep("Export and Import fold into Move to another device", async () => {
    const r = await page.evaluate(() => {
      const d = document.getElementById("moveDevice");
      return { closed: d && !d.open, inside: d && d.contains(document.getElementById("exportBtn")) && d.contains(document.getElementById("importBtn")) };
    });
    if (!r.inside) throw new Error("Export and Import are not in the Move to another device panel");
    if (!r.closed) throw new Error("the panel is open before it is used");
    await page.click("#moveDevice summary");
    const shown = await page.isVisible("#exportBtn") && await page.isVisible("#importBtn");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    await page.click("#moveDevice summary");
    if (!shown) throw new Error("Export and Import did not show when the panel opened");
    return download.suggestedFilename();
  });

  await step("Remove a saved property, then Undo puts it back", async () => {
    const before = await page.$$eval("#savedList li", x => x.length);
    const key = await page.$eval("#savedList [data-remove]", b => b.dataset.remove);
    await page.click("#savedList [data-remove]");
    const r = await page.evaluate(k => ({
      rows: document.querySelectorAll("#savedList li").length,
      bar: !document.getElementById("undoBar").classList.contains("hidden"),
      focus: document.activeElement && document.activeElement.id,
      snap: localStorage.getItem("plc-snap:" + k) !== null
    }), key);
    if (r.rows !== before - 1 || r.snap) throw new Error("Remove did not remove the property");
    if (!r.bar || r.focus !== "undoBtn") throw new Error("no Undo button offered, or it did not get focus");
    await page.click("#undoBtn");
    const back = await page.evaluate(k => ({
      rows: document.querySelectorAll("#savedList li").length,
      snap: localStorage.getItem("plc-snap:" + k) !== null,
      bar: !document.getElementById("undoBar").classList.contains("hidden")
    }), key);
    if (back.rows !== before || !back.snap || back.bar) throw new Error("Undo did not put the property and its saved report back");
    return "ok";
  });

  await step("Compare up to three saved properties, and show only differences", async () => {
    // Add two copies of the saved property (one with a different first rating), compare all three, then put the list back.
    const keep = await page.evaluate(() => {
      const list = store.get(SAVED_KEY, []), orig = JSON.stringify(list), s = list[0];
      const copy = (n, change) => ({ ...JSON.parse(JSON.stringify(s)), key: "test-cmp-" + n, name: "Test copy " + n, starred: false,
        checks: s.checks.map((c, i) => i === 0 && change ? { ...c, status: c.status === "high" ? "low" : "high" } : c) });
      store.set(SAVED_KEY, [...list, copy(1, false), copy(2, true)]);
      renderSaved();
      return orig;
    });
    try {
      await page.check(`#savedList input[data-compare="test-cmp-1"]`);
      await page.check(`#savedList input[data-compare="test-cmp-2"]`);
      if (await page.isDisabled("#compareBtn")) throw new Error("Compare is not ready with two properties ticked");
      await page.check("#savedList input[data-compare]:not(:checked)");
      const off = await page.$$eval("#savedList input[data-compare]:not(:checked)", x => x.every(b => b.disabled));
      if (!off) throw new Error("a fourth property could still be ticked");
      await page.click("#compareBtn");
      const r = await page.evaluate(() => ({
        cols: document.querySelectorAll("#compareTable thead th").length,
        title: document.getElementById("compareTitle").textContent,
        rows: document.querySelectorAll("#compareTable tbody tr").length
      }));
      if (r.cols !== 4 || !r.title.includes("three")) throw new Error(`expected three properties side by side (got ${r.cols - 1}, "${r.title}")`);
      await page.check("#diffOnly");
      const shown = await page.$$eval("#compareTable tbody tr", x => x.filter(tr => tr.offsetHeight > 0).length);
      const help = await page.$eval("#diffHelp", x => x.textContent);
      if (shown < 2 || shown >= r.rows) throw new Error(`"Show only topics that differ" showed ${shown} of ${r.rows} rows`);
      if (!/^Showing/.test(help)) throw new Error(`no message about the topics shown (got "${help}")`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error("the comparison scrolls sideways");
      return `${r.rows} rows, ${shown} shown with differences only`;
    } finally {
      await page.evaluate(orig => { document.getElementById("comparePanel").classList.add("hidden"); localStorage.setItem(SAVED_KEY, orig); renderSaved(); }, keep);
    }
  });

  await step("No sideways scrolling", async () =>
    (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) ? "ok" : false);

  record(group, "No page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
  await context.close();
  return topics;
}

/* ---------------------------------------------------------------
   Run everything and write the summary
--------------------------------------------------------------- */
// If the app itself does not answer (for example a local server that is not running), the page steps are left
// out with one failure instead of a hundred; the data services are still checked and the summary is written.
const appAnswers = await fetch(BASE, { signal: AbortSignal.timeout(20000) }).then(r => r.ok, () => false);
let browser;
const reports = {};
try {
  if (ONLY_SERVICES.length) {
    for (const service of SERVICES.filter(([name]) => ONLY_SERVICES.includes(name))) await checkService(service);
    process.exit(0);
  }
  const noTopics = SERVICES.map(([name]) => name).filter(name => !SERVICE_TOPICS[name]);
  record("Data services", "Every service lists the report topics it feeds", !noTopics.length,
    noTopics.length ? "missing in SERVICE_TOPICS: " + noTopics.join("; ") : `${SERVICES.length} services`);
  // data/data-services.csv lists the report data services (one per row after the header): keep it in step with SERVICES.
  const listed = readFileSync(new URL("../data/data-services.csv", import.meta.url), "utf8").trim().split("\n").length - 1;
  const reportServices = SERVICES.filter(isReportDataService).length;
  record("Data services", "data/data-services.csv lists every report data service", listed === reportServices,
    `${listed} rows in the file, ${reportServices} report data services in the test`);
  const toCheck = CHECK_DATA_SERVICES ? SERVICES : SERVICES.filter(s => !isReportDataService(s));
  for (const service of toCheck) await checkService(service);
  if (!CHECK_DATA_SERVICES) console.log(`Left out on request (DATA_SERVICES=0): ${reportServices} report data services. Run the check by hand to test them.`);
  if (!appAnswers) throw new Error(`the app does not answer at ${BASE}: start the server (see CLAUDE.md "Serve locally")`);
  browser = await chromium.launch();
  await loadReplay();
  // On replay, the third report uses the place the daily run picked, so its answers are recorded too.
  const randomPlace = replayData && replayData.randomPlace ? replayData.randomPlace : await randomEnglishPostcode();
  const places = [FIXED[0], FIXED[1], randomPlace];
  for (let i = 0; i < DEVICES.length; i++) {
    // The Environment Agency map server allows only about 15 requests a minute from
    // one address, and one report sends about 7. Pausing before each report keeps
    // the test within that limit, like a person checking one property at a time.
    const paceNeeded = !replayData || askedLive.has("environment.data.gov.uk");   // a question missing from the recording went live
    const pause = new Promise(r => setTimeout(r, paceNeeded ? PAUSE_BEFORE_REPORT_MS : 0));
    if (i === 0) await testCountryData().catch(e => record("Country data (desktop)", "The country data steps crashed", false, e.message));
    await pause;
    const topics = await testDevice(DEVICES[i], places[i]);
    reports[`${DEVICES[i].name}: ${places[i].join(", ")}`] = topics;
  }
  if (replayData) record("Test run", "Report data from the daily recording", true,
    `${replayed} answers from the recording of ${String(replayData.recorded).slice(0, 10)}` +
    (askedLive.size ? `; asked live (not recorded): ${[...askedLive].sort().join(", ")}` : "; nothing asked live"));
  if (RECORD) writeFileSync(`${OUT}/recordings.json`, JSON.stringify({ recorded: new Date().toISOString(), base: BASE, randomPlace, answers: recorded }));
} catch (e) {
  record("Test run", "The test itself crashed", false, e.message);
} finally {
  if (browser) await browser.close();
}

const failed = results.filter(r => !r.pass);
const warned = results.filter(r => r.warn);
const lines = [
  `# Property Location Check – automatic test`,
  ``,
  `Tested: ${BASE}  `,
  `Date: ${new Date().toUTCString()}  `,
  `Result: **${failed.length ? `${failed.length} problem(s) found` : "all checks passed"}** (${results.length - failed.length} of ${results.length} passed` +
    (warned.length ? `, ${warned.length} with a warning` : "") + `)`,
  ``
];
if (failed.length) {
  lines.push(`## Problems`, ``, `| Area | Check | Details |`, `|---|---|---|`);
  failed.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
  lines.push(``);
}
if (warned.length) {
  lines.push(`## Warnings (do not fail the check)`, ``, `| Area | Check | Details |`, `|---|---|---|`);
  warned.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
  lines.push(``);
}
lines.push(`## All checks`, ``, `| Result | Area | Check | Details |`, `|---|---|---|---|`);
results.forEach(r => lines.push(`| ${r.warn ? "⚠️" : r.pass ? "✅" : "❌"} | ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
lines.push(``, `## Report results`, ``);
Object.entries(reports).forEach(([name, topics]) => {
  lines.push(`**${name}**`, ``);
  (topics || []).forEach(t => lines.push(`- ${t.id}: ${t.status} – ${t.found}`));
  lines.push(``);
});

const summary = lines.join("\n");
writeFileSync(`${OUT}/summary.md`, summary);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, date: new Date().toISOString(), results, reports }, null, 2));
// For the data service status page: one row per outside service (published by the daily run only).
writeFileSync(`${OUT}/status.json`, JSON.stringify({
  checked: new Date().toISOString(), base: BASE,
  services: SERVICES.map(([name]) => {
    const r = results.find(x => x.group === "Data services" && x.name === name);
    return { name, status: !r ? "fail" : r.warn ? "warn" : r.pass ? "ok" : "fail", detail: r ? r.info.slice(0, 200) : "not checked", topics: SERVICE_TOPICS[name] || [] };
  })
}, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed` + (warned.length ? ` (${warned.length} with a warning).` : "."));
process.exit(failed.length ? 1 : 0);
