"use strict";
// Property Location Check – fetching data from the outside services, and the list of data tasks (TASKS).
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   DATA RETRIEVAL
========================================================= */

const placeCache = new Map();
function getPlace(loc) {
  const key = Number(loc.lat).toFixed(5) + "," + Number(loc.lon).toFixed(5);
  if (!placeCache.has(key)) {
    // postcodes.io first; if it does not answer, OpenStreetMap's reverse lookup gives the country and council.
    const promise = fetchJSON(API.postcodes + "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=2000&limit=1")
      .then(d => (d.result && d.result[0]) || null, () => placeFromOsm(loc));
    promise.catch(() => placeCache.delete(key));   // try again next time if it failed
    placeCache.set(key, promise);
  }
  return placeCache.get(key);
}

// Backup for getPlace: the country (from the ISO region code), postcode and council-level place name from OpenStreetMap.
// It has no ward or census area codes, so crime per 1,000 residents is left out while postcodes.io is down.
const OSM_COUNTRY = { "GB-ENG": "England", "GB-SCT": "Scotland", "GB-WLS": "Wales", "GB-NIR": "Northern Ireland" };
async function placeFromOsm(loc) {
  const d = await fetchJSON(`${API.nominatimReverse}?format=json&zoom=18&addressdetails=1&lat=${loc.lat}&lon=${loc.lon}`);
  const a = (d && d.address) || {};
  const country = OSM_COUNTRY[a["ISO3166-2-lvl4"]];
  if (!country) return null;
  const postcode = a.postcode || "";
  return { country, postcode, outcode: postcode.split(" ")[0], admin_district: a.city || a.county || "",   // a council-level name only (a town or region would name the wrong council)
    admin_ward: "", fromBackup: "OpenStreetMap" };
}

// Ask a WMS map service what is at the centre pixel of a small square around the pin.
async function wmsInfo(service, layers, loc, d, extra) {
  const params = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers, query_layers: layers, styles: "",
    crs: "EPSG:4326", bbox: [loc.lat - d, loc.lon - d, loc.lat + d, loc.lon + d].join(","),
    width: 11, height: 11, i: 5, j: 5, info_format: "application/json", ...extra
  });
  return (await fetchJSON(service + "?" + params)).features || [];
}

// Read the features of a map layer at the pin (vector layers: attributes, not pixel values).
async function wmsFeaturesAt(service, layer, loc) {
  // About 5 m around the pin.
  return (await wmsInfo(service, layer, loc, 0.00005, { feature_count: 10, buffer: 0 })).map(f => f.properties || {});
}

// England: Environment Agency "Risk of flooding from surface water" (2025 national assessment).
async function getSurfaceWater(loc) {
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return null;   // SEPA and NRW: getFloodNational
  const props = await wmsFeaturesAt(API.surfaceWater, "rofsw", loc);
  const order = ["High", "Medium", "Low"];
  const bands = props.map(x => x.risk_band).filter(b => order.includes(b));
  return { band: bands.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || null };
}

// Scotland (SEPA) and Wales (Natural Resources Wales) flood maps. England returns null.
async function getFloodNational(loc) {
  const place = await getPlace(loc);
  const country = place && place.country;
  if (country === "Scotland") {
    const count = layer => arcgisRequest(`${API.sepaFlood}/${layer}/query`, loc, 0, { returnCountOnly: "true" }).then(d => d.count > 0);
    // Layers 0-2 river, 3-5 surface water, 6-8 coastal; each High, Medium, Low likelihood.
    const hits = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8].map(count));
    const level = start => hits[start] ? "High" : hits[start + 1] ? "Medium" : hits[start + 2] ? "Low" : null;
    return { country, river: level(0), surface: level(3), coastal: level(6) };
  }
  if (country === "Wales") {
    const [riversSea, surface] = await Promise.all([
      wmsFeaturesAt(API.nrwFlood, "inspire-nrw:NRW_FLOODZONE_RIVERS_SEAS_MERGED", loc),
      wmsFeaturesAt(API.nrwFlood, "inspire-nrw:NRW_FLOODZONE_SURFACE_WATER_AND_SMALL_WATERCOURSES", loc)
    ]);
    const zone = list => {
      const zones = list.map(x => x.risk).filter(Boolean);
      return zones.find(z => /3/.test(z)) || zones.find(z => /2/.test(z)) || null;
    };
    const dates = [...riversSea, ...surface].map(x => x.pub_date).filter(Boolean).sort();
    return { country, zone: zone(riversSea), surface: zone(surface), published: dates[dates.length - 1] || null };
  }
  return { country: country || null };
}

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

const titleCase = text => String(text || "").toLowerCase()
  .replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Pms|Nhs|Gp|Uk)\b/g, w => w.toUpperCase());

// Census 2021 residents per local area (MSOA). A census is never re-counted, so these
// fixed figures are saved with the app (data/census2021-msoa-residents.json) instead of
// being asked for each time.
const getCensusResidents = once(() => fetchJSON("data/census2021-msoa-residents.json").then(d => d.residents));
const getStationList = once(() => fetchJSON("data/rail-stations.json"));

// planning.data.gov.uk: entities matching the parameters, for one or more datasets.
function planningQuery(params, datasets = [], fields = []) {
  const q = new URLSearchParams(params);
  datasets.forEach(d => q.append("dataset", d));
  fields.forEach(f => q.append("field", f));
  return fetchJSON(API.planning + "?" + q);
}
const planningEntities = (...args) => planningQuery(...args).then(d => d.entities || []);
// Everything touching a circle around the pin, without the (large) outlines.
const inCircle = (loc, radiusM, limit = 500) =>
  ({ geometry: circleWkt(loc.lat, loc.lon, radiusM), geometry_relation: "intersects", limit, exclude_field: "geometry" });

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

