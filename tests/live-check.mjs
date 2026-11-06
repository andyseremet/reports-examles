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
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

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
const annotation = text => String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const record = (group, name, pass, info = "") => {
  results.push({ group, name, pass: pass === "warn" ? true : pass, warn: pass === "warn", info: String(info).slice(0, 900) });
  const label = pass === "warn" ? "WARN" : pass ? "PASS" : "FAIL";
  if (!QUIET || label !== "PASS") console.log(`${label}  [${group}] ${name}${info ? "  – " + String(info).slice(0, 160) : ""}`);
  if (ON_GITHUB && label !== "PASS")
    console.log(`::${label === "FAIL" ? "error" : "warning"} title=${annotation(`[${group}] ${name}`).replace(/[,:]/g, " ")}::${annotation(String(info).slice(0, 300))}`);
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
  ["Postcodes (postcodes.io)", `https://api.postcodes.io/postcodes?lon=${LON}&lat=${LAT}&limit=1`, d => d.result && d.result[0].postcode],
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
  ["Crime (data.police.uk)", `https://data.police.uk/api/crimes-street/all-crime?lat=${LAT}&lng=${LON}`, d => Array.isArray(d) && d.length > 0],
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
  "Coal mining (Mining Remediation Authority)": ["Coal mining"],
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
  const page = await context.newPage();
  let eaRequests = 0;
  await page.route("https://environment.data.gov.uk/spatialdata/**", r => { eaRequests++; return r.fulfill({ json: { features: [] } }); });
  const step = async (name, fn) => {
    try { const info = await fn(); record(group, name, info !== false, info === false ? "" : info || ""); }
    catch (e) { record(group, name, false, e.message.split("\n")[0]); }
  };
  try {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForFunction(() => typeof getScotlandSites === "function", null, { timeout: 30000 });
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
      if (["low", "info"].includes(r.airNoHotspotData)) throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}"`);
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
      if (["low", "info"].includes(r.airNoHotspotData)) throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}"`);
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
      if (r.air.status !== "manual") throw new Error(`NI air quality (no hotspot map) rated "${r.air.status}", expected Check yourself`);
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
  const step = async (name, fn) => {
    try {
      const info = await fn();
      if (info && info.warn) record(group, name, "warn", info.warn);
      else record(group, name, info !== false, info === false ? "" : info || "");
    }
    catch (e) { record(group, name, false, e.message.split("\n")[0]); }
  };
  const file = name => `${OUT}/${device.name.replace(/\W+/g, "-")}-${name}.png`;

  await step("Page opens with the search ready", async () => {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    return (await page.$eval(".leaflet-top.leaflet-left .map-ctrl", x => x.classList.contains("open"))) ? "search open" : false;
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
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const b = document.getElementById("map").getBoundingClientRect(); return [b.left, b.top, b.width, b.height, innerWidth, innerHeight].map(Math.round); });
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("pressing the full-screen button moved the pin");
    await page.screenshot({ path: file("fullscreen") });
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await page.waitForTimeout(600);
    const closed = !(await page.evaluate(() => mapIsFull));
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("closing full screen moved the pin");
    return r[0] === 0 && r[1] === 0 && Math.abs(r[2] - r[4]) <= 1 && Math.abs(r[3] - r[5]) <= 1 && closed ? `map ${r[2]}×${r[3]}` : false;
  });

  await step("Offline: says so and waits to run the check", async () => {
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
    await page.waitForTimeout(500);
    const gone = await page.$eval("#offlineBar", x => x.classList.contains("hidden"));
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
      await page.click(`[data-retry="${id}"]`);
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
  await page.$eval("#reportTop", x => x.scrollIntoView()).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file("report") });

  await step("Topic icons and section bar", async () => {
    const icons = await page.$$eval(".topic-strip li", l => l.length);
    await page.click('#reportNav a[data-nav="group-living"]');
    await page.waitForTimeout(1500);
    const active = await page.$eval("#reportNav a.active", x => x.textContent).catch(() => null);
    return icons >= 13 && active === "Living" ? `${icons} icons, section bar ok` : false;
  });

  await step("Finding your way: legend, folded no-issue topics, Open problems and Details", async () => {
    const r0 = await page.evaluate(() => {
      const results = orderedResults();
      const legend = [...document.querySelectorAll(".rating-legend .chip")].reduce((n, c) => n + parseInt(c.textContent.replace(/\D+/g, " ").trim(), 10), 0);
      const low = results.filter(c => c.status === "low").map(c => c.id).sort();
      const folded = [...document.querySelectorAll(".clear-fold .fold-body .slot")].map(el => el.id.slice(5)).sort();
      const symbols = [...document.querySelectorAll("#report .chip:is(.high,.medium,.low,.info,.manual,.error)")].filter(c => !c.querySelector(".chip-symbol")).length;
      return { total: results.length, legend, low, folded, symbols, countBoxes: document.querySelectorAll("a.count").length };
    });
    // The legend counts every topic once; the count boxes are gone; every chip has its symbol.
    if (r0.legend !== r0.total) throw new Error(`legend counts ${r0.legend} topics, expected ${r0.total}`);
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
    await page.waitForTimeout(1200);
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

  await step("Data gaps box lists every topic without an answer", async () => {
    // Every "Check yourself" or "Not available" topic must appear in the box, with a way to check it
    // instead, and not in "Start here"; with no such topics, the box is hidden.
    const r = await page.evaluate(() => {
      const want = orderedResults().filter(c => ["manual", "error"].includes(c.status)).map(c => c.id).sort();
      const rows = [...document.querySelectorAll(".gaps-box li")];
      const inBox = rows.map(li => li.querySelector("[data-open]").dataset.open.replace("check-", "")).sort();
      const noWay = rows.filter(li => li.querySelector(".gap-ask").textContent.replace("Instead:", "").trim().length < 10).length;
      const inStart = document.querySelectorAll(".priority li .chip.manual, .priority li .chip.error").length;
      return { want, inBox, noWay, inStart, box: !!document.querySelector(".gaps-box") };
    });
    if (r.want.join() !== r.inBox.join()) throw new Error(`box lists [${r.inBox}] but expected [${r.want}]`);
    if (r.noWay) throw new Error(`${r.noWay} row(s) do not say how to check instead`);
    if (r.inStart) throw new Error(`${r.inStart} gap topic(s) still in "Start here"`);
    if (!r.want.length && r.box) throw new Error("box shown with no gaps");
    if (r.want.length) {
      // The box folds away with Details / Hide: open for up to 3 topics, closed for more, and the
      // person's choice stays when the report is drawn again.
      const fold = async () => page.$eval("#gapsBox", d => ({ open: d.open, word: getComputedStyle(d.querySelector("summary .more-text"), "::before").content }));
      const first = await fold();
      if (first.open !== (r.want.length <= 3)) throw new Error(`with ${r.want.length} gap(s) the box should start ${r.want.length <= 3 ? "open" : "closed"}`);
      if (first.word !== (first.open ? '"Hide"' : '"Details"')) throw new Error(`the box shows ${first.word} when ${first.open ? "open" : "closed"}`);
      await page.click("#gapsBox > summary");
      await page.evaluate(() => renderSummary());
      const after = await fold();
      if (after.open === first.open) throw new Error("Details / Hide did not change the box, or the choice was lost on redraw");
      await page.click("#gapsBox > summary");
    }
    return r.want.length ? `${r.want.length} gap(s): ${r.want.join(", ")}` : "no gaps, box hidden";
  });

  await step("Tapping a topic shows why", async () => {
    await page.click('.topic-strip [data-why="radon"]');
    await page.waitForTimeout(300);
    const text = await page.$eval("#whyBox", x => x.hidden ? "" : x.textContent.replace(/\s+/g, " ").trim());
    const expanded = await page.$eval('.topic-strip [data-why="radon"]', x => x.getAttribute("aria-expanded"));
    await page.click('.topic-strip [data-why="radon"]');   // tap again to close
    await page.waitForTimeout(300);
    const closed = await page.$eval("#whyBox", x => x.hidden);
    return text.startsWith("Radon") && text.length > 25 && expanded === "true" && closed ? text.slice(0, 70) + "…" : false;
  });

  await step("Each topic says how current its data is", async () => {
    const missing = await page.evaluate(() => orderedResults()
      .filter(c => !["manual", "error"].includes(c.status))
      .filter(c => { const d = document.querySelector(`#check-${c.id} .data-date`); return !d || d.textContent.trim().length < 12; })
      .map(c => c.id));
    if (missing.length) throw new Error("no data date on: " + missing.join(", "));
    return await page.$eval("#check-crime .data-date", x => x.textContent.trim()).catch(() => "ok");
  });

  await step("Crime where the police publish no data", async () => {
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

  await step("Coastal erosion on an eroding coast", async () => {
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

  await step("Data service status page", async () => {
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

  await step("Slow report names the service it is waiting for", async () => {
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

  await step("Next steps: notes, viewing and checklist folded, each with a count", async () => {
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

  await step("Send to my conveyancer", async () => {
    await page.click("#checklist > summary");
    const text = await page.evaluate(() => conveyancerText());
    if (!text.includes("?lat=") || !text.includes("Please could you include these searches")) throw new Error("the email text is incomplete");
    await page.click("#emailConveyancer");
    await page.waitForTimeout(300);
    const note = await page.$eval("#sendNote", x => x.textContent);
    if (!note.startsWith("Opening your email app")) throw new Error("the email button did not respond");
    return `email text ${text.length} characters`;
  });

  await step("Viewing checklist: short, serious topics first, ticks remembered", async () => {
    await page.click("#viewingBtn");
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#viewing input[data-tick]")].map(b => b.dataset.tick);
      const flagged = orderedResults().filter(c => ["high", "medium"].includes(c.status))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      const firstLook = flagged.map(c => (VIEWING_LOOK[c.id] || [])[0]).find(Boolean);
      const box = document.getElementById("viewing").getBoundingClientRect();
      return { items, firstLook, onScreen: box.top < innerHeight && box.bottom > 0 };
    });
    if (!r.onScreen) throw new Error("the Viewing checklist button did not go to the list");
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

  await step("Back returns to the search, Forward reopens the report", async () => {
    await page.goBack();
    await page.waitForTimeout(1000);
    const backOk = await page.evaluate(() => location.search === "" && document.getElementById("toolbar").classList.contains("hidden"));
    await page.goForward();
    await reportDone(page);
    return backOk ? "ok" : false;
  });

  await step("Saved property reopens instantly with notes", async () => {
    await page.click("#notes > summary");
    await page.fill("#notesText", "Automatic test note");
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(800);
    await page.pdf({ path: `${OUT}/${device.name.replace(/\W+/g, "-")}-summary.pdf`, format: "A4" });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => { document.body.classList.remove("print-summary"); dispatchEvent(new Event("afterprint")); });
    // Open the "Save or print" menu, as a person would, then choose Download report.
    await page.click("#saveMenuBtn");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadHtml")]);
    if (await page.$eval("#saveMenu", d => d.open)) throw new Error("the Save or print menu stayed open after choosing");
    await download.saveAs(`${OUT}/${device.name.replace(/\W+/g, "-")}-report.html`);
    return download.suggestedFilename();
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

  await step("Export and Import fold into Move to another device", async () => {
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
let browser;
const reports = {};
try {
  const noTopics = SERVICES.map(([name]) => name).filter(name => !SERVICE_TOPICS[name]);
  record("Data services", "Every service lists the report topics it feeds", !noTopics.length,
    noTopics.length ? "missing in SERVICE_TOPICS: " + noTopics.join("; ") : `${SERVICES.length} services`);
  for (const service of SERVICES) await checkService(service);
  browser = await chromium.launch();
  const randomPlace = await randomEnglishPostcode();
  const places = [FIXED[0], FIXED[1], randomPlace];
  for (let i = 0; i < DEVICES.length; i++) {
    // The Environment Agency map server allows only about 15 requests a minute from
    // one address, and one report sends about 7. Pausing before each report keeps
    // the test within that limit, like a person checking one property at a time.
    const pause = new Promise(r => setTimeout(r, PAUSE_BEFORE_REPORT_MS));
    if (i === 0) await testCountryData().catch(e => record("Country data (desktop)", "The country data steps crashed", false, e.message));
    await pause;
    const topics = await testDevice(DEVICES[i], places[i]);
    reports[`${DEVICES[i].name}: ${places[i].join(", ")}`] = topics;
  }
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
