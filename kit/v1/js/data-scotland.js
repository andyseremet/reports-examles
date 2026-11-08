// Property Location Check – fetching data for Scotland.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { API, arcgisQuery, arcgisRequest } from "./api.js";
import { inScotland, titleCase, wfsFeatures } from "./data.js";
import { LISTED_HERE_M, LISTED_NEAR_M, tidy } from "./data-wales.js";

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

export { getScotlandSites, tidyCaps };