// Crime in the local neighbourhood (census "MSOA", about 8,000 residents) per 1,000 residents.
async function getCrimeArea(loc) {
  const place = await getPlace(loc);
  const code = place && place.codes && place.codes.msoa;
  if (!code || !/^[EW]02/.test(code)) return null;     // England and Wales only
  const [boundary, population] = await Promise.all([
    fetchJSON(API.msoaBoundary + "?" + new URLSearchParams({
      where: `MSOA21CD='${code}'`, outFields: "MSOA21CD,MSOA21NM", returnGeometry: "true",
      outSR: "4326", geometryPrecision: "5", maxAllowableOffset: "0.0005", f: "json"
    })),
    getCensusResidents()
  ]);
  const feature = boundary.features && boundary.features[0];
  const ring = feature && feature.geometry && feature.geometry.rings && feature.geometry.rings[0];
  const residents = population[code];
  if (!ring || !residents) return null;
  const step = Math.max(1, Math.ceil(ring.length / 90));          // keep the area outline short
  const poly = ring.filter((_, i) => i % step === 0).map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(":");
  const crimes = await fetchJSON(API.crime + "?poly=" + poly);
  const notASB = crimes.filter(c => c.category !== "anti-social-behaviour").length;
  return {
    code, name: feature.attributes.MSOA21NM, residents,
    month: crimes[0] ? crimes[0].month : null, total: crimes.length, crimes: notASB,
    perThousand: Math.round(notASB / residents * 1000 * 10) / 10
  };
}

function getPlanningAtPoint(loc) {
  return withBackup(() => planningEntities({ latitude: loc.lat, longitude: loc.lon, limit: 200, exclude_field: "geometry" }, PLANNING_AT_POINT),
    loc, 0, PLANNING_AT_POINT);
}

async function getPlanningNearby(loc) {
  return withBackup(async () => (await planningEntities(inCircle(loc, loc.radius), PLANNING_NEARBY)).map(e => ({ ...e, ...pointFrom(loc, e.point) })),
    loc, loc.radius, PLANNING_NEARBY);
}

// When planning.data.gov.uk does not answer (England only), heritage and nature are asked from the original publishers:
// Historic England (National Heritage List for England, and its conservation areas map) and Natural England, and the flood zone at the pin from the
// Environment Agency (one request to its paced map server, agreed by the owner for outages only). Nothing is asked from
// them otherwise. Nearby flood zones, main rivers, air quality areas, Green Belt, HS2, contaminated land
// and the other sets have no second open source, so they stay "not available". The backup answer travels with the failure (R[key].backup), so only the
// checks that read it (planning, nature) use it; every other check still sees planning.data.gov.uk as not answering.
const BACKUP_LAYERS = {
  "listed-building": ["Historic England", API.heritageEngland + "/0/query", "Name", true],
  "listed-building-outline": ["Historic England", API.heritageEngland + "/3/query", "Name"],
  "scheduled-monument": ["Historic England", API.heritageEngland + "/6/query", "Name"],
  "world-heritage-site": ["Historic England", API.heritageEngland + "/10/query", "Name"],
  "conservation-area": ["Historic England", API.conservationEngland, "NAME"],
  "site-of-special-scientific-interest": ["Natural England", API.natureEngland + "/SSSI_England/FeatureServer/0/query", "NAME"],
  "special-area-of-conservation": ["Natural England", API.natureEngland + "/Special_Areas_of_Conservation_England/FeatureServer/0/query", "SAC_NAME"],
  "special-protection-area": ["Natural England", API.natureEngland + "/Special_Protection_Areas_England/FeatureServer/0/query", "SPA_NAME"],
  "ancient-woodland": ["Natural England", API.natureEngland + "/Ancient_Woodland_England/FeatureServer/0/query", "NAME"],
  "local-nature-reserve": ["Natural England", API.natureEngland + "/Local_Nature_Reserves_England/FeatureServer/0/query", "NAME"],
  "national-park": ["Natural England", API.natureEngland + "/National_Parks_England/FeatureServer/0/query", "NAME"],
  "area-of-outstanding-natural-beauty": ["Natural England", API.natureEngland + "/Areas_of_Outstanding_Natural_Beauty_England/FeatureServer/0/query", "NAME"]
};

// The flood zone at the pin (Flood Zone 2 or 3; none means Zone 1), in planning.data.gov.uk's shape.
async function floodZoneBackup(loc) {
  const zones = (await wmsFeaturesAt(API.floodZones, "Flood_Zones_2_3_Rivers_and_Sea", loc))
    .map(p => /FZ([23])/.exec(p.flood_zone || "")).filter(Boolean).map(m => m[1]);
  return zones.map(level => ({ dataset: "flood-risk-zone", name: "Flood Zone " + level, "flood-risk-level": level }));
}

async function planningBackup(loc, radiusM, datasets) {
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return null;
  const floodHere = radiusM === 0 && datasets.includes("flood-risk-zone");
  const wanted = [...datasets.filter(d => BACKUP_LAYERS[d]), ...(floodHere ? ["flood-risk-zone"] : [])];
  const answers = await Promise.allSettled(wanted.map(async d => {
    if (d === "flood-risk-zone") return floodZoneBackup(loc);
    const [, url, nameField, points] = BACKUP_LAYERS[d];
    const features = await arcgisQuery(url, loc, radiusM, { outFields: nameField, returnGeometry: String(!!points), outSR: "4326", resultRecordCount: "200" });
    return features.map(f => {
      const g = f.geometry, xy = g && (g.points ? g.points[0] : g.x != null ? [g.x, g.y] : null);
      const p = xy ? { lon: xy[0], lat: xy[1] } : null;
      return { dataset: d, name: f.attributes[nameField] || "", ...(p ? { ...p, distanceKm: distanceKm(loc, p) } : { distanceKm: null }) };
    });
  }));
  const answered = wanted.filter((d, i) => answers[i].status === "fulfilled");
  if (!answered.length) return null;
  const publisher = d => d === "flood-risk-zone" ? "the Environment Agency" : BACKUP_LAYERS[d][0];
  return {
    entities: answers.flatMap(a => a.status === "fulfilled" ? a.value : []),
    from: Object.fromEntries(answered.map(d => [d, publisher(d)])),     // dataset → who answered it
    missing: datasets.filter(d => !answered.includes(d))
  };
}

