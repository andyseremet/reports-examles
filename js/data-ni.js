"use strict";
// Property Location Check – fetching data for Northern Ireland.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

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
