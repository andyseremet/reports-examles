// Property Location Check – topic: Air quality. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, formatRadius, link, LINKS, okValue } from "../core.js";
import { API, fetchJSON } from "../api.js";
import { byDataset, isNI, isScotland, isWales, sitesKey, unavailable } from "./helpers.js";

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

function checkAir(R) {
  const wales = isWales(R) || isScotland(R);   // Welsh or Scottish hotspot data, in the same shape
  const ni = isNI(R);   // no hotspot map: the area estimate only
  // Open-Meteo (Copernicus CAMS model) is the main source; the council hotspot list (planning.data.gov.uk in England,
  // DataMapWales in Wales, the Scottish Air Quality database in Scotland) adds to it, and stands in if the model fails.
  // Only with both answering can it be "No issue found"; with either missing it is at most "For information".
  const hotspotName = ni ? "council Air Quality Management Areas are not mapped for Northern Ireland"
    : isScotland(R) ? "council Air Quality Management Areas (Scottish Air Quality database)"
    : wales ? "council Air Quality Management Areas (Welsh Government, via DataMapWales)"
    : "council Air Quality Management Areas (via planning.data.gov.uk)";
  const base = {
    source: { name: "Copernicus CAMS air quality model (via Open-Meteo); " + hotspotName,
      url: ni ? LINKS.niAir : isScotland(R) ? LINKS.scotAir : wales ? LINKS.walesAir : LINKS.ukair }
  };
  // An estimate with no figures (both averages missing) is no estimate: never "within legal limits" (code review, 2.3.3).
  const model = okValue(R, "air");
  const m = model && (model.no2 != null || model.pm25 != null) ? model : null;
  const emptyModel = !!model && !m;
  const hotspots = ni ? null : wales ? sitesKey(R) : "planningPoint";
  const hotspotsKnown = !!hotspots && R[hotspots].ok;
  if (!m && !hotspotsKnown && emptyModel) return {
    ...base, status: "manual",
    found: "The area pollution estimate has no figures for this place, and council air pollution hotspots " +
      (ni ? "are not mapped for Northern Ireland" : "could not be checked right now") + ". Check with the council.",
    actions: [`Ask the council about air quality near the property.`]
  };
  if (!m && !hotspotsKnown) return unavailable(base, R, !R.air.ok || !hotspots ? "air" : hotspots);

  const ws = wales && hotspotsKnown ? okValue(R, hotspots) : null;
  const here = !hotspotsKnown ? [] : wales ? ws.aqma.map(name => ({ name })) : byDataset(okValue(R, "planningPoint"), "air-quality-management-area");
  const near = !hotspotsKnown ? [] : wales ? ws.aqmaNear.filter(n => !ws.aqma.includes(n)).map(name => ({ name })) : byDataset(okValue(R, "planningNearby"), "air-quality-management-area");
  // Scotland's yearly limit for fine particles (PM2.5) is 10 µg/m³ (Air Quality (Scotland) Amendment Regulations 2016); the UK's is 20.
  const scot = isScotland(R), pm25Limit = scot ? 10 : 20, limitName = scot ? "Scottish legal limit" : "UK legal limit";
  const overLegal = m && ((m.no2 ?? 0) > 40 || (m.pm25 ?? 0) > pm25Limit);

  let status = !m || !hotspotsKnown ? "info" : "low";
  const parts = [];
  if (m) parts.push(`Area pollution levels are estimated to be ${overLegal ? "above" : "within"} ${scot ? "Scottish" : "UK"} legal limits.`);
  else parts.push(emptyModel ? "The area pollution estimate has no figures for this place." : "The area pollution estimate could not be retrieved right now.");
  if (hotspotsKnown) {
    if (here.length) { status = "medium"; parts.push("Inside an air pollution hotspot declared by the council (an Air Quality Management Area)."); }
    else parts.push("Not in an air pollution hotspot declared by the council." + (near.length ? ` There is one within ${formatRadius(R.loc.radius)}.` : ""));
  } else {
    parts.push(ni ? "Council air pollution hotspots are not mapped for Northern Ireland, so check with the council."
      : "Council air pollution hotspots could not be checked right now.");
  }
  if (overLegal) status = "high";
  const found = parts.join(" ");

  let details = "";
  const names = [...new Set([...here, ...near].map(a => a.name).filter(Boolean))].slice(0, 3);
  if (names.length) details += `<p>Nearby hotspots: ${escapeHTML(names.join("; "))}.</p>`;
  if (m) {
    if (m.from) base.dataDate = `Model average ${new Date(m.from).toLocaleDateString("en-GB")} to ${new Date(m.to).toLocaleDateString("en-GB")}`;
    const verdict = (v, who, legal) => v == null ? "Not available"
      : v > legal ? "Above " + limitName
      : v > who ? `Within ${scot ? "Scottish" : "UK"} limit, above WHO`
      : "Within WHO";
    details += `<p><strong>Area estimate</strong> (average over the last 3 months):</p>
      <div class="table-wrap"><table><thead><tr><th>Pollutant</th><th>Level here</th><th>WHO recommendation</th><th>${limitName.charAt(0).toUpperCase() + limitName.slice(1)}</th><th>Result</th></tr></thead><tbody>
        <tr><td>Fine particles (PM2.5)</td><td>${m.pm25 ?? "–"} µg/m³</td><td>Below 5 µg/m³</td><td>${pm25Limit} µg/m³</td><td>${verdict(m.pm25, 5, pm25Limit)}</td></tr>
        <tr><td>Nitrogen dioxide (NO₂), mainly from traffic</td><td>${m.no2 ?? "–"} µg/m³</td><td>Below 10 µg/m³</td><td>40 µg/m³</td><td>${verdict(m.no2, 10, 40)}</td></tr>
      </tbody></table></div>`;
  } else {
    details += "<p>The area pollution estimate could not be retrieved.</p>";
  }

  return {
    ...base, status, found, details,
    meaning: `<p>Councils declare an Air Quality Management Area where pollution, usually from traffic, is above legal limits. They must then have a plan to reduce it.</p>
      <p>The WHO recommendations are the yearly averages in the ${link(LINKS.whoAir, "WHO Global Air Quality Guidelines (2021)")}.
      ${scot ? "Scotland's legal limits are higher, though its fine-particle limit is half the UK's." : "UK legal limits are higher."} ${scot ? "Many places in Scotland are" : ni ? "Many places in Northern Ireland are" : wales ? "Most of Wales is" : "Most of England is"} above the WHO level. The model works on squares about 10 km
      across, so it describes the wider area, not your street. Levels beside busy roads are usually higher.</p>`,
    actions: [ni ? `See the council's hotspots and local monitoring results on ${link(LINKS.niAir, "Northern Ireland Air")}.` : scot ? `See local monitoring results and hotspots on ${link(LINKS.scotAir, "Air Quality in Scotland")}.` : wales ? `See local monitoring results and hotspots on ${link(LINKS.walesAir, "Air Quality in Wales")}.` : `See local monitoring results and hotspots on ${link(LINKS.ukair, "UK-AIR (Defra)")}.`]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const airTopic = {
  id: "air", group: "living", title: "Air quality",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  data: {
    air: ["Air quality", getAirModel, "Open-Meteo"]
  },
  deps: ["planningPoint", "planningNearby", "air", "walesSites", "scotlandSites", "niSites"],
  build: checkAir,
  icon: ['<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>', "Air"],
  viewing: ["Busy roads, junctions or works close by, and which rooms face them."]
};

export { airTopic, checkAir };
