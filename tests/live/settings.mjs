// The live check's settings: where to test, what to run (environment variables) and shared constants.
import { mkdirSync } from "node:fs";

export const BASE = process.env.BASE || "https://andyseremet.github.io/reports-examles/";
export const OUT = process.env.OUT || "test-results";
export const ORIGIN = "https://andyseremet.github.io";
export const UA = "property-location-check-tests (https://github.com/andyseremet/reports-examles)";
mkdirSync(OUT, { recursive: true });
// QUIET=1 prints only warnings, failures and the total (shorter output to read). On GitHub, each failure
// and warning is also an annotation, so it shows on the pull request without opening the full log.
export const QUIET = process.env.QUIET === "1";
export const ON_GITHUB = process.env.GITHUB_ACTIONS === "true";
// DATA_SERVICES=0 leaves out the outside services that only supply report data (the list in data/data-services.csv):
// pull requests do this, so they test the app itself. The daily run and manual runs (by default) check them all.
// The postcode lookup and address search (marked alwaysChecked) are always checked: the app needs them to find the place.
export const CHECK_DATA_SERVICES = process.env.DATA_SERVICES !== "0";
// ONLY_SERVICES="name|name": check just these data services and stop (after-merge.sh asks failed ones again).
export const ONLY_SERVICES = (process.env.ONLY_SERVICES || "").split("|").filter(Boolean);
// QUICK=1 (after-merge.sh): the data services and the desktop only (every desktop step, one full report); the pull
// request check has already run every step on the same code, and the daily run still does.
export const QUICK = process.env.QUICK === "1";
// To find a fault faster, run only part of the test (owner, 8 November 2026). Never used by the workflow.
// ONLY=services,country,desktop,phone,tablet: these parts only (any of them, comma-separated).
// STEP="name|name": only the steps whose name contains one of these (any case). On a device, the steps that every
// later step needs (open, search, report) always run; a step that relies on an earlier one (for example a saved
// property) needs that one named too. A partial run says so in its results and saves no recording.
export const ONLY = (process.env.ONLY || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
export const STEPS = (process.env.STEP || "").toLowerCase().split("|").map(s => s.trim()).filter(Boolean);
export const PARTIAL = ONLY.length > 0 || STEPS.length > 0;
export const PARTS = ["services", "country", "desktop", "phone", "tablet"];
const unknownParts = ONLY.filter(p => !PARTS.includes(p));
if (unknownParts.length) {   // a misspelt part would quietly run nothing and still pass
  console.error(`ONLY: no part called ${unknownParts.join(", ")}. The parts are: ${PARTS.join(", ")}.`);
  process.exit(2);
}
export const runsPart = part => !ONLY.length || ONLY.includes(part);
export const NEEDED_STEPS = ["Page opens with the search ready", "Search finds the postcode", "Report runs with every topic"];
export const stepChosen = name => !STEPS.length || NEEDED_STEPS.includes(name) || STEPS.some(s => name.toLowerCase().includes(s));

// Steady pull request checks (2.0.0, quiz of 7 November 2026). RECORD=1 (daily and manual runs) saves each answer the
// report pages get from outside data services to recordings.json, which the workflow publishes to the "status" branch.
// REPLAY=<address or file> (pull requests) answers the report pages from that copy, so an outside outage cannot turn a
// pull request red. A question that was never recorded (for example a new topic) is asked live and named in the result.
// Only data requests (fetch/XHR) from the page to other sites are recorded or replayed: map pictures, the app's own
// files and the map library (which sw.js downloads for offline use) stay live.
// A test step's own stub (page.route) always comes first, so stubs are never recorded and still apply on replay.
export const RECORD = process.env.RECORD === "1";
// REPLAY=daily is short for the daily recording on the status branch (local runs; with none yet, all is asked live).
export const DAILY_RECORDING = "https://raw.githubusercontent.com/andyseremet/reports-examles/status/recordings.json";
export const REPLAY = process.env.REPLAY === "daily" ? DAILY_RECORDING : process.env.REPLAY || "";

// The Environment Agency map server sometimes refuses GitHub's shared test machines
// outright ("403 Forbidden") for many minutes, while answering everyone else. That
// refusal, and only that, is recorded as a warning instead of a failure. Anything
// else from this server (slow, wrong content, other errors) still fails.
export const EA_MAP_SERVER = "environment.data.gov.uk/spatialdata/";
export const EA_TOPICS = ["surfacewater", "landuse", "coastal", "noise"];
export const EA_REFUSAL_NOTE = "the Environment Agency map server refused GitHub's test machine (403), as it often does with GitHub's shared machines; if this repeats for days, check the live site by hand";

// A minute between reports keeps the Environment Agency map server under its limit. Not used when the report pages
// are answered from the recording (REPLAY): then the devices run at the same time.
// The minute counts from the last request actually sent to that server (by a data service check or a page), not
// from the end of the previous device's steps, most of which send it nothing (owner, 8 November 2026).
export const PAUSE_BEFORE_REPORT_MS = Number(process.env.PAUSE_MS ?? 60000);
