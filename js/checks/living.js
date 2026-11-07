"use strict";
// Property Location Check – checks in the "Living environment" section.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

function checkAmenities(R) {
  const base = {
    source: { name: "Department for Education and NaPTAN (via planning.data.gov.uk), NHS Organisation Data Service, NaPTAN rail stations", url: LINKS.planningData }
  };
  if (!R.amenities.ok) return unavailable(base, R, "amenities");
  const g = R.amenities.value;
  // Each register covers only some countries (AMENITY_TYPES "covers"); outside them a row says "Not covered".
  const country = okValue(R, "place")?.country || null;
  const notCoveredHere = t => !!country && !t.covers.includes(country);
  const rows = AMENITY_TYPES.map(t => {
    const list = notCoveredHere(t) ? [] : (g[t.key] || []);
    return { t, near: list[0], count: list.filter(x => x.distanceKm <= t.within).length, notCovered: notCoveredHere(t) };
  });
  const uncovered = rows.filter(x => x.notCovered);
  const noneCovered = uncovered.length === rows.length;
  const uncoveredText = uncovered.length
    ? ` ${sentenceStart(listWords(uncovered.map(x => x.t.many)))} are not covered in ${country}.` : "";
  const nationalLinks = {
    Wales: [`Find schools on ${link(LINKS.walesSchools, "My Local School")}.`],
    Scotland: [`Find GP surgeries and pharmacies on ${link(LINKS.scotNhs, "NHS inform")}, and schools in the ${link(LINKS.scotSchools, "Scottish Government's school list")}.`],
    "Northern Ireland": [`Find GP practices on ${link(LINKS.niGps, "nidirect")}, schools on ${link(LINKS.niSchools, "Schools Plus")}, and trains and buses on ${link(LINKS.translink, "Translink")}.`]
  }[country] || [];
  const summary = rows.filter(x => x.near && x.near.distanceKm <= 5 && x.t.key !== "bus_stop" && x.t.key !== "tram").slice(0, 4)
    .map(x => `${x.t.short} ${formatDistance(x.near.distanceKm)}`);
  const missing = (g.missing || []).length
    ? `<p><strong>Not available right now:</strong> ${escapeHTML(g.missing.join(", "))}. Press “Refresh” later.</p>` : "";
  if (noneCovered) {
    return {
      ...base, status: "manual", gap: "coverage",
      found: `Not covered in ${country}: the registers we use for schools, GP surgeries, pharmacies and stations do not include it.`,
      meaning: "<p>Use the national services below to find schools, GP practices and public transport near the property.</p>",
      actions: [...nationalLinks, "Check school admission areas with the education authority before relying on a nearby school."]
    };
  }
  return {
    ...base, status: "info",
    found: ((summary.length ? "Nearest: " + summary.join(", ") + "." : (g.missing || []).length ? "" : "None of the places we check were found nearby.")
      + ((g.missing || []).length ? (summary.length ? " " : "") + "Not available right now: " + g.missing.join(", ") + "." : "") + uncoveredText).trim(),
    details: missing + `<div class="table-wrap"><table><thead><tr><th>Place</th><th>Nearest</th><th>Distance</th><th>Number nearby</th></tr></thead><tbody>${
      rows.map(x => x.notCovered
        ? `<tr><td>${escapeHTML(x.t.label)}</td><td colspan="3">Not covered in ${escapeHTML(country)}: this register covers ${escapeHTML(listWords(x.t.covers))} only</td></tr>`
        : `<tr><td>${escapeHTML(x.t.label)}</td><td>${x.near ? escapeHTML(x.near.name || "Unnamed") : "None found nearby"}</td>
        <td>${x.near ? formatDistance(x.near.distanceKm) : "–"}</td><td>${x.count} within ${formatRadius(x.t.within * 1000)}</td></tr>`).join("")
    }</tbody></table></div>`,
    meaning: `<p>Straight-line distances from the pin, from official registers: schools from the Department for Education
      (England), GP surgeries and pharmacies from the NHS Organisation Data Service (located by their postcode, so
      distances are approximate), and bus stops, tram and underground stops and railway stations from NaPTAN, the
      Department for Transport's national list of public transport stops.</p>
      <p>Supermarkets and shops are not included because there is no official open list. School catchment areas and
      Ofsted ratings are not shown: check them with the council and on the Ofsted website.</p>`,
    actions: [...nationalLinks, "Check school admission areas with the council before relying on a nearby school.", "Try the journey to work or school at rush hour."]
  };
}


