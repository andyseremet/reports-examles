// Property Location Check – automatic test
//
// Checks that every data service the page relies on still answers (and still
// allows web pages to read it), then opens the page in a browser on desktop,
// phone and tablet, runs reports and tests the main features.
//
// Usage:
//   BASE=https://andyseremet.github.io/reports-examles/ node tests/live-check.mjs
//   BASE=http://localhost:8080/index.html node tests/live-check.mjs
//
// Writes test-results/summary.md, test-results/results.json and screenshots.
// Exits with code 1 if anything failed.

import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const BASE = process.env.BASE || "https://andyseremet.github.io/reports-examles/";
const OUT = process.env.OUT || "test-results";
const ORIGIN = "https://andyseremet.github.io";
const UA = "property-location-check-tests (https://github.com/andyseremet/reports-examles)";
mkdirSync(OUT, { recursive: true });

const results = [];
const record = (group, name, pass, info = "") => {
  results.push({ group, name, pass, info: String(info).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"}  [${group}] ${name}${info ? "  – " + String(info).slice(0, 160) : ""}`);
};

/* ---------------------------------------------------------------
   1. Data services: answer, expected content, and readable by web pages (CORS)
--------------------------------------------------------------- */
const LAT = 53.5526, LON = -1.4797;            // Barnsley town centre
const box = (lat, lon, d = 0.0005) => [lat - d, lon - d, lat + d, lon + d].join(",");
const wms = (base, layer, lat = LAT, lon = LON, d = 0.0005) => `${base}?` + new URLSearchParams({
  service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers: layer, query_layers: layer, styles: "",
  crs: "EPSG:4326", bbox: box(lat, lon, d), width: 11, height: 11, i: 5, j: 5, info_format: "application/json"
});
const arcgis = (base, extra = "") => `${base}?geometry=${LON},${LAT}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json${extra}`;

const SERVICES = [
  ["Postcodes (postcodes.io)", `https://api.postcodes.io/postcodes?lon=${LON}&lat=${LAT}&limit=1`, d => d.result && d.result[0].postcode],
  ["Planning data (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?latitude=${LAT}&longitude=${LON}&limit=5`, d => Array.isArray(d.entities)],
  ["Flood warnings (Environment Agency)", `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${LAT}&long=${LON}&dist=1`, d => Array.isArray(d.items)],
  ["Surface water (Environment Agency)", wms("https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms", "rofsw"), d => Array.isArray(d.features)],
  ["Radon (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/radon/MapServer/0/query"), d => d.features && d.features.length === 1],
  ["Landslides (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer/2/query", "&distance=1000&units=esriSRUnit_Meter"), d => Array.isArray(d.features)],
  ["Coal mining (Mining Remediation Authority)", arcgis("https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentLowRiskArea/FeatureServer/0/query"), d => d.features && d.features.length >= 1],
  ["Road noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/road-noise-all-metrics-england-round-4/wms", "Road_Noise_Lden_England_Round_4_All"), d => Array.isArray(d.features)],
  ["Rail noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/rail-noise-england-round-4-all/wms", "Rail_Noise_Lden_England_Round_4_All_1000Hz"), d => Array.isArray(d.features)],
  ["Historic landfill (Environment Agency)", `https://environment.data.gov.uk/spatialdata/historic-landfill/ogc/features/v1/collections/Historic_Landfill_Sites/items?f=json&limit=5&bbox=${LON - 0.02},${LAT - 0.02},${LON + 0.02},${LAT + 0.02}`, d => Array.isArray(d.features)],
  ["Air quality model (Open-Meteo)", `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&hourly=pm2_5&past_days=1&forecast_days=0&timeformat=unixtime`, d => d.hourly && d.hourly.pm2_5.length > 0],
  ["Crime (data.police.uk)", `https://data.police.uk/api/crimes-street/all-crime?lat=${LAT}&lng=${LON}`, d => Array.isArray(d) && d.length > 0],
  ["Census population (Nomis)", "https://www.nomisweb.co.uk/api/v01/dataset/NM_2021_1.data.json?date=latest&geography=E02001521&c2021_restype_3=0&measures=20100&select=obs_value", d => d.obs && d.obs[0].obs_value.value > 0],
  ["Census boundaries (ONS)", "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Middle_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V3/FeatureServer/0/query?where=MSOA21CD%3D%27E02001521%27&outFields=MSOA21CD&returnGeometry=false&f=json", d => d.features && d.features.length === 1],
  ["Scotland flood maps (SEPA)", "https://map.sepa.org.uk/server/rest/services/Open/Flood_Maps/MapServer/2/query?geometry=-3.43,56.404&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnCountOnly=true&f=json", d => Number.isFinite(d.count)],
  ["Wales flood maps (Natural Resources Wales)", wms("https://datamap.gov.wales/geoserver/ows", "inspire-nrw:NRW_FLOODZONE_RIVERS_SEAS_MERGED", 51.47, -3.188, 0.00005), d => Array.isArray(d.features) && d.features.length > 0],
  ["Address search (OpenStreetMap Nominatim)", "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=Barnsley%20Town%20Hall", d => Array.isArray(d) && d.length > 0],
  ["Schools register (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?dataset=educational-establishment&latitude=${LAT}&longitude=${LON}&limit=1`, d => Array.isArray(d.entities)],
  ["GP surgeries and pharmacies (NHS Organisation Data Service)", "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?PrimaryRoleId=RO182&PostCode=S70&Status=Active&Limit=5", d => Array.isArray(d.Organisations) && d.Organisations.length > 0],
  ["Postcode lookup for many postcodes (postcodes.io)", "https://api.postcodes.io/postcodes", d => Array.isArray(d.result) && d.result[0].result,
    { method: "POST", body: JSON.stringify({ postcodes: ["S70 2TA"] }), headers: { "Content-Type": "application/json" } }],
  ["Railway station list (saved with the app)", new URL("data/rail-stations.json", BASE).href, d => Array.isArray(d.stations) && d.stations.length > 2000, { sameSite: true }]
];

