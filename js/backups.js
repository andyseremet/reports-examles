"use strict";
// Property Location Check – backups used only when planning.data.gov.uk does not answer.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

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
