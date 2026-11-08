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
//
// This file runs the parts in order; each part is in tests/live/ (split on 8 November 2026, same steps):
//   settings.mjs   where to test and what to run (BASE, QUICK, ONLY, STEP, REPLAY, RECORD and the rest)
//   results.mjs    the results list, and how each step is run, timed and recorded
//   recording.mjs  recording and replaying the report pages' outside answers; the Environment Agency pause
//   services.mjs   1. the data services (SERVICES) and which topics each one feeds
//   country.mjs    the country data steps (backups, Wales, Scotland, Northern Ireland, prices, places)
//   devices.mjs    2. desktop, phone and tablet: one report each and the main features
//   summary.mjs    summary.md, results.json, status.json, issues.json and the "In short" line

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { BASE, OUT, CHECK_DATA_SERVICES, ONLY_SERVICES, QUICK, ONLY, STEPS, PARTIAL, runsPart, RECORD } from "./live/settings.mjs";
import { record } from "./live/results.mjs";
import { recorded, replayData, replayed, askedLive, loadReplay, quietForEA } from "./live/recording.mjs";
import { isReportDataService, SERVICES, SERVICE_TOPICS, checkServices } from "./live/services.mjs";
import { DEVICES, FIXED, randomEnglishPostcode, testDevice } from "./live/devices.mjs";
import { testCountryData } from "./live/country.mjs";
import { writeSummary } from "./live/summary.mjs";

/* ---------------------------------------------------------------
   Run everything and write the summary
--------------------------------------------------------------- */
// If the app itself does not answer (for example a local server that is not running), the page steps are left
// out with one failure instead of a hundred; the data services are still checked and the summary is written.
const appAnswers = await fetch(BASE, { signal: AbortSignal.timeout(20000) }).then(r => r.ok, () => false);
let browser;
const reports = {};
try {
  if (ONLY_SERVICES.length) {
    await checkServices(SERVICES.filter(([name]) => ONLY_SERVICES.includes(name)));
    process.exit(0);
  }
  const noTopics = SERVICES.map(([name]) => name).filter(name => !SERVICE_TOPICS[name]);
  record("Data services", "Every service lists the report topics it feeds", !noTopics.length,
    noTopics.length ? "missing in SERVICE_TOPICS: " + noTopics.join("; ") : `${SERVICES.length} services`);
  // data/data-services.csv lists the report data services (one per row after the header): keep it in step with SERVICES.
  const listed = readFileSync(new URL("../data/data-services.csv", import.meta.url), "utf8").trim().split("\n").length - 1;
  const reportServices = SERVICES.filter(isReportDataService).length;
  record("Data services", "data/data-services.csv lists every report data service", listed === reportServices,
    `${listed} rows in the file, ${reportServices} report data services in the test`);
  const toCheck = !runsPart("services") ? [] : CHECK_DATA_SERVICES ? SERVICES : SERVICES.filter(s => !isReportDataService(s));
  if (!CHECK_DATA_SERVICES) console.log(`Left out on request (DATA_SERVICES=0): ${reportServices} report data services. Run the check by hand to test them.`);
  await loadReplay();
  // With the recording, the report pages send nothing live to the Environment Agency, so the services, the country
  // data and the three devices all run at once. Without it, the services come first, then the country data during
  // the wait, then the reports one at a time, each a minute after the last request to that server (its limit).
  const parallel = !!replayData;
  const services = checkServices(toCheck);
  if (!appAnswers) { await services; throw new Error(`the app does not answer at ${BASE}: start the server (see CLAUDE.md "Serve locally")`); }
  browser = await chromium.launch();
  // On replay, the third report uses the place the daily run picked, so its answers are recorded too.
  const randomPlace = replayData && replayData.randomPlace ? replayData.randomPlace : await randomEnglishPostcode();
  const places = [FIXED[0], FIXED[1], randomPlace];
  // Device numbers (in DEVICES) to test: the desktop only with QUICK; ONLY can leave out any of them.
  const devicesToTest = DEVICES.map((_, i) => i).filter(i => (!QUICK || i === 0) && runsPart(DEVICES[i].name.split(" ")[0].toLowerCase()));
  const countryData = () => QUICK || !runsPart("country") ? null : testCountryData(browser).catch(e => record("Country data (desktop)", "The country data steps crashed", false, e.message));
  const runDevice = async i => { reports[`${DEVICES[i].name}: ${places[i].join(", ")}`] = await testDevice(browser, DEVICES[i], places[i]); };
  if (parallel) await Promise.all([services, countryData(), ...devicesToTest.map(runDevice)]);
  else {
    // The services come first: the country data steps also ask OpenStreetMap's Nominatim, which allows one request a
    // second, so they do not run beside the services. They run during the wait before the first report (they answer
    // the Environment Agency map server themselves, so they send it nothing).
    await services;
    await Promise.all([countryData(), devicesToTest.length ? quietForEA() : null]);
    for (const i of devicesToTest) {
      // The Environment Agency map server allows only about 15 requests a minute from
      // one address, and one report sends about 7. Pausing before each report keeps
      // the test within that limit, like a person checking one property at a time.
      await quietForEA();
      await runDevice(i);
    }
  }
  if (replayData) record("Test run", "Report data from the daily recording", true,
    `${replayed} answers from the recording of ${String(replayData.recorded).slice(0, 10)}` +
    (askedLive.size ? `; asked live (not recorded): ${[...askedLive].sort().join(", ")}` : "; nothing asked live"));
  if (PARTIAL) record("Test run", "Partial run, to find a fault (not a full check)", true,
    [ONLY.length && `ONLY=${ONLY.join(",")}`, STEPS.length && `STEP=${STEPS.join("|")}`].filter(Boolean).join("; "));
  if (RECORD && !PARTIAL) writeFileSync(`${OUT}/recordings.json`, JSON.stringify({ recorded: new Date().toISOString(), base: BASE, randomPlace, answers: recorded }));
} catch (e) {
  record("Test run", "The test itself crashed", false, e.message);
} finally {
  if (browser) await browser.close();
}

process.exit(writeSummary(reports) ? 1 : 0);