async function checkService([name, url, expect, options = {}]) {
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { sameSite, ...fetchOptions } = options;
      const res = await fetch(url, { ...fetchOptions, headers: { Origin: ORIGIN, "User-Agent": UA, Accept: "application/json", ...(options.headers || {}) },
        signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const cors = res.headers.get("access-control-allow-origin");
      if (!options.sameSite && (!cors || (cors !== "*" && cors !== ORIGIN))) throw new Error("web pages are not allowed to read it (no CORS header)");
      const data = await res.json();
      if (!expect(data)) throw new Error("unexpected content");
      return record("Data services", name, true, `${Date.now() - started} ms`);
    } catch (e) {
      if (attempt === 2) return record("Data services", name, false, e.message);
      // A refusal (403) from the Environment Agency map server is its short block on
      // busy addresses (it lasts up to about 40 s), so wait it out before trying again.
      await new Promise(r => setTimeout(r, e.message === "HTTP 403" ? 45000 : 3000));
    }
  }
}

/* ---------------------------------------------------------------
   2. The page in a browser
--------------------------------------------------------------- */
const PAUSE_BEFORE_REPORT_MS = Number(process.env.PAUSE_MS ?? 60000);

const DEVICES = [
  { name: "Desktop", options: { viewport: { width: 1366, height: 900 } } },
  { name: "Phone (iPhone 13)", options: { ...devices["iPhone 13"] } },
  { name: "Tablet (iPad Pro 11, landscape)", options: { ...devices["iPad Pro 11 landscape"] } }
];
const FIXED = [["S70 2TA", "Barnsley"], ["CF11 7HW", "Cardiff"], ["YO1 7HH", "York"]];

async function randomEnglishPostcode() {
  for (let i = 0; i < 8; i++) {
    try {
      const r = (await (await fetch("https://api.postcodes.io/random/postcodes", { headers: { "User-Agent": UA } })).json()).result;
      if (r && r.country === "England") return [r.postcode, r.admin_district];
    } catch (e) { /* try again */ }
  }
  return ["CM8 1AY", "Braintree"];
}

const reportDone = page => page.waitForFunction(() => typeof run !== "undefined" && run && run.done, null, { timeout: 150000 });

