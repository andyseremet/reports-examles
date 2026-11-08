// Property Location Check – topic: Reported crime. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, link, LINKS, monthName, okValue, plural, term } from "../core.js";
import { API, arcgisQuery, fetchJSON, once } from "../api.js";
import { getPlace, inScotland } from "../data.js";
import { tidy } from "../data-wales.js";
import { NATIONAL } from "../national.js";
import { isScotland, unavailable } from "./helpers.js";

// Census 2021 residents per local area (MSOA). A census is never re-counted, so these
// fixed figures are saved with the app (data/census2021-msoa-residents.json) instead of
// being asked for each time.
const getCensusResidents = once(() => fetchJSON(new URL("../../data/census2021-msoa-residents.json", import.meta.url).href).then(d => d.residents));

// Crime in the local neighbourhood (census "MSOA", about 8,000 residents) per 1,000 residents.
async function getCrimeArea(loc) {
  const place = await getPlace(loc);
  const code = place && place.codes && place.codes.msoa;
  if (!code || !/^[EW]02/.test(code)) return null;     // England and Wales only
  const [boundary, population] = await Promise.all([
    fetchJSON(API.msoaBoundary + "?" + new URLSearchParams({
      where: `MSOA21CD='${code}'`, outFields: "MSOA21CD,MSOA21NM", returnGeometry: "true",
      outSR: "4326", geometryPrecision: "5", maxAllowableOffset: "0.0005", f: "json"
    })),
    getCensusResidents()
  ]);
  const feature = boundary.features && boundary.features[0];
  const ring = feature && feature.geometry && feature.geometry.rings && feature.geometry.rings[0];
  const residents = population[code];
  if (!ring || !residents) return null;
  const step = Math.max(1, Math.ceil(ring.length / 90));          // keep the area outline short
  const poly = ring.filter((_, i) => i % step === 0).map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(":");
  const crimes = await fetchJSON(API.crime + "?poly=" + poly);
  const notASB = crimes.filter(c => c.category !== "anti-social-behaviour").length;
  return {
    code, name: feature.attributes.MSOA21NM, residents,
    month: crimes[0] ? crimes[0].month : null, total: crimes.length, crimes: notASB,
    perThousand: Math.round(notASB / residents * 1000 * 10) / 10
  };
}

async function getCrime(loc) {
  if (await inScotland(loc)) return null;   // Police Scotland publishes no street-level data (Scotland: getSimdCrime)
  const items = await fetchJSON(API.crime + "?lat=" + loc.lat + "&lng=" + loc.lon);
  const byType = {};
  items.forEach(c => { byType[c.category] = (byType[c.category] || 0) + 1; });
  // Some police forces publish nothing for months (Greater Manchester Police since March 2025), which makes
  // their area look almost crime-free. When the count is tiny, find the force so the report can name it.
  let force = null;
  if (items.length <= 5) {
    try {
      const hood = await fetchJSON(API.police + "locate-neighbourhood?q=" + loc.lat + "," + loc.lon);
      if (hood && hood.force) {
        const f = await fetchJSON(API.police + "forces/" + encodeURIComponent(hood.force));
        force = { id: hood.force, name: f.name || hood.force, url: (f.url || "").replace(/^http:/, "https:") };
      }
    } catch (e) { /* the force is only needed for the explanation */ }
  }
  return { total: items.length, month: items[0]?.month || null, byType, force };
}

