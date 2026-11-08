"use strict";
// Property Location Check – fetching data for Scotland.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

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