async function withBackup(primary, loc, radiusM, datasets) {
  try {
    return await primary();
  } catch (error) {
    const backup = await planningBackup(loc, radiusM, datasets).catch(() => null);
    if (backup) error.backup = backup;
    throw error;
  }
}

async function getRadon(loc) {
  const f = await arcgisQuery(API.radon, loc, 0, { outFields: "Description,CLASS_MAX,VERSION" });
  return f[0] ? f[0].attributes : null;
}

async function getCoal(loc) {
  const [highAtPoint, lowAtPoint, highNearby] = await Promise.all([
    arcgisQuery(API.coalHigh, loc, 0),
    arcgisQuery(API.coalLow, loc, 0),
    arcgisQuery(API.coalHigh, loc, loc.radius)
  ]);
  return { highAtPoint: highAtPoint.length > 0, lowAtPoint: lowAtPoint.length > 0, highNearby: highNearby.length > 0 };
}

// British Geological Survey hexagon overviews (Great Britain only; null in Northern Ireland).
// Shrink-swell clay: class 1 Low, 2 Moderate, 3 Significant; "localised" when parts of the hexagon are rated Significant.
async function getShrinkSwell(loc) {
  if (await inNI(loc)) return null;
  const f = await arcgisQuery(API.shrinkSwell, loc, 0, { outFields: "CLASS,Legend,Advisory" });
  if (!f[0]) return null;
  const a = f[0].attributes;
  return { level: Number(a.CLASS), localised: /localised significant/i.test(a.Advisory || "") };
}
// Mining other than coal (tin, lead, iron, salt and so on): Significant, Moderate, Low or NA (no known record).
async function getOtherMining(loc) {
  if (await inNI(loc)) return null;
  const f = await arcgisQuery(API.otherMining, loc, 0, { outFields: "Class,Legend" });
  return f[0] ? { level: f[0].attributes.Class, legend: f[0].attributes.Legend } : null;
}

// Noise periods used by Defra's 2022 noise maps.
const NOISE_PERIODS = [
  { key: "lday",   metric: "Lday",   name: "Daytime",         when: "7am to 7pm, includes the morning and evening rush hours" },
  { key: "leve",   metric: "Leve",   name: "Evening",         when: "7pm to 11pm" },
  { key: "lnight", metric: "Lnight", name: "Night",           when: "11pm to 7am" },
  { key: "lden",   metric: "Lden",   name: "24-hour average", when: "with extra weight for evening and night noise" }
];

// Read several map layers at the pin in one request. Values come back in layer order.
async function wmsValuesAt(service, layers, loc) {
  const features = await wmsInfo(service, layers.join(","), loc, 0.0005, { feature_count: layers.length });
  return layers.map((_, i) => features[i]?.properties?.GRAY_INDEX);
}

const roundNoise = v => Number.isFinite(v) && v > 0 ? Math.round(v) : null;

async function getRoadNoise(loc) {
  if (await inWales(loc)) return getWalesNoise(loc, "RD");
  if (await inScotland(loc)) return getScotlandNoise(loc, "Road");
  if (await inNI(loc)) return getNINoise(loc, "Roads");
  const values = await wmsValuesAt(API.roadNoise,
    NOISE_PERIODS.map(p => `Road_Noise_${p.metric}_England_Round_4_All`), loc);
  return Object.fromEntries(NOISE_PERIODS.map((p, i) => [p.key, roundNoise(values[i])]));
}

// Defra publishes 2022 rail noise split into 8 frequency bands. The overall level a
// person hears is the A-weighted sum of the bands (the same method gives Defra's
// published overall road figures to within 0.1 dB).
const BAND_A_WEIGHTING = { 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2, 1000: 0, 2000: 1.2, 4000: 1.0, 8000: -1.1 };

async function getRailNoise(loc) {
  if (await inWales(loc)) return getWalesNoise(loc, "RL");
  if (await inScotland(loc)) return getScotlandNoise(loc, "Rail");
  if (await inNI(loc)) return getNINoise(loc, "Railway");
  const bands = Object.keys(BAND_A_WEIGHTING);
  // Defra's rail service sometimes fails for one period in some places, so each
  // period is fetched on its own and a failure only affects that period.
  const results = await Promise.allSettled(NOISE_PERIODS.map(async p => {
    const values = await wmsValuesAt(API.railNoise,
      bands.map(b => `Rail_Noise_${p.metric}_England_Round_4_All_${b}Hz`), loc);
    const energy = values.reduce((sum, v, i) =>
      Number.isFinite(v) && v > 0 ? sum + Math.pow(10, (v + BAND_A_WEIGHTING[bands[i]]) / 10) : sum, 0);
    return energy > 0 ? Math.round(10 * Math.log10(energy)) : null;
  }));
  if (results.every(r => r.status === "rejected")) throw results[0].reason;
  const out = { unavailable: [] };
  NOISE_PERIODS.forEach((p, i) => {
    if (results[i].status === "fulfilled") out[p.key] = results[i].value;
    else { out[p.key] = null; out.unavailable.push(p.key); }
  });
  return out;
}

