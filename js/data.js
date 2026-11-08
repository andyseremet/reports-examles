// Property Location Check – fetching data for England and the shared fetch helpers.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { boundingBox, circleWkt, PLANNING_AT_POINT, PLANNING_NEARBY, pointFrom } from "./core.js";
import { API, arcgisRequest, fetchJSON } from "./api.js";
import { withBackup } from "./backups.js";

/* =========================================================
   DATA RETRIEVAL
========================================================= */

const placeCache = new Map();
function getPlace(loc) {
  const key = Number(loc.lat).toFixed(5) + "," + Number(loc.lon).toFixed(5);
  if (!placeCache.has(key)) {
    // postcodes.io first; if it does not answer, OpenStreetMap's reverse lookup gives the country and council.
    const promise = fetchJSON(API.postcodes + "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=2000&limit=1")
      // No postcode within 2 km (remote places, the sea): OpenStreetMap may still know the country (code review, 2.3.3).
      .then(d => (d.result && d.result[0]) || placeFromOsm(loc).catch(() => null), () => placeFromOsm(loc));
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

const titleCase = text => String(text || "").toLowerCase()
  .replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Pms|Nhs|Gp|Uk)\b/g, w => w.toUpperCase());

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

function getPlanningAtPoint(loc) {
  return withBackup(() => planningEntities({ latitude: loc.lat, longitude: loc.lon, limit: 200, exclude_field: "geometry" }, PLANNING_AT_POINT),
    loc, 0, PLANNING_AT_POINT);
}

async function getPlanningNearby(loc) {
  return withBackup(async () => (await planningEntities(inCircle(loc, loc.radius), PLANNING_NEARBY)).map(e => ({ ...e, ...pointFrom(loc, e.point) })),
    loc, loc.radius, PLANNING_NEARBY);
}

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

// Shortest distance from the pin to the edge of an area (or to a point), in km. A shape with no usable coordinates is
// "Infinity" (never near), so one odd record never fails the whole topic (code review, 2.3.3).
function distanceToGeometryKm(geometry, pt) {
  const kx = 111.32 * Math.cos(pt.lat * Math.PI / 180), ky = 110.54;
  const toPoint = c => Math.hypot((c[0] - pt.lon) * kx, (c[1] - pt.lat) * ky);
  let best = Infinity;
  (function walk(c) {
    if (!Array.isArray(c) || !c.length) return;
    if (typeof c[0] === "number") { best = Math.min(best, toPoint(c)); return; }   // a single point
    if (Array.isArray(c[0]) && typeof c[0][0] === "number") {
      if (c.length === 1) best = Math.min(best, toPoint(c[0]));
      for (let i = 1; i < c.length; i++) {
        const ax = (c[i - 1][0] - pt.lon) * kx, ay = (c[i - 1][1] - pt.lat) * ky;
        const bx = (c[i][0] - pt.lon) * kx, by = (c[i][1] - pt.lat) * ky;
        const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    } else c.forEach(walk);
  })(geometry && geometry.coordinates);
  return best;
}

// A point well outside Wales answers at once, without waiting for the postcode lookup. Inside a country's box (which
// also takes in parts of its neighbours), a place whose country cannot be found fails the topic ("could not be
// checked"): England data for a Welsh or Scottish pin would give empty answers read as "No issue found" (2.3.3).
const WALES_BOX = { south: 51.3, north: 53.5, west: -5.4, east: -2.6 };
const SCOTLAND_BOX = { south: 54.6, north: 61, west: -9, east: -0.7 };
async function inCountry(loc, country, box) {
  if (loc.lat < box.south || loc.lat > box.north || loc.lon < box.west || loc.lon > box.east) return false;
  let place;
  try { place = await getPlace(loc); } catch (e) { place = null; }
  if (!place || !place.country) throw new Error("the country of this place could not be found right now");
  return place.country === country;
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

export { distanceToGeometryKm, geometryHas, getFloodNational, getPlace, getPlanningAtPoint, getPlanningNearby,
  inCircle, inNI, inScotland, inWales, placeFromOsm, planningEntities, titleCase, wfsFeatures, withDistance,
  wmsFeaturesAt, wmsInfo };
