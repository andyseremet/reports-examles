// Property Location Check – fetching data for Northern Ireland.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { API, arcgisQuery, arcgisRequest } from "./api.js";
import { inNI } from "./data.js";
import { LISTED_HERE_M, LISTED_NEAR_M, tidy } from "./data-wales.js";
import { tidyCaps } from "./data-scotland.js";

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

export { getNISites };