// Major airports in England. "zoneKm" is a cautious distance within which aircraft
// noise is often noticeable, depending on flight paths.
const AIRPORTS = [
  { name: "London Heathrow", lat: 51.4700, lon: -0.4543, zoneKm: 20, url: "https://www.heathrow.com" },
  { name: "London Gatwick", lat: 51.1537, lon: -0.1821, zoneKm: 15, url: "https://www.gatwickairport.com" },
  { name: "London Stansted", lat: 51.8860, lon: 0.2389, zoneKm: 15, url: "https://www.stanstedairport.com" },
  { name: "London Luton", lat: 51.8747, lon: -0.3683, zoneKm: 12, url: "https://www.london-luton.co.uk" },
  { name: "London City", lat: 51.5048, lon: 0.0495, zoneKm: 8, url: "https://www.londoncityairport.com" },
  { name: "London Southend", lat: 51.5714, lon: 0.6956, zoneKm: 8, url: "https://www.southendairport.com" },
  { name: "Manchester", lat: 53.3537, lon: -2.2750, zoneKm: 15, url: "https://www.manchesterairport.co.uk" },
  { name: "Birmingham", lat: 52.4539, lon: -1.7480, zoneKm: 12, url: "https://www.birminghamairport.co.uk" },
  { name: "Bristol", lat: 51.3827, lon: -2.7191, zoneKm: 10, url: "https://www.bristolairport.co.uk" },
  { name: "East Midlands", lat: 52.8311, lon: -1.3281, zoneKm: 12, url: "https://www.eastmidlandsairport.com" },
  { name: "Liverpool John Lennon", lat: 53.3336, lon: -2.8497, zoneKm: 8, url: "https://www.liverpoolairport.com" },
  { name: "Leeds Bradford", lat: 53.8659, lon: -1.6606, zoneKm: 8, url: "https://www.leedsbradfordairport.co.uk" },
  { name: "Newcastle", lat: 55.0375, lon: -1.6917, zoneKm: 8, url: "https://www.newcastleairport.com" },
  { name: "Southampton", lat: 50.9503, lon: -1.3568, zoneKm: 6, url: "https://www.southamptonairport.com" },
  { name: "Bournemouth", lat: 50.7800, lon: -1.8425, zoneKm: 6, url: "https://www.bournemouthairport.com" },
  { name: "Exeter", lat: 50.7344, lon: -3.4139, zoneKm: 6, url: "https://www.exeter-airport.co.uk" },
  { name: "Teesside International", lat: 54.5092, lon: -1.4294, zoneKm: 6, url: "https://www.teessideinternational.com" },
  { name: "Norwich", lat: 52.6758, lon: 1.2828, zoneKm: 6, url: "https://www.norwichairport.co.uk" },
  { name: "Cornwall Airport Newquay", lat: 50.4406, lon: -4.9954, zoneKm: 6, url: "https://www.cornwallairportnewquay.com" }
];

function nearestAirports(loc) {
  return AIRPORTS.map(a => ({ ...a, distanceKm: distanceKm(loc, a) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function getAirModel(loc) {
  // Open-Meteo sometimes hangs for about 12 seconds before failing, so give up
  // after 6 seconds and try again. Unix times keep the download about 30% smaller.
  const d = await fetchJSON(API.airModel + "?latitude=" + loc.lat + "&longitude=" + loc.lon +
    "&hourly=pm2_5,nitrogen_dioxide&past_days=92&forecast_days=0&timeformat=unixtime&timezone=Europe%2FLondon",
    { timeout: 6000 });
  const avg = arr => {
    const v = (arr || []).filter(Number.isFinite);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
  };
  const times = d.hourly?.time || [];
  const iso = t => t == null ? null : new Date(t * 1000).toISOString();
  return { pm25: avg(d.hourly?.pm2_5), no2: avg(d.hourly?.nitrogen_dioxide), from: iso(times[0]), to: iso(times[times.length - 1]) };
}

async function getLandfill(loc) {
  // The Environment Agency's landfill map covers England only (Wales: getCoalTips; Scotland: getWasteSites).
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return [];
  const sites = list => list.map(([props, geometry]) => {
    const c = geometryCentre(geometry);
    return { ...props, lat: c?.lat, lon: c?.lon, distanceKm: c ? distanceKm(loc, c) : null };
  }).filter(s => s.distanceKm == null || s.distanceKm <= loc.radius / 1000).sort(byDistance);
  try {
    const d = await fetchJSON(API.landfill + "?f=json&limit=100&bbox=" + boundingBox(loc.lat, loc.lon, loc.radius).join(","));
    return sites((d.features || []).map(f => [f.properties, f.geometry]));
  } catch (error) {
    // The map server is not answering: Defra's copy of the same register. Its answer travels with the failure
    // (error.backup), so only checkLanduse uses it and says where it came from. Its dates come as timestamps
    // (or numbers): kept as the live service gives them, YYYY-MM-DD.
    const date = v => v == null ? v : (typeof v === "number" ? new Date(v).toISOString() : String(v)).slice(0, 10);
    const copy = await arcgisQuery(API.landfillBackup, loc, loc.radius, { outFields: "*", returnGeometry: "true", outSR: "4326", resultRecordCount: "100" })
      .catch(() => null);
    if (copy) error.backup = { sites: sites(copy.map(f => [{ ...f.attributes, firstinput: date(f.attributes.firstinput), lastinput: date(f.attributes.lastinput) },
      { coordinates: f.geometry?.rings }])) };
    throw error;
  }
}

async function getLandslides(loc) {
  const f = await arcgisQuery(API.landslides, loc, loc.radius, {
    outFields: "LANDSLIDE_NAME,LOCALITY_DETAILS", returnGeometry: "true", outSR: "4326"
  });
  return f.map(x => {
    const p = x.geometry && Number.isFinite(x.geometry.y) ? { lat: x.geometry.y, lon: x.geometry.x } : null;
    return {
      name: x.attributes.LANDSLIDE_NAME || x.attributes.LOCALITY_DETAILS || "Recorded landslide",
      lat: p?.lat, lon: p?.lon, distanceKm: p ? distanceKm(loc, p) : null
    };
  }).sort(byDistance);
}

// England's coast: Environment Agency National Coastal Erosion Risk Map (NCERM 2024).
// Each area is land expected to be lost to the sea, with the shoreline plan in place and the
// sea level rise the Environment Agency advises planning for (the "70CC" layers).
// One request covers 1 km around the pin; a second, small one is made only if the pin is
// inside the area expected to be lost by 2105. Inland, nothing is found.
const COAST_NEAR_M = 1000;

function pointInRings(pt, rings) {
  let inside = false;
  rings.forEach(ring => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt.lat) !== (yj > pt.lat) && pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi) inside = !inside;
    }
  });
  return inside;
}

function geometryHas(geometry, pt) {
  if (!geometry) return false;
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polys.some(rings => pointInRings(pt, rings));
}