async function testDevice(device, [postcode, place]) {
  const group = `${device.name} – ${postcode}, ${place}`;
  const context = await browser.newContext({ ...device.options, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  // Record data requests that fail, with the reply, to explain any topic that could not load.
  const failedRequests = [];
  const shortUrl = u => { const x = new URL(u); return x.host + x.pathname.replace(/\/(wms|query|items)$/, "/$1"); };
  page.on("response", res => {
    if (res.status() >= 400 && !/tile|png|jpg/.test(res.url()))
      failedRequests.push(`${shortUrl(res.url())} → HTTP ${res.status()}${res.headers()["retry-after"] ? " (retry-after " + res.headers()["retry-after"] + ")" : ""}`);
  });
  page.on("requestfailed", req => {
    if (!/tile|png|jpg/.test(req.url())) failedRequests.push(`${shortUrl(req.url())} → ${req.failure() ? req.failure().errorText : "failed"}`);
  });
  const step = async (name, fn) => {
    try { const info = await fn(); record(group, name, info !== false, info === false ? "" : info || ""); }
    catch (e) { record(group, name, false, e.message.split("\n")[0]); }
  };
  const file = name => `${OUT}/${device.name.replace(/\W+/g, "-")}-${name}.png`;

  await step("Page opens with the search ready", async () => {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    return (await page.$eval(".leaflet-top.leaflet-left .map-ctrl", x => x.classList.contains("open"))) ? "search open" : false;
  });

  await step("Search finds the postcode", async () => {
    await page.fill("#q", postcode);
    await page.waitForSelector("#suggestions:not(.hidden) li", { timeout: 15000 });
    await page.click("#suggestions li");
    await page.waitForSelector("#confirm:not(.hidden)");
    const text = await page.$eval("#confirmText", x => x.textContent);
    return text.includes(postcode) ? text : false;
  });

  await step("Full-screen map covers the screen and closes", async () => {
    await page.$eval("#map", x => x.scrollIntoView({ block: "center" }));
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const b = document.getElementById("map").getBoundingClientRect(); return [b.left, b.top, b.width, b.height, innerWidth, innerHeight].map(Math.round); });
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("pressing the full-screen button moved the pin");
    await page.screenshot({ path: file("fullscreen") });
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await page.waitForTimeout(600);
    const closed = !(await page.evaluate(() => mapIsFull));
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("closing full screen moved the pin");
    return r[0] === 0 && r[1] === 0 && Math.abs(r[2] - r[4]) <= 1 && Math.abs(r[3] - r[5]) <= 1 && closed ? `map ${r[2]}×${r[3]}` : false;
  });

  let topics = [];
  await step("Report runs with every topic", async () => {
    const started = Date.now();
    await page.click("#runBtn");
    await reportDone(page);
    const readTopics = () => page.evaluate(() => orderedResults().map(c => ({ id: c.id, status: c.status, found: c.found })));
    topics = await readTopics();
    const total = await page.evaluate(() => CHECKS.length);
    let failed = topics.filter(t => t.status === "error");
    // A government service that is slow for a moment shows "Try again" on that topic.
    // Press it once, as a person would (this also tests the button). A topic that
    // fails a second time still fails the test.
    const retried = failed.map(t => t.id);
    for (const id of retried) {
      await page.waitForTimeout(20000);
      await page.click(`[data-retry="${id}"]`);
      await page.waitForTimeout(500);
      await reportDone(page);
    }
    if (retried.length) { topics = await readTopics(); failed = topics.filter(t => t.status === "error"); }
    const secs = Math.round((Date.now() - started) / 1000);
    if (topics.length !== total || failed.length) {
      const why = [...new Set(failedRequests)].slice(0, 6).join("; ");
      throw new Error(`${failed.length} topic(s) failed` + (retried.length ? " even after Try again" : "") + ": " +
        failed.map(t => `${t.id} (${t.found})`).join("; ") + (why ? ` | failed requests: ${why}` : ""));
    }
    return `${total} topics in ${secs} s` + (retried.length ? ` (needed Try again: ${retried.join(", ")})` : "");
  });
  await page.$eval("#reportTop", x => x.scrollIntoView()).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file("report") });

  await step("Topic icons and section bar", async () => {
    const icons = await page.$$eval(".topic-strip li", l => l.length);
    await page.click('#reportNav a[data-nav="group-living"]');
    await page.waitForTimeout(1500);
    const active = await page.$eval("#reportNav a.active", x => x.textContent).catch(() => null);
    return icons >= 13 && active === "Living" ? `${icons} icons, section bar ok` : false;
  });

  await step("Back returns to the search, Forward reopens the report", async () => {
    await page.goBack();
    await page.waitForTimeout(1000);
    const backOk = await page.evaluate(() => location.search === "" && document.getElementById("toolbar").classList.contains("hidden"));
    await page.goForward();
    await reportDone(page);
    return backOk ? "ok" : false;
  });

  await step("Saved property reopens instantly with notes", async () => {
    await page.fill("#notesText", "Automatic test note");
    await page.waitForTimeout(800);
    await page.reload();
    await reportDone(page);
    const instant = await page.$("#refreshBtn") !== null;
    const note = await page.$eval("#notesText", x => x.value);
    return instant && note === "Automatic test note" ? "ok" : false;
  });

  await step("Print summary and download", async () => {
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => { document.body.classList.add("print-summary"); dispatchEvent(new Event("beforeprint")); });
    await page.waitForTimeout(800);
    await page.pdf({ path: `${OUT}/${device.name.replace(/\W+/g, "-")}-summary.pdf`, format: "A4" });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => { document.body.classList.remove("print-summary"); dispatchEvent(new Event("afterprint")); });
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadHtml")]);
    await download.saveAs(`${OUT}/${device.name.replace(/\W+/g, "-")}-report.html`);
    return download.suggestedFilename();
  });

  await step("No sideways scrolling", async () =>
    (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) ? "ok" : false);

  record(group, "No page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
  await context.close();
  return topics;
}

