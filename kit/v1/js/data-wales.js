// Property Location Check – fetching data for Wales (DataMapWales).
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { distanceKm, geometryCentre } from "./core.js";
import { API, fetchJSON } from "./api.js";
import { inWales, wfsFeatures, wmsInfo } from "./data.js";

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

export { getWalesSites, LISTED_HERE_M, LISTED_NEAR_M, tidy };