// Shortest distance from the pin to the edge of an area, in km.
function distanceToGeometryKm(geometry, pt) {
  const kx = 111.32 * Math.cos(pt.lat * Math.PI / 180), ky = 110.54;
  let best = Infinity;
  (function walk(c) {
    if (typeof c[0][0] === "number") {
      for (let i = 1; i < c.length; i++) {
        const ax = (c[i - 1][0] - pt.lon) * kx, ay = (c[i - 1][1] - pt.lat) * ky;
        const bx = (c[i][0] - pt.lon) * kx, by = (c[i][1] - pt.lat) * ky;
        const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    } else c.forEach(walk);
  })(geometry.coordinates || []);
  return best;
}

// Past floods (2.1.0): areas recorded as flooded, at the pin or within PAST_FLOOD_M of it. England: Defra's copy of the
// Environment Agency Historic Flood Map (areas only, no dates): one count within 250 m, and one at the pin only when
// something is near. Wales: Natural Resources Wales' Historic Flood Map on DataMapWales (each flood with its dates,
// source and cause). Scotland and Northern Ireland publish no such record: the topic is not shown there (ONLY_IN).
const PAST_FLOOD_M = 250;
async function getPastFloods(loc) {
  if (await inScotland(loc) || await inNI(loc)) return null;
  if (await inWales(loc)) {
    const fields = ["name", "start_date", "end_date", "flood_source", "flood_cause"];
    const features = await wfsFeatures(API.dataMapWales, "inspire-nrw:NRW_HISTORIC_FLOODMAP", loc, PAST_FLOOD_M, { count: 100, srsName: "EPSG:4326" });
    const floods = withDistance(features, loc).filter(x => x.km <= PAST_FLOOD_M / 1000)
      .map(({ f, km }) => ({ km, ...Object.fromEntries(fields.map(k => [k, (f.properties || {})[k] || null])) }))
      .sort((a, b) => a.km - b.km || String(b.start_date).localeCompare(String(a.start_date)));
    return { country: "Wales", inside: floods.some(x => x.km === 0), near: floods.length > 0, floods };
  }
  const count = async m => (await arcgisRequest(API.pastFloods, loc, m, { returnCountOnly: "true" })).count || 0;
  const near = await count(PAST_FLOOD_M) > 0;
  return { country: "England", near, inside: near && await count(0) > 0, floods: [] };
}

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

async function getCrime(loc) {
  if (await inScotland(loc)) return null;   // Police Scotland publishes no street-level data (Scotland: getSimdCrime)
  const items = await fetchJSON(API.crime + "?lat=" + loc.lat + "&lng=" + loc.lon);
  const byType = {};
  items.forEach(c => { byType[c.category] = (byType[c.category] || 0) + 1; });
  // Some police forces publish nothing for months (Greater Manchester Police since March 2025), which makes
  // their area look almost crime-free. When the count is tiny, find the force so the report can name it.
  let force = null;
  if (items.length <= 5) {
    try {
      const hood = await fetchJSON(API.police + "locate-neighbourhood?q=" + loc.lat + "," + loc.lon);
      if (hood && hood.force) {
        const f = await fetchJSON(API.police + "forces/" + encodeURIComponent(hood.force));
        force = { id: hood.force, name: f.name || hood.force, url: (f.url || "").replace(/^http:/, "https:") };
      }
    } catch (e) { /* the force is only needed for the explanation */ }
  }
  return { total: items.length, month: items[0]?.month || null, byType, force };
}

// True when the police data for this place looks missing rather than low: almost nothing within a mile
// and almost nothing in the whole census neighbourhood (thousands of residents). Genuinely quiet rural
// places still show some crimes in one of the two (checked against Northumberland, Dartmoor, Kielder,
// the Isles of Scilly and the Lake District in November 2026).
function policeDataMissing(crime, area) {
  return !!area && crime.total <= 5 && area.total <= 2;
}

// Recent home sales near the pin, from HM Land Registry Price Paid Data (England and Wales).
// The data has no map positions, so we ask postcodes.io for the postcodes within SOLD_RADIUS_M,
// then ask Land Registry for standard sales of houses and flats in those postcodes.
const SOLD_RADIUS_M = 500, SOLD_YEARS = 3;
const SOLD_TYPES = { detached: "Detached", "semi-detached": "Semi-detached", terraced: "Terraced", "flat-maisonette": "Flat" };

async function getSoldPrices(loc) {
  const near = await fetchJSON(API.postcodes + "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=" + SOLD_RADIUS_M + "&limit=100");
  const postcodes = (near.result || []).map(r => r.postcode).filter(pc => /^[A-Z0-9 ]+$/.test(pc || ""));
  if (!postcodes.length) return { postcodes: 0, sales: [] };
  const since = new Date();
  since.setFullYear(since.getFullYear() - SOLD_YEARS);
  const query = `PREFIX ppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrc: <http://landregistry.data.gov.uk/def/common/>
    SELECT ?price ?date ?type ?newBuild ?street WHERE {
      VALUES ?pc { ${postcodes.map(pc => `"${pc}"`).join(" ")} }
      ?address lrc:postcode ?pc .
      ?sale ppi:propertyAddress ?address ; ppi:pricePaid ?price ; ppi:transactionDate ?date ;
        ppi:propertyType ?type ; ppi:transactionCategory ppi:standardPricePaidTransaction .
      OPTIONAL { ?sale ppi:newBuild ?newBuild }
      OPTIONAL { ?address lrc:street ?street }
      FILTER(?date >= "${since.toISOString().slice(0, 10)}"^^<http://www.w3.org/2001/XMLSchema#date>)
    } ORDER BY DESC(?date) LIMIT 1000`;
  const d = await fetchJSON(API.landRegistry + "?query=" + encodeURIComponent(query));
  const sales = (d.results?.bindings || []).map(b => ({
    price: Number(b.price.value), date: b.date.value,
    type: b.type.value.split("/").pop(), newBuild: b.newBuild?.value === "true",
    street: b.street?.value || ""
  })).filter(x => SOLD_TYPES[x.type] && x.price > 0);
  return { postcodes: postcodes.length, sales };
}

/* ---------------------------------------------------------------
   Wales: DataMapWales (Welsh Government, Natural Resources Wales and Cadw), for the topics whose
   England data stops at the border. Outside Wales these return null without asking DataMapWales.
--------------------------------------------------------------- */
// A point well outside Wales answers at once, without waiting for the postcode lookup. If the lookup fails,
// the England data is used, so a postcodes.io fault never stops the England topics.
const WALES_BOX = { south: 51.3, north: 53.5, west: -5.4, east: -2.6 };
const SCOTLAND_BOX = { south: 54.6, north: 61, west: -9, east: -0.7 };
async function inCountry(loc, country, box) {
  if (loc.lat < box.south || loc.lat > box.north || loc.lon < box.west || loc.lon > box.east) return false;
  try {
    const place = await getPlace(loc);
    return !!place && place.country === country;
  } catch (e) { return false; }
}
const inWales = loc => inCountry(loc, "Wales", WALES_BOX);
const inScotland = loc => inCountry(loc, "Scotland", SCOTLAND_BOX);
const NI_BOX = { south: 53.9, north: 55.5, west: -8.3, east: -5.3 };
const inNI = loc => inCountry(loc, "Northern Ireland", NI_BOX);

// Ask a WFS map layer (GeoServer) for the features in a square around the pin
// (the same square as boundingBox, written latitude first as WFS 2.0 expects for EPSG:4326).
async function wfsFeatures(service, layer, loc, metres, extra = {}) {
  const [west, south, east, north] = boundingBox(loc.lat, loc.lon, metres);
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: layer, count: 50,
    bbox: [south, west, north, east, "urn:ogc:def:crs:EPSG::4326"].join(","), outputFormat: "application/json", ...extra
  });
  return (await fetchJSON(service + "?" + params)).features || [];
}
// Areas sorted by distance from the pin (0 inside).
const withDistance = (features, loc) => features
  .map(f => ({ f, km: geometryHas(f.geometry, loc) ? 0 : distanceToGeometryKm(f.geometry, loc) }))
  .sort((a, b) => a.km - b.km);

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

