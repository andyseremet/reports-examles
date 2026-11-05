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
    const promise = fetchJSON(API.postcodes + "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=2000&limit=1")
      .then(d => (d.result && d.result[0]) || null);
    promise.catch(() => placeCache.delete(key));   // try again next time if it failed
    placeCache.set(key, promise);
  }
  return placeCache.get(key);
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
const AMENITY_TYPES = [
  { key: "school", label: "School", short: "school", within: 1 },
  { key: "gp", label: "GP surgery", short: "GP", within: 2 },
  { key: "pharmacy", label: "Pharmacy", short: "pharmacy", within: 2 },
  { key: "station", label: "Railway station", short: "station", within: 3 },
  { key: "tram", label: "Tram, metro or underground stop", short: "tram or underground", within: 1 },
  { key: "bus_stop", label: "Bus stop", short: "bus stop", within: 0.5 }
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
  return planningEntities({ latitude: loc.lat, longitude: loc.lon, limit: 200, exclude_field: "geometry" }, PLANNING_AT_POINT);
}

async function getPlanningNearby(loc) {
  return (await planningEntities(inCircle(loc, loc.radius), PLANNING_NEARBY)).map(e => ({ ...e, ...pointFrom(loc, e.point) }));
}

// Protected trees (Tree Preservation Orders) and Article 4 directions, from planning.data.gov.uk.
// Councils publish these themselves and many have not yet, so this also finds the council for the pin
// and counts what it has published. "None found" is only a result where the council publishes the data.
const TREE_NEAR_M = 50;
// Planning authority code -> council organisation number and name, loaded once per visit.
const getCouncilOrgs = once(async () => {
  const list = await planningEntities({ limit: 500 }, ["local-authority", "national-park-authority", "development-corporation"],
    ["entity", "name", "local-planning-authority", "end-date"]);
  return Object.fromEntries(list.filter(o => o["local-planning-authority"] && !o["end-date"])
    .map(o => [o["local-planning-authority"], { entity: o.entity, name: o.name }]));
});

async function countPublished(dataset, org) {
  return (await planningQuery({ dataset, organisation_entity: org, limit: 1, field: "entity" })).count || 0;
}

async function getProtectedTrees(loc) {
  const [near, lpas, orgs] = await Promise.all([
    planningEntities(inCircle(loc, TREE_NEAR_M, 200), ["tree", "tree-preservation-zone"]),
    planningEntities({ latitude: loc.lat, longitude: loc.lon, exclude_field: "geometry" }, ["local-planning-authority"]),
    getCouncilOrgs()
  ]);
  const nearby = near.map(e =>
    ({ dataset: e.dataset, name: e.name, order: e["tree-preservation-order"] || "", distanceKm: pointFrom(loc, e.point).distanceKm }));
  const lpa = lpas[0];
  const org = lpa && orgs[lpa.reference];
  let published = null;   // null: we could not tell which council publishes for this place
  if (org) {
    const [trees, zones, article4] = await Promise.all(
      ["tree", "tree-preservation-zone", "article-4-direction-area"].map(d => countPublished(d, org.entity)));
    published = { trees: trees + zones, article4 };
  }
  return { nearby, council: org ? org.name : (lpa ? lpa.name : ""), published };
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
  const values = await wmsValuesAt(API.roadNoise,
    NOISE_PERIODS.map(p => `Road_Noise_${p.metric}_England_Round_4_All`), loc);
  return Object.fromEntries(NOISE_PERIODS.map((p, i) => [p.key, roundNoise(values[i])]));
}

// Defra publishes 2022 rail noise split into 8 frequency bands. The overall level a
// person hears is the A-weighted sum of the bands (the same method gives Defra's
// published overall road figures to within 0.1 dB).
const BAND_A_WEIGHTING = { 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2, 1000: 0, 2000: 1.2, 4000: 1.0, 8000: -1.1 };

async function getRailNoise(loc) {
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
  const d = await fetchJSON(API.landfill + "?f=json&limit=100&bbox=" + boundingBox(loc.lat, loc.lon, loc.radius).join(","));
  return (d.features || [])
    .map(f => {
      const c = geometryCentre(f.geometry);
      return { ...f.properties, lat: c?.lat, lon: c?.lon, distanceKm: c ? distanceKm(loc, c) : null };
    })
    .filter(s => s.distanceKm == null || s.distanceKm <= loc.radius / 1000)
    .sort(byDistance);
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

async function getCoastalErosion(loc) {
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

const TASKS = [
  ["place", "Nearest postcode and council", getPlace],
  ["planningPoint", "Flood zone and planning rules at the property", getPlanningAtPoint],
  ["planningNearby", "Things nearby: flood zones, contaminated land, heritage, nature", getPlanningNearby],
  ["radon", "Radon gas", getRadon],
  ["coal", "Coal mining", getCoal],
  ["noise", "Road noise (day, evening, night)", getRoadNoise],
  ["railNoise", "Railway noise (day, evening, night)", getRailNoise],
  ["air", "Air quality", getAirModel],
  ["landfill", "Old landfill sites", getLandfill],
  ["landslides", "Landslides", getLandslides],
  ["coastal", "Coastal erosion", getCoastalErosion],
  ["crime", "Reported crime", getCrime],
  ["soldPrices", "Recent sale prices nearby", getSoldPrices],
  ["surfaceWater", "Flooding from heavy rain", getSurfaceWater],
  ["floodNational", "Scotland and Wales flood maps", getFloodNational],
  ["amenities", "Schools, doctors and transport", getAmenities],
  ["trees", "Protected trees and Article 4 areas", getProtectedTrees],
  ["crimeArea", "Crime compared with England and Wales", getCrimeArea]
];
