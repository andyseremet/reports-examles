// Property Location Check – links, settings, the version number and shared helpers.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

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
  police: "https://www.police.uk/",
  policeData: "https://data.police.uk/",
  epc: "https://www.gov.uk/find-energy-certificate",
  ofcom: "https://www.ofcom.org.uk/mobile-coverage-checker",
  historicEngland: "https://historicengland.org.uk/listing/the-list/",
  magic: "https://magic.defra.gov.uk/",
  sepaMaps: "https://map.sepa.org.uk/floodmaps",
  nrwMaps: "https://flood-risk-maps.naturalresources.wales/",
  pastFloodsEngland: "https://www.arcgis.com/home/item.html?id=46bfb5e552a14f7c85c4db5c5a86d267",
  pastFloodsWales: "https://datamap.gov.wales/layers/inspire-nrw:NRW_HISTORIC_FLOODMAP",
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
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="7" y="14" width="10" height="7" rx="1"/><path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'
};
const icon = (name, size = 16) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${size > 16 ? 1.7 : 2}" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;

const STATUS_ORDER = { high: 0, medium: 1, error: 2, info: 3, manual: 4, low: 5 };

const MAP_COLOURS = { landfill: "#b45309", landslide: "#7c3aed", hazard: "#b42318", contaminated: "#4b5563", coalTip: "#1f2937", wasteSite: "#166534" };

const REQUEST_TIMEOUT = 15000;   // a hung service gives up after 15 s; its topic is then tried once more (startTask)
const APP_VERSION = "2.6.0";
const APP_UPDATED = "8 November 2026";

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
  if (km < 0.05) return "under 50 m";   // never "0 m" (third place review, 8 November 2026)
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
const sentenceStart = text => text.charAt(0).toUpperCase() + text.slice(1);
const byDistance = (a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99);

// A planning.data.gov.uk point ("POINT(lon lat)") with its distance from the pin.
function pointFrom(loc, wkt) {
  const p = parseWktPoint(wkt);
  return { distanceKm: p ? distanceKm(loc, p) : null, lat: p?.lat, lon: p?.lon };
}

export { $, andList, APP_UPDATED, APP_VERSION, boundingBox, byDistance, circleWkt, distanceKm, escapeHTML,
  formatDistance, formatRadius, geometryCentre, GLOSSARY, icon, ICON_PATHS, link, LINKS, MAP_COLOURS, monthName,
  okValue, parseWktPoint, PLANNING_AT_POINT, PLANNING_NEARBY, plural, pointFrom, REQUEST_TIMEOUT, sentenceStart,
  STATUS_LABEL, STATUS_ORDER, STATUS_SYMBOL, term, today };