/* ---------------------------------------------------------------
   Scotland: Historic Environment Scotland, NatureScot, SEPA, the Scottish Government and the Scottish Air
   Quality database, for the topics whose England data stops at the border. Outside Scotland these return
   null without asking the Scottish services.
--------------------------------------------------------------- */
// Historic Environment Scotland layers to test at the pin. Each map service has one layer (0).
const SCOT_HES_AT = {
  conservation: "Conservation_Areas", monument: "Scheduled_Monuments", park: "Gardens_and_Designed_Landscapes",
  battlefield: "Battlefields_Inventory_Boundary", heritage: "World_Heritage_Sites"
};
const hesRequest = (service, loc, metres, extra) => arcgisRequest(API.hes + service + "/MapServer/0/query", loc, metres, extra);
// NatureScot protected sites near the pin (every layer names its sites in NAME).
const SCOT_NATURE = [
  ["protectedareas:sssi", "Site of Special Scientific Interest"],
  ["protectedareas:sac", "Special Area of Conservation"],
  ["protectedareas:spa", "Special Protection Area (birds)"],
  ["protectedareas:ramsar", "Ramsar wetland"],
  ["protectedareas:nnr", "National Nature Reserve"],
  ["protectedareas:lnr", "Local Nature Reserve"]
];
// Scotland's Ancient Woodland Inventory also lists younger woods: 1a and 2a are ancient; 1b, 2b and 3 are not.
const SCOT_ANCIENT_WOOD = ["1a", "2a"];
const SCOT_AQMA = "scotarc:scottland_aqma_3857";
// Many Scottish records are in capitals: "OLD TOWN" -> "Old Town" (small joining words kept small).
const tidyCaps = text => { const t = tidy(text); return /[a-z]/.test(t) ? t : titleCase(t).replace(/(?!^)\b(And|Of|The|In|On)\b/g, w => w.toLowerCase()); };
const PIN_M = 5;   // "at the pin": a square about 10 m across

// Returned in the same shape as getWalesSites, so the planning, nature and air checks read the same.
async function getScotlandSites(loc) {
  if (!(await inScotland(loc))) return null;
  const titles = d => [...new Set((d.features || []).map(f => tidyCaps(f.attributes?.DES_TITLE).replace(/ Boundary$/, "")).filter(Boolean))];
  const named = (features, field) => [...new Set(features.map(f => tidy(f.properties?.[field] ?? f.attributes?.[field])).filter(Boolean))];
  const [hesAt, parks, landscapes, nature, woods, sssi, listedCount, listedHere, aqma, aqmaNear] = await Promise.all([
    Promise.all(Object.values(SCOT_HES_AT).map(service => hesRequest(service, loc, 0, { outFields: "DES_TITLE" }).then(titles))),
    Promise.all([0, 1].map(i => arcgisQuery(API.scotProtected + i + "/query", loc, 0, { outFields: "npname" })))
      .then(lists => named(lists.flat(), "npname")),
    arcgisQuery(API.scotProtected + "3/query", loc, 0, { outFields: "nsaname" }).then(f => named(f, "nsaname")),
    Promise.all(SCOT_NATURE.map(([layer, kind]) => wfsFeatures(API.natureScot, layer, loc, loc.radius, { propertyName: "NAME" })
      .then(list => list.map(f => ({ kind, name: tidy(f.properties?.NAME) }))))).then(lists => lists.flat()),
    wfsFeatures(API.natureScot, "habitatsandspecies:awi", loc, loc.radius, { propertyName: "ANTIQ_CODE", count: 500 })
      .then(list => list.filter(f => SCOT_ANCIENT_WOOD.includes(tidy(f.properties?.ANTIQ_CODE)))
        .map(() => ({ kind: "Ancient woodland", name: "" }))),
    wfsFeatures(API.natureScot, "protectedareas:sssi", loc, PIN_M, { propertyName: "NAME" }).then(f => named(f, "NAME")),
    hesRequest("Listed_Buildings", loc, LISTED_NEAR_M, { returnCountOnly: "true" }).then(d => d.count || 0),
    hesRequest("Listed_Buildings", loc, LISTED_HERE_M, { outFields: "DES_TITLE,CATEGORY" })
      .then(d => (d.features || []).map(f => ({ name: tidyCaps(f.attributes?.DES_TITLE), rank: f.attributes?.CATEGORY ? "Category " + tidy(f.attributes.CATEGORY) : "" }))),
    wfsFeatures(API.scotAir, SCOT_AQMA, loc, PIN_M, { propertyName: "title" }).then(f => named(f, "title")),
    wfsFeatures(API.scotAir, SCOT_AQMA, loc, loc.radius, { propertyName: "title" }).then(f => named(f, "title"))
  ]);
  const at = Object.fromEntries(Object.keys(SCOT_HES_AT).map((key, i) => [key, hesAt[i]]));
  return {
    country: "Scotland", ...at, nationalPark: parks, landscape: landscapes, aqma, sssi,
    nature: [...nature, ...woods], aqmaNear,
    listedNear: listedCount, listedNearCapped: false, listedHere
  };
}