// True when the police data for this place looks missing rather than low: almost nothing within a mile
// and almost nothing in the whole census neighbourhood (thousands of residents). Genuinely quiet rural
// places still show some crimes in one of the two (checked against Northumberland, Dartmoor, Kielder,
// the Isles of Scilly and the Lake District in November 2026).
function policeDataMissing(crime, area) {
  return !!area && crime.total <= 5 && area.total <= 2;
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

// Scotland: Police Scotland publishes no street-level crime data, so we use the crime part of the Scottish Index
// of Multiple Deprivation 2020 (recorded crime in 2017-18) for the small area at the pin.
function checkCrimeScotland(R) {
  const base = {
    source: { name: "Scottish Index of Multiple Deprivation 2020, crime domain (Scottish Government)", url: LINKS.simdAbout },
    dataDate: "Crimes recorded in 2017–18, published in the Scottish Index of Multiple Deprivation 2020"
  };
  if (!R.simdCrime.ok) return unavailable(base, R, "simdCrime");
  const z = R.simdCrime.value;
  if (!z) {
    return {
      ...base, status: "manual",
      found: "No crime figures were found for this spot. Police Scotland does not publish street-level crime data.",
      meaning: "<p>Check recorded crime for the council area instead.</p>",
      actions: [`See recorded crime by council area in the ${link(LINKS.scotCrime, "Scottish Government's recorded crime statistics")}.`]
    };
  }
  const share = z.rank / SIMD_ZONES;   // rank 1 = the highest crime rate in Scotland
  const word = share <= 0.1 ? "among the highest 10% in Scotland" : share <= 0.3 ? "above average for Scotland"
    : share <= 0.7 ? "around average for Scotland" : "below average for Scotland";
  return {
    ...base, status: "info",
    found: `In this small area (${z.name}), the recorded crime rate is ${word}. It ranks ${z.rank.toLocaleString("en-GB")} of ${SIMD_ZONES.toLocaleString("en-GB")} areas (number 1 has the most crime).`,
    details: `<div class="table-wrap"><table><tbody>
        <tr><th scope="row">Area</th><td>${escapeHTML(z.name)}, ${escapeHTML(z.council)} (${term("data zone", "A small area used for Scottish statistics, home to about 500 to 1,000 people")} ${escapeHTML(z.zone)})</td></tr>
        <tr><th scope="row">Selected crimes recorded in 2017–18</th><td>${z.count}</td></tr>
        <tr><th scope="row">Rate per 10,000 people</th><td>${z.rate}</td></tr>
        <tr><th scope="row">Rank in Scotland (1 = most crime)</th><td>${z.rank.toLocaleString("en-GB")} of ${SIMD_ZONES.toLocaleString("en-GB")}</td></tr>
      </tbody></table></div>`,
    meaning: `<p>Police Scotland does not publish street-level crime data, so we use the crime part of the Scottish Government's
        ${link(LINKS.simd, "Scottish Index of Multiple Deprivation")}. It counts crimes of violence, sexual crimes, domestic housebreaking,
        vandalism, drugs offences and common assault recorded in 2017–18, per 10,000 people. The figures are several years old
        and town centres rank high because of shops and nightlife, so treat this as a rough guide.</p>
      <p>Rating: crime is shown for information only.</p>`,
    actions: [
      `Compare areas on the ${link(LINKS.simd, "Scottish Index of Multiple Deprivation")} (choose the crime part), and see recent figures by council area in the ${link(LINKS.scotCrime, "recorded crime statistics")}.`,
      `Find the local policing team on the ${link(NATIONAL.Scotland.police[1], "Police Scotland website")}.`
    ]
  };
}

function checkCrime(R) {
  if (isScotland(R)) return checkCrimeScotland(R);
  const base = {
    source: { name: "data.police.uk (Home Office)", url: LINKS.policeData }
  };
  if (!R.crime.ok) return unavailable(base, R, "crime");
  const c = R.crime.value;
  if (policeDataMissing(c, okValue(R, "crimeArea"))) {
    const force = c.force ? c.force.name : "The local police force";
    const site = c.force && c.force.url ? link(c.force.url, c.force.name + " website") : link(LINKS.police, "police.uk");
    return {
      ...base, status: "manual",
      found: `${force} has not published recent street-level crime data, so crime here cannot be shown. Check the force's own figures.`,
      details: `<p>The national police data service shows almost no crimes here (${c.total} within about 1 mile), which usually means the
        force has not sent its data, not that there is no crime. Greater Manchester Police, for example, has published none since March 2025.</p>`,
      meaning: `<p>Street-level crime data comes from each police force through ${link(LINKS.policeData, "data.police.uk")}. When a force stops
        sending it, its area looks almost crime-free. We do not compare it with the national average in that case.</p>`,
      actions: [`See crime figures on the ${site}.`, `Compare areas on ${link(LINKS.police, "police.uk")} when the data returns.`]
    };
  }
  base.dataDate = "Crimes reported in " + monthName(c.month)
    + (okValue(R, "crimeArea") ? "; residents from the 2021 Census" : "");
  const key = [
    ["burglary", "Burglary"], ["vehicle-crime", "Vehicle crime"],
    ["anti-social-behaviour", "Antisocial behaviour"], ["violent-crime", "Violence and sexual offences"]
  ];
  const keyTotal = key.reduce((n, [k]) => n + (c.byType[k] || 0), 0);
  // Compare the neighbourhood with England and Wales: 6.6 million police-recorded crimes in the year
  // to March 2025 (ONS) for 61.8 million people (ONS mid-2024) = about 8.9 per 1,000 people per month.
  const AVERAGE = 6.6e6 / 61.8e6 * 1000 / 12;
  const area = okValue(R, "crimeArea");
  let compare = "", compareFound = "";
  if (area) {
    const ratio = area.perThousand / AVERAGE;
    const word = ratio < 0.75 ? "below" : ratio <= 1.25 ? "around" : ratio <= 2 ? "above" : "well above";
    compareFound = ` In this neighbourhood, crime is ${word} the England and Wales average.`;
    compare = `<p><strong>Compared with England and Wales:</strong> in ${escapeHTML(area.name)} (${area.residents.toLocaleString("en-GB")} residents,
      the census neighbourhood around the pin), police recorded ${area.crimes} crimes in ${monthName(area.month)}, not counting antisocial
      behaviour. That is about <strong>${area.perThousand} per 1,000 residents</strong>, compared with an average of about
      <strong>${AVERAGE.toFixed(1)}</strong> per 1,000 per month across England and Wales: <strong>${word} average</strong>.</p>`;
  } else if (R.crimeArea && !R.crimeArea.ok) {
    compare = "<p>The comparison with England and Wales could not be worked out right now.</p>";
  }
  return {
    ...base, status: "info",
    found: `${plural(c.total, "crime")} reported within about 1 mile in ${monthName(c.month)}, including ${plural(c.byType["burglary"] || 0, "burglary", "burglaries")}.${compareFound}`,
    details: `${compare}<div class="table-wrap"><table><thead><tr><th>Types most relevant to residents</th><th>Number</th></tr></thead><tbody>${
      key.map(([k, label]) => `<tr><td>${label}</td><td>${c.byType[k] || 0}</td></tr>`).join("")
    }<tr><td>All other types</td><td>${c.total - keyTotal}</td></tr></tbody></table></div>`,
    meaning: `<p>Town and city centres show higher numbers because of shops, transport hubs and nightlife. The figures are
      most useful when you compare a few streets or areas you are considering.</p>
      <p>The comparison uses one month of street-level police data for the census neighbourhood (about 8,000 residents).
      Its population comes from the ${link(LINKS.nomisCensus, "2021 Census")}. The national average comes from the Office for
      National Statistics: its ${link(LINKS.onsCrime, "crime figures")} (6.6 million crimes, year to March 2025) and
      ${link(LINKS.onsPopulation, "population estimates")} (61.8 million, mid-2024). One month can vary, so treat it as a rough guide.</p>`,
    actions: [`Compare nearby areas, and find the local policing team, on ${link(LINKS.police, "police.uk")}.`]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const crimeTopic = {
  id: "crime", group: "living", title: "Reported crime",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  data: {
    crime: ["Reported crime", getCrime, "data.police.uk"],
    crimeArea: ["Crime compared with England and Wales", getCrimeArea, "Office for National Statistics"],
    simdCrime: ["Crime rank in Scotland", getSimdCrime, "Scottish Government"]
  },
  deps: ["crime", "crimeArea", "simdCrime"],
  build: checkCrime,
  icon: ['<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', "Crime"]
};

export { checkCrime, crimeTopic, getCrime, getCrimeArea, getSimdCrime };