/* ---------------------------------------------------------------
   Run everything and write the summary
--------------------------------------------------------------- */
let browser;
const reports = {};
try {
  for (const service of SERVICES) await checkService(service);
  browser = await chromium.launch();
  const randomPlace = await randomEnglishPostcode();
  const places = [FIXED[0], FIXED[1], randomPlace];
  for (let i = 0; i < DEVICES.length; i++) {
    // The Environment Agency map server allows only about 15 requests a minute from
    // one address, and one report sends about 7. Pausing before each report keeps
    // the test within that limit, like a person checking one property at a time.
    await new Promise(r => setTimeout(r, PAUSE_BEFORE_REPORT_MS));
    const topics = await testDevice(DEVICES[i], places[i]);
    reports[`${DEVICES[i].name}: ${places[i].join(", ")}`] = topics;
  }
} catch (e) {
  record("Test run", "The test itself crashed", false, e.message);
} finally {
  if (browser) await browser.close();
}

const failed = results.filter(r => !r.pass);
const lines = [
  `# Property Location Check – automatic test`,
  ``,
  `Tested: ${BASE}  `,
  `Date: ${new Date().toUTCString()}  `,
  `Result: **${failed.length ? `${failed.length} problem(s) found` : "all checks passed"}** (${results.length - failed.length} of ${results.length} passed)`,
  ``
];
if (failed.length) {
  lines.push(`## Problems`, ``, `| Area | Check | Details |`, `|---|---|---|`);
  failed.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
  lines.push(``);
}
lines.push(`## All checks`, ``, `| Result | Area | Check | Details |`, `|---|---|---|---|`);
results.forEach(r => lines.push(`| ${r.pass ? "✅" : "❌"} | ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
lines.push(``, `## Report results`, ``);
Object.entries(reports).forEach(([name, topics]) => {
  lines.push(`**${name}**`, ``);
  (topics || []).forEach(t => lines.push(`- ${t.id}: ${t.status} – ${t.found}`));
  lines.push(``);
});

const summary = lines.join("\n");
writeFileSync(`${OUT}/summary.md`, summary);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, date: new Date().toISOString(), results, reports }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