function median(values) {
  const v = [...values].sort((a, b) => a - b), mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const pounds = n => "£" + Math.round(n).toLocaleString("en-GB");

function checkSoldPrices(R) {
  const base = {
    source: { name: "HM Land Registry Price Paid Data", url: LINKS.pricePaidData },
    dataDate: "Sales are added about 1 to 2 months after they complete. Checked live on " + today()
  };
  if (!R.soldPrices.ok) return unavailable(base, R, "soldPrices");
  const { sales } = R.soldPrices.value;
  const where = `within ${formatRadius(SOLD_RADIUS_M)} in the last ${SOLD_YEARS} years`;
  const licence = `<p>Contains HM Land Registry data © Crown copyright and database right ${new Date().getFullYear()}.
    This data is licensed under the Open Government Licence v3.0.</p>`;
  const searchLink = link(LINKS.soldPrices, "Search house price data on GOV.UK");
  if (!sales.length) {
    return {
      ...base, status: "manual",
      found: `No home sales were found ${where}.`,
      meaning: `<p>This does not mean homes here have no value: there may simply have been no sales recorded nearby,
        or the area has few postcodes. Ask local estate agents, and look further afield.</p>${licence}`,
      actions: [`Look up sale prices for nearby streets on ${searchLink}.`]
    };
  }
  const rows = Object.entries(SOLD_TYPES).map(([key, label]) => {
    const prices = sales.filter(x => x.type === key).map(x => x.price);
    return prices.length ? `<tr><td>${label}</td><td>${prices.length}</td><td>${pounds(median(prices))}</td>
      <td>${pounds(Math.min(...prices))} to ${pounds(Math.max(...prices))}</td></tr>` : "";
  }).join("");
  const recent = sales.slice(0, 10).map(x => `<tr><td>${escapeHTML(new Date(x.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }))}</td>
    <td>${pounds(x.price)}</td><td>${SOLD_TYPES[x.type]}${x.newBuild ? ' <span class="chip">New build</span>' : ""}</td>
    <td>${escapeHTML(x.street ? x.street.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "Not given")}</td></tr>`).join("");
  return {
    ...base, status: "info",
    found: `${plural(sales.length, "home sale")} ${where}. The median price was ${pounds(median(sales.map(x => x.price)))}.`,
    details: `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Sales</th><th>Median price</th><th>Range</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p><strong>Most recent sales</strong></p>
      <div class="table-wrap"><table class="site-list"><thead><tr><th>Sold</th><th>Price</th><th>Type</th><th>Street</th></tr></thead>
      <tbody>${recent}</tbody></table></div>`,
    meaning: `<p>These are completed sales of houses and flats at market value, recorded by HM Land Registry. Sales of
      shops, offices and homes bought in bulk are left out. Prices depend on size, condition and the exact street, so use
      them as a rough guide only.</p>
      <p>The ${term("median", "The middle price when all sales are put in order")} is the middle price: half the homes sold for more and
      half for less. A few very high or low sales change it less than they would change an average.</p>
      <p>A “New build” tag marks a newly built home; these often sell for more than similar older homes nearby.</p>${licence}`,
    actions: [
      `See every sale on a street on ${searchLink}.`,
      "Compare the asking price with similar homes sold nearby, and ask the estate agent which sales they used to set it."
    ],
    seller: ["What did you pay for the property, and what work has been done since?"],
    conveyancer: ["Does the price paid history on the title register match what the seller has told us?"]
  };
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
  const status = ["high", "medium", "info", "low"].find(s => [roadStatus, railStatus, airStatus].includes(s)) || "error";

  const describe = (label, v, st) => {
    if (!v) return `${label}: not available`;
    if (v.lden == null && v.lnight == null) return `${label}: quiet`;
    const word = { high: "loud", info: "moderate", low: "low" }[st];
    return `${label}: ${word}`;
  };
  const found = [
    describe("Road", road, roadStatus),
    describe("Railway", rail, railStatus),
    nearAirports.length ? `Aircraft: ${nearAirports[0].name} Airport is ${formatDistance(nearAirports[0].distanceKm)} away` : "Aircraft: no major airport nearby"
  ].join(" · ") + ".";

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
    ...base, status, found,
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
      <p>Most streets in towns are above the WHO levels, so we rate road and railway noise “Look into this” only when it is loud:
        a 24-hour average of 65 dB or more, or 55 dB or more at night. “Moderate” levels between the WHO level and that are
        shown for information.</p>
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

function checkAir(R) {
  const wales = isWales(R) || isScotland(R);   // Welsh or Scottish hotspot data, in the same shape
  const ni = isNI(R);   // no hotspot map: the area estimate only
  const base = {
    source: ni
      ? { name: "Copernicus CAMS air quality model (via Open-Meteo); council Air Quality Management Areas are not mapped for Northern Ireland", url: LINKS.niAir }
      : isScotland(R)
      ? { name: "Council Air Quality Management Areas in Scotland (Scottish Air Quality database); Copernicus CAMS air quality model (via Open-Meteo)", url: LINKS.scotAir }
      : wales
      ? { name: "Council Air Quality Management Areas in Wales (Welsh Government, via DataMapWales); Copernicus CAMS air quality model (via Open-Meteo)", url: LINKS.walesAir }
      : { name: "Council Air Quality Management Areas (via planning.data.gov.uk); Copernicus CAMS air quality model (via Open-Meteo)", url: LINKS.ukair }
  };
  // Without the council hotspot data we cannot say "not in a hotspot" (missing data is never good news).
  const hotspots = ni ? "air" : wales ? sitesKey(R) : "planningPoint";
  if (!R[hotspots].ok) return unavailable(base, R, hotspots);

  const ws = wales ? okValue(R, hotspots) : null;
  const here = ni ? [] : wales ? (ws ? ws.aqma.map(name => ({ name })) : []) : byDataset(okValue(R, "planningPoint"), "air-quality-management-area");
  const near = ni ? [] : wales ? (ws ? ws.aqmaNear.filter(n => !ws.aqma.includes(n)).map(name => ({ name })) : []) : byDataset(okValue(R, "planningNearby"), "air-quality-management-area");
  const m = okValue(R, "air");
  // Scotland's yearly limit for fine particles (PM2.5) is 10 µg/m³ (Air Quality (Scotland) Amendment Regulations 2016); the UK's is 20.
  const scot = isScotland(R), pm25Limit = scot ? 10 : 20, limitName = scot ? "Scottish legal limit" : "UK legal limit";
  const overLegal = m && ((m.no2 ?? 0) > 40 || (m.pm25 ?? 0) > pm25Limit);

  let status = "low";
  let found = "Not in an air pollution hotspot declared by the council.";
  if (here.length) { status = "medium"; found = "Inside an air pollution hotspot declared by the council (an Air Quality Management Area)."; }
  else if (near.length) found += ` There is one within ${formatRadius(R.loc.radius)}.`;
  if (ni) {
    status = "manual";
    found = "Council air pollution hotspots are not mapped for Northern Ireland, so check with the council." +
      (m && !overLegal ? " Area pollution levels are estimated to be within UK legal limits." : "");
  }
  if (overLegal) { status = "high"; found += ` Area pollution levels are estimated to be above ${scot ? "Scottish" : "UK"} legal limits.`; }

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
    ...(status === "manual" && { gap: "coverage" }),
    actions: [ni ? `See the council's hotspots and local monitoring results on ${link(LINKS.niAir, "Northern Ireland Air")}.` : scot ? `See local monitoring results and hotspots on ${link(LINKS.scotAir, "Air Quality in Scotland")}.` : wales ? `See local monitoring results and hotspots on ${link(LINKS.walesAir, "Air Quality in Wales")}.` : `See local monitoring results and hotspots on ${link(LINKS.ukair, "UK-AIR (Defra)")}.`]
  };
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
      ...base, status: "manual", gap: "nodata",
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
    found: `In this small area (${z.name}), the recorded crime rate is ${word}: ranked ${z.rank.toLocaleString("en-GB")} of ${SIMD_ZONES.toLocaleString("en-GB")} areas, where 1 has the most crime.`,
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
      `Compare areas on ${link(LINKS.simd, "SIMD")} (choose the crime domain), and see recent figures by council area in the ${link(LINKS.scotCrime, "recorded crime statistics")}.`,
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
      <p>The comparison uses one month of street-level police data for the census neighbourhood (MSOA), its population from
      the ${link(LINKS.nomisCensus, "2021 Census")}, and the national average from ${link(LINKS.onsCrime, "ONS crime figures")}
      (6.6 million crimes, year to March 2025) and ${link(LINKS.onsPopulation, "ONS population estimates")} (61.8 million, mid-2024).
      One month can vary, so treat it as a rough guide.</p>`,
    actions: [`Compare nearby areas, and find the local policing team, on ${link(LINKS.police, "police.uk")}.`]
  };
}
