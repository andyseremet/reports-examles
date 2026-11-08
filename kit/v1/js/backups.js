// Property Location Check – backups used only when planning.data.gov.uk does not answer.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { distanceKm } from "./core.js";
import { API, arcgisQuery, arcgisRequest } from "./api.js";
import { inNI, inScotland, inWales } from "./data.js";

// When planning.data.gov.uk does not answer (England only), heritage and nature are asked from the original publishers:
// Historic England (National Heritage List for England, and its conservation areas map) and Natural England, and flood
// zones (at the pin and nearby) from Defra's copy of the Environment Agency Flood Map for Planning on ArcGIS Online
// (2.3.2; before, one request to the Environment Agency map server). Nothing is asked from
// them otherwise. Main rivers, air quality areas, Green Belt, HS2, contaminated land
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

// Flood Zones 3 and 2 at the pin (radius 0; none means Zone 1) or within the radius, in planning.data.gov.uk's shape.
async function floodZoneBackup(loc, radiusM) {
  const found = await Promise.all([[3, 1], [2, 2]].map(async ([level, layer]) =>
    (await arcgisRequest(`${API.floodZones}/${layer}/query`, loc, radiusM, { returnCountOnly: "true" })).count > 0 ? level : null));
  return found.filter(Boolean).map(level => ({ dataset: "flood-risk-zone", name: "Flood Zone " + level, "flood-risk-level": String(level) }));
}

async function planningBackup(loc, radiusM, datasets) {
  if (await inWales(loc) || await inScotland(loc) || await inNI(loc)) return null;
  const wanted = [...datasets.filter(d => BACKUP_LAYERS[d]), ...(datasets.includes("flood-risk-zone") ? ["flood-risk-zone"] : [])];
  const answers = await Promise.allSettled(wanted.map(async d => {
    if (d === "flood-risk-zone") return floodZoneBackup(loc, radiusM);
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
  const publisher = d => d === "flood-risk-zone" ? "the Environment Agency (Defra's copy)" : BACKUP_LAYERS[d][0];
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

export { withBackup };
