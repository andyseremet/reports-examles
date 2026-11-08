// Property Location Check – topic: Noise: road, railway and aircraft. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { distanceKm, escapeHTML, formatDistance, link, LINKS, okValue } from "../core.js";
import { API, fetchJSON } from "../api.js";
import { inNI, inScotland, inWales, wmsInfo } from "../data.js";
import { isNI, isScotland, isWales, unavailable } from "./helpers.js";

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

// Scottish Government strategic noise maps (2021 traffic, published by SEPA): "Road" or "Rail", all sources.
// Like Wales, Scotland publishes a 16-hour daytime level. Outside the mapped area the value is 0 or "NoData".
async function getScotlandNoise(loc, source) {
  const geometry = JSON.stringify({ x: loc.lon, y: loc.lat, spatialReference: { wkid: 4326 } });
  const values = await Promise.all(NOISE_PERIODS_16H.map(p => fetchJSON(`${API.sepaNoise}Noise_${source}_${p.metric}_ALL/ImageServer/identify?` +
    new URLSearchParams({ geometry, geometryType: "esriGeometryPoint", returnGeometry: "false", returnCatalogItems: "false", f: "json" }))
    .then(d => { if (d.error) throw new Error(d.error.message || "query failed"); return Number(d.value); })));
  return { scotland: true, ...Object.fromEntries(NOISE_PERIODS_16H.map((p, i) => [p.key, roundNoise(values[i])])) };
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

function noiseComparison(db) {
  if (db < 45) return "very quiet";
  if (db < 55) return "like a quiet residential street";
  if (db < 65) return "like a busy town street";
  if (db < 75) return "like standing beside a busy main road";
  return "like standing beside a motorway";
}

// World Health Organization Environmental Noise Guidelines (2018).
const WHO_NOISE = { road: { lden: 53, lnight: 45 }, rail: { lden: 54, lnight: 44 }, aircraft: { lden: 45, lnight: 40 } };

function noiseLevelStatus(v, who) {
  if (!v || (v.lden == null && v.lnight == null)) return "low";
  if ((v.lden ?? 0) >= 65 || (v.lnight ?? 0) >= 55) return "high";
  // Above the WHO level but below "loud" is common on most urban streets, so it is for information only:
  // flagging it everywhere would hide the places where noise really stands out.
  if ((v.lden ?? 0) >= who.lden || (v.lnight ?? 0) >= who.lnight) return "info";
  return "low";
}

function checkNoise(R) {
  const scot = isScotland(R), ni = isNI(R);
  const wales = isWales(R) || scot || ni;   // Wales, Scotland and Northern Ireland: the same three periods
  const mapper = ni ? "DAERA" : scot ? "the Scottish Government" : wales ? "the Welsh Government" : "Defra";
  const periods = wales ? NOISE_PERIODS_16H : NOISE_PERIODS;
  const base = ni ? {
    source: { name: "DAERA strategic noise mapping (Round 4, 2021 traffic) for road and rail in Belfast and along major roads and railways; airport locations for aircraft; WHO Environmental Noise Guidelines (2018)", url: LINKS.niNoise },
    dataDate: "Noise maps for 2021 traffic (Round 4), published by DAERA"
  } : scot ? {
    source: { name: "Scottish Government strategic noise mapping (2021 traffic, Round 4, published by SEPA) for road and rail; airport locations for aircraft; WHO Environmental Noise Guidelines (2018)", url: LINKS.scotNoise },
    dataDate: "Noise maps for 2021 traffic (Round 4), published by the Scottish Government"
  } : wales ? {
    source: { name: "Welsh Government strategic noise mapping 2022 (Round 4, via DataMapWales) for road and rail; airport locations for aircraft; WHO Environmental Noise Guidelines (2018)", url: LINKS.walesNoise },
    dataDate: "Noise maps for 2022 (Round 4), published by the Welsh Government"
  } : {
    source: { name: "Defra strategic noise mapping 2022 (Round 4) for road and rail; airport locations for aircraft; WHO Environmental Noise Guidelines (2018)", url: LINKS.noise },
    dataDate: "Noise maps published by Defra in 2022"
  };
  if (!R.noise.ok && !R.railNoise.ok) return unavailable(base, R, "noise");

  const road = okValue(R, "noise");
  const rail = okValue(R, "railNoise");
  const airports = nearestAirports(R.loc);
  const nearAirports = airports.filter(a => a.distanceKm <= a.zoneKm);

  const roadStatus = road ? noiseLevelStatus(road, WHO_NOISE.road) : "error";
  const railStatus = rail ? noiseLevelStatus(rail, WHO_NOISE.rail) : "error";
  const airStatus = nearAirports.length ? "medium" : "low";
  let status = ["high", "medium", "info", "low"].find(s => [roadStatus, railStatus, airStatus].includes(s)) || "error";
  // Missing data is never good news: road or railway noise that could not be checked is not "No issue found".
  // A service that answered only in part (no 24-hour or night figure) counts as not checked too.
  const partly = v => (v.unavailable || []).some(k => k === "lden" || k === "lnight");
  const unchecked = [(!road || partly(road)) && "road", (!rail || partly(rail)) && "railway"].filter(Boolean);
  if (status === "low" && unchecked.length) status = "manual";

  const describe = (label, v, st) => {
    if (!v || partly(v)) return `${label}: not available`;
    if (v.lden == null && v.lnight == null) return `${label}: quiet`;
    const word = { high: "loud", info: "moderate", low: "low" }[st];
    return `${label}: ${word}`;
  };
  const found = [
    describe("Road", road, roadStatus),
    describe("Railway", rail, railStatus),
    nearAirports.length ? `Aircraft: ${nearAirports[0].name} Airport is ${formatDistance(nearAirports[0].distanceKm)} away` : "Aircraft: no major airport nearby"
  ].join(" · ") + "." + (unchecked.length ? ` ${unchecked.join(" and ").replace(/^./, c => c.toUpperCase())} noise could not be checked right now: check it on the official noise map.` : "");

  const cell = (src, key, who) => {
    if (!src || (src.unavailable || []).includes(key)) return "Not available";
    const v = src[key];
    if (v == null) return "Quiet";
    const limit = who[key];
    const flag = limit != null ? (v > limit ? " <strong>· above WHO</strong>" : " · within WHO") : "";
    return `${v} dB <small>(${noiseComparison(v)}${flag})</small>`;
  };
  const whoCell = key => WHO_NOISE.road[key] != null
    ? `Below ${WHO_NOISE.road[key]} dB (road)<br>Below ${WHO_NOISE.rail[key]} dB (railway)`
    : "<small>No separate WHO figure</small>";
  const row = period => `<tr><td><strong>${period.name}</strong><br><small>${period.when}</small></td>
      <td>${cell(road, period.key, WHO_NOISE.road)}</td>
      <td>${cell(rail, period.key, WHO_NOISE.rail)}</td>
      <td>${whoCell(period.key)}</td></tr>`;

  const airportText = nearAirports.length
    ? `<p><strong>Aircraft:</strong> ${nearAirports.map(a => `${escapeHTML(a.name)} Airport is about ${formatDistance(a.distanceKm)} away`).join("; ")}.
        Whether you hear aircraft depends mostly on the flight paths. Check the airport's noise maps and night-flight rules.
        The WHO recommends aircraft noise below ${WHO_NOISE.aircraft.lden} dB (24-hour average) and ${WHO_NOISE.aircraft.lnight} dB at night.</p>`
    : `<p><strong>Aircraft:</strong> no major airport within its usual noise area. The nearest is ${escapeHTML(airports[0].name)}
        Airport, about ${formatDistance(airports[0].distanceKm)} away.</p>`;

  return {
    ...base, status, found, ...(unchecked.length && { gap: "down" }),
    details: `<div class="table-wrap"><table>
        <thead><tr><th>Time of day</th><th>Road</th><th>Railway</th><th>WHO recommendation</th></tr></thead>
        <tbody>${periods.map(p => row(p)).join("")}</tbody>
      </table></div>${airportText}`,
    meaning: `<p>The levels are ${mapper}'s computer-modelled averages for 2021 traffic, at first-floor height on the side of the building
        facing the noise. A room at the back can be much quieter. The daytime figure is an average over ${wales ? "7am to 11pm" : "7am to 7pm"}, so rush hours
        are usually a little louder than shown.${wales ? ` ${ni ? "This" : scot ? "Scotland" : "Wales"} ${ni ? "report uses the 7am to 11pm figure rather than" : "does not publish"} separate daytime and evening figures.` : ""}${ni ? " Outside Belfast, only major roads and railways are mapped." : ""}</p>
      <p>The World Health Organization recommends average levels below: road ${WHO_NOISE.road.lden} dB (night ${WHO_NOISE.road.lnight} dB),
        railway ${WHO_NOISE.rail.lden} dB (night ${WHO_NOISE.rail.lnight} dB), aircraft ${WHO_NOISE.aircraft.lden} dB (night ${WHO_NOISE.aircraft.lnight} dB).
        Every 10 dB sounds roughly twice as loud. “Quiet” means below the lowest level ${mapper} maps.</p>
      <p>Most streets in towns are above the WHO levels. So we rate road and railway noise “Look into this” only when it is
        loud: a 24-hour average of 65 dB or more, or 55 dB or more at night. “Moderate” levels, between the WHO level and
        that, are shown for information.</p>
      <p>${wales ? "" : "Railway figures are worked out from Defra's published frequency bands using the standard A-weighting. "}Aircraft noise is
        not part of ${mapper}'s maps, so we show the distance to major airports instead. Military airfields are not included.</p>
      ${wales ? "" : "<p>Tip: open the layers button on the map and turn on “Show road noise” to see how road noise changes along the street.</p>"}`,
    actions: [
      nearAirports.length
        ? `Check flight paths and night flights on the ${link(nearAirports[0].url, nearAirports[0].name + " Airport website")} (look for “noise” or “community”).`
        : null,
      "Visit at different times, including rush hour and late evening, to hear it for yourself."
    ].filter(Boolean),
    seller: status === "low" ? [] : ["Is the property affected by traffic, train or aircraft noise? Is there double or secondary glazing?"]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const noiseTopic = {
  id: "noise", group: "living", title: "Noise: road, railway and aircraft",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  data: {
    noise: ["Road noise", getRoadNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"],
    railNoise: ["Railway noise", getRailNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"]
  },
  deps: ["noise", "railNoise"],
  build: checkNoise,
  icon: ['<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>', "Noise"],
  viewing: ["Listen inside and in the garden with a window open, and look at the glazing on the noisy side."]
};

export { checkNoise, getRailNoise, getRoadNoise, noiseTopic };