// Scottish Government strategic noise maps (2021 traffic, published by SEPA): "Road" or "Rail", all sources.
// Like Wales, Scotland publishes a 16-hour daytime level. Outside the mapped area the value is 0 or "NoData".
async function getScotlandNoise(loc, source) {
  const geometry = JSON.stringify({ x: loc.lon, y: loc.lat, spatialReference: { wkid: 4326 } });
  const values = await Promise.all(NOISE_PERIODS_16H.map(p => fetchJSON(`${API.sepaNoise}Noise_${source}_${p.metric}_ALL/ImageServer/identify?` +
    new URLSearchParams({ geometry, geometryType: "esriGeometryPoint", returnGeometry: "false", returnCatalogItems: "false", f: "json" }))
    .then(d => { if (d.error) throw new Error(d.error.message || "query failed"); return Number(d.value); })));
  return { scotland: true, ...Object.fromEntries(NOISE_PERIODS_16H.map((p, i) => [p.key, roundNoise(values[i])])) };
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

// SEPA licensed waste sites (landfill, transfer stations, scrapyards, recycling centres) near the pin.
// "KE - Transfer Station; TR - Transfer Station" -> ["Transfer Station"].
const wasteKinds = text => [...new Set(String(text || "").split(";")
  .map(part => tidy(part.replace(/^\s*[A-Z]{2,3}\s*[-:]\s*/, "").replace(/^Waste\s*-\s*/i, "")))
  .filter(Boolean))];
async function getWasteSites(loc) {
  if (!(await inScotland(loc))) return null;
  const features = await arcgisQuery(API.sepaWaste, loc, loc.radius, {
    outFields: "authorisation_activity,authorisation_description,authorisation_holder", returnGeometry: "true", outSR: "4326"
  });
  return features
    .map(f => {
      const a = f.attributes || {}, g = f.geometry || {};
      const kinds = wasteKinds(a.authorisation_activity);
      const where = tidy(String(a.authorisation_description || "").split(" --- ").pop());
      return { name: tidyCaps(where || a.authorisation_holder).replace(/\.$/, ""), kinds, landfill: kinds.some(k => /landfill/i.test(k)),
        mobile: /mobile plant/i.test(a.authorisation_description || ""),
        lat: g.y, lon: g.x, distanceKm: Number.isFinite(g.y) ? distanceKm(loc, { lat: g.y, lon: g.x }) : null };
    })
    .filter(s => !s.mobile)     // permits for mobile machines, not places
    .sort(byDistance);
}

// Crime in Scotland: the crime part of the Scottish Index of Multiple Deprivation 2020, for the data zone
// (a small area of about 500 to 1,000 people) at the pin. Police Scotland publishes no street-level data.
const SIMD_ZONES = 6976;
async function getSimdCrime(loc) {
  if (!(await inScotland(loc))) return null;
  const f = await arcgisQuery(API.simd, loc, 0, { outFields: "datazone,dzname,laname,crimecount,crimerate,crimerank" });
  const a = f[0] && f[0].attributes;
  if (!a || !Number.isFinite(a.crimerank)) return null;
  return { zone: a.datazone, name: tidy(a.dzname), council: tidy(a.laname), count: a.crimecount, rate: a.crimerate, rank: a.crimerank };
}

/* ---------------------------------------------------------------
   Northern Ireland: the Department for Communities' Historic Environment Division (listed buildings, scheduled
   monuments, historic parks, battle sites) and DAERA (protected areas, noise maps, the coastal erosion study).
   Outside Northern Ireland these return null without asking them.
--------------------------------------------------------------- */
const niHeritage = (layer, loc, metres, extra) => arcgisRequest(API.niHeritage + layer + "/query", loc, metres, extra);
const niProtected = (layer, loc, metres, field) => arcgisQuery(API.niProtected + layer + "/query", loc, metres, { outFields: field });
// Listed grades (A, B+, B1, B2, B); the record also holds delisted and "record only" buildings, which are left out.
const NI_LISTED = "CurrentGra IN ('A','B+','B1','B2','B')";
// DAERA protected area layers near the pin (every one names its sites in NAME).
const NI_NATURE = [
  [1, "Area of Special Scientific Interest"], [5, "Special Area of Conservation"], [6, "Special Protection Area (birds)"],
  [4, "Ramsar wetland"], [3, "Nature Reserve"]
];

// Returned in the same shape as getWalesSites, so the planning and nature checks read the same.
async function getNISites(loc) {
  if (!(await inNI(loc))) return null;
  const named = (features, field) => [...new Set(features.map(f => tidy(f.attributes?.[field])).filter(Boolean))];
  const [parks, battles, zones, listedCount, listedHere, landscape, heritage, assi, nature] = await Promise.all([
    niHeritage(9, loc, 0, { outFields: "SITE" }).then(d => named(d.features || [], "SITE")),
    niHeritage(8, loc, 0, { outFields: "BATTLE" }).then(d => named(d.features || [], "BATTLE")),
    niHeritage(10, loc, 0, { outFields: "EDITED_TYP,TOWNLAND" })
      .then(d => [...new Set((d.features || []).map(f => [tidyCaps(f.attributes?.EDITED_TYP), tidyCaps(f.attributes?.TOWNLAND)].filter(Boolean).join(", ")).filter(Boolean))]),
    niHeritage(1, loc, LISTED_NEAR_M, { where: NI_LISTED, returnCountOnly: "true" }).then(d => d.count || 0),
    niHeritage(1, loc, LISTED_HERE_M, { where: NI_LISTED, outFields: "Address,CurrentGra" })
      .then(d => (d.features || []).map(f => ({ name: tidy(String(f.attributes?.Address || "").split("\n")[0]), rank: f.attributes?.CurrentGra ? "Grade " + tidy(f.attributes.CurrentGra) : "" }))),
    niProtected(2, loc, 0, "NAME").then(f => named(f, "NAME")),
    niProtected(7, loc, 0, "Name_WHS").then(f => named(f, "Name_WHS")),
    niProtected(1, loc, 0, "NAME").then(f => named(f, "NAME")),
    Promise.all(NI_NATURE.map(([layer, kind]) => niProtected(layer, loc, loc.radius, "NAME")
      .then(list => list.map(f => ({ kind, name: tidy(f.attributes?.NAME) }))))).then(lists => lists.flat())
  ]);
  return {
    country: "Northern Ireland", conservationUnknown: true,
    conservation: [], monument: zones, park: parks, battlefield: battles, heritage, nationalPark: [], landscape,
    aqma: [], aqmaNear: [], sssi: assi, nature, listedNear: listedCount, listedNearCapped: false, listedHere
  };
}

// DAERA strategic noise maps (Round 4, 2021 traffic): Belfast ("Agglomeration") and major roads and railways
// elsewhere ("Major"). Layers: 0 Lden, 1 Lnight, 2 LAeq 16h (7am to 11pm). Where both are mapped, the louder counts.
const NI_NOISE_LAYER = { l16h: 2, lnight: 1, lden: 0 };
async function getNINoise(loc, source) {   // source: "Roads" or "Railway"
  const ask = area => fetchJSON(`${API.niNoise}${area}_${source}/MapServer/identify?` + new URLSearchParams({
    geometry: loc.lon + "," + loc.lat, geometryType: "esriGeometryPoint", sr: "4326", layers: "all:0,1,2", tolerance: "0",
    mapExtent: [loc.lon - 0.01, loc.lat - 0.01, loc.lon + 0.01, loc.lat + 0.01].join(","), imageDisplay: "200,200,96",
    returnGeometry: "false", f: "json"
  })).then(d => {
    if (d.error) throw new Error(d.error.message || "query failed");
    return Object.fromEntries((d.results || []).map(r => [r.layerId, Number(r.attributes?.["Classify.Pixel Value"])]));
  });
  const [city, major] = await Promise.all([ask("Agglomeration"), ask("Major")]);
  const pick = id => roundNoise(Math.max(...[city[id], major[id]].filter(Number.isFinite), 0));
  return { ni: true, ...Object.fromEntries(Object.entries(NI_NOISE_LAYER).map(([key, id]) => [key, pick(id)])) };
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

// Each data task: key, topic name, fetch function, and the service it waits for (named in the
// "Still waiting for" note when a report is slow). Tasks start in this order. The Environment Agency
// server answers only a few requests at a time (PACED_HOSTS), so its most important topic,
// flooding from heavy rain, is listed first and road and rail noise last.
const TASKS = [
  ["place", "Nearest postcode and council", getPlace, "postcodes.io"],
  ["surfaceWater", "Flooding from heavy rain", getSurfaceWater, "Environment Agency"],
  ["pastFloods", "Past floods recorded", getPastFloods, "Environment Agency via Defra (Wales: DataMapWales)"],
  ["landfill", "Old landfill sites", getLandfill, "Environment Agency"],
  ["coastal", "Coastal erosion", getCoastalErosion, "Environment Agency (Wales: DataMapWales; Scotland: NatureScot; NI: DAERA)"],
  ["planningPoint", "Flood zone and planning rules at the property", getPlanningAtPoint, "planning.data.gov.uk"],
  ["planningNearby", "Things nearby: flood zones, contaminated land, heritage, nature", getPlanningNearby, "planning.data.gov.uk"],
  ["radon", "Radon gas", getRadon, "British Geological Survey"],
  ["coal", "Coal mining", getCoal, "Mining Remediation Authority"],
  ["air", "Air quality", getAirModel, "Open-Meteo"],
  ["landslides", "Landslides", getLandslides, "British Geological Survey"],
  ["shrinkSwell", "Shrinking and swelling clay", getShrinkSwell, "British Geological Survey"],
  ["otherMining", "Mining other than coal", getOtherMining, "British Geological Survey"],
  ["crime", "Reported crime", getCrime, "data.police.uk"],
  ["soldPrices", "Recent sale prices nearby", getSoldPrices, "HM Land Registry"],
  ["floodNational", "Scotland and Wales flood maps", getFloodNational, "SEPA and Natural Resources Wales"],
  ["amenities", "Schools, doctors and transport", getAmenities, "NHS and planning.data.gov.uk"],
  ["crimeArea", "Crime compared with England and Wales", getCrimeArea, "Office for National Statistics"],
  ["noise", "Road noise", getRoadNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"],
  ["railNoise", "Railway noise", getRailNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"],
  ["walesSites", "Heritage, nature and air hotspots in Wales", getWalesSites, "DataMapWales"],
  ["coalTips", "Disused coal tips in Wales", getCoalTips, "DataMapWales"],
  ["scotlandSites", "Heritage, nature and air hotspots in Scotland", getScotlandSites, "Historic Environment Scotland and NatureScot"],
  ["wasteSites", "Licensed waste sites in Scotland", getWasteSites, "SEPA"],
  ["simdCrime", "Crime rank in Scotland", getSimdCrime, "Scottish Government"],
  ["niSites", "Heritage and nature in Northern Ireland", getNISites, "Department for Communities and DAERA"]
];
