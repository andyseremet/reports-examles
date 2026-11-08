// Property Location Check – the report on the page: starting a check (the runner, js/runner.js, does the running),
// drawing each topic as it arrives, Try again, saved reports, the place bar and start-up from an address.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { $, escapeHTML, icon, MAP_COLOURS, okValue } from "./core.js";
import { reportKey, store } from "./store.js";
import { backupFor, byDataset, CHECKS } from "./checks/index.js";
import { shownChecks } from "./coverage.js";
import { clearForRetry, orderedResults, restartTasks, run, setRun, SLOW_NOTE_MS, startRun, topicResult, waitingFor } from "./runner.js";
import { addMapPoint, featureLayer, map, mapIsFull, openSearch, selected, setLocation, setMapFull } from "./map.js";
import { buildReportData, GUIDED_KEY, reportUrl, saveCurrentReport, SAVED_KEY, updateGuide } from "./saved.js";
import { renderSummary } from "./summary.js";
import { removeReportMap, renderMeta, renderSkeleton, renderSources, reportFeatureLayer, showCheck } from "./report.js";
import { buildChecklist, buildViewing, renderNotes, restoreTicks } from "./next-steps.js";

/* =========================================================
   RUN THE CHECKS – results appear as soon as their data arrives
========================================================= */

let reportData = null;          // the report's data, for downloads and saved reports

$("runBtn").addEventListener("click", () => runChecks());

function runChecks(options = {}) {
  if (!selected) { openSearch(); return; }
  if (!navigator.onLine) {                 // no signal: start by itself once it is back
    queuedRun = { options, name: $("siteName").value.trim() || selected.label || "this location" };
    updateOfflineBar();
    $("offlineBar").scrollIntoView({ block: "nearest" });
    return;
  }
  queuedRun = null;
  updateOfflineBar();
  const wasFull = mapIsFull;
  if (mapIsFull) setMapFull(false, true);
  const loc = {
    name: $("siteName").value.trim() || selected.label || "Selected location",
    lat: selected.lat, lon: selected.lon, radius: Number($("radius").value)
  };

  // The last saved results for this place: a topic whose service does not answer shows its earlier answer, dated.
  // Its answers arrive after this function has drawn the empty report.
  startRun(loc, { previous: findSnapshot(loc), onUpdate: showUpdate });
  reportData = null;
  $("runBtn").disabled = true;
  featureLayer.clearLayers();
  // Browser history: Back from a report returns to the search and map.
  const url = reportUrl(loc);
  if (options.fromHistory) { /* the address is already right */ }
  else if (options.fromLoad || wasFull) history.replaceState({ view: "report" }, "", url);
  else history.pushState({ view: "report" }, "", url);
  shownSearch = location.search;
  lastRunKey = reportKey(loc);
  updateStickyRun();

  renderSkeleton(loc);
  setExportEnabled(false);
  $("reportNav").classList.remove("hidden");
  $("comparePanel").classList.add("hidden");
  showPlaceBar(loc);
  $("placeBar").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- no signal ---------- */
let queuedRun = null;   // a check asked for while offline

function updateOfflineBar() {
  const bar = $("offlineBar");
  const offline = !navigator.onLine;
  bar.classList.toggle("hidden", !offline);
  if (!offline) return;
  bar.innerHTML = queuedRun
    ? `<span>You're offline. <strong>Your check of ${escapeHTML(queuedRun.name)} will start by itself</strong> when the signal returns.
        Saved properties still open.</span><button class="link-btn" type="button" id="cancelQueued">Cancel</button>`
    : `<span>You're offline. Saved properties still open; new checks need a signal.</span>`;
}
window.addEventListener("offline", updateOfflineBar);
window.addEventListener("online", () => {
  updateOfflineBar();
  if (queuedRun && selected) { const { options } = queuedRun; runChecks(options); }
});
document.addEventListener("click", e => {
  if (e.target.id === "cancelQueued") { queuedRun = null; updateOfflineBar(); }
});
updateOfflineBar();

let lastRunKey = null;
let shownSearch = location.search;   // the ?lat=… part of the address for what is on screen
const REPORT_PLACEHOLDER = $("report").innerHTML;

// With a report open, the search map and the saved list shrink to one line: "📍 Name · Change · Saved (3)".
// "Change" and "Saved" open them again above the report; running a new check shrinks them again.
function showPlaceBar(loc) {
  document.body.classList.add("report-open");     // also shows the phone tab bar (css/app.css)
  $("placeName").textContent = loc.name;
  $("placeBar").classList.remove("hidden");
  setPanelOpen("search", false);
  setPanelOpen("saved", false);
}
function hidePlaceBar() {
  document.body.classList.remove("report-open");
  $("placeBar").classList.add("hidden");
  document.body.classList.remove("hide-search", "hide-saved");
}
function setPanelOpen(which, open) {
  const btn = $(which === "search" ? "changePlace" : "showSaved");
  document.body.classList.toggle("hide-" + which, !open);
  btn.setAttribute("aria-expanded", String(open));
  updatePlaceButtons();
  if (open && which === "search") setTimeout(() => map.invalidateSize(), 50);
}
function updatePlaceButtons() {
  const n = (store.get(SAVED_KEY, []) || []).length;
  const searchOpen = !document.body.classList.contains("hide-search");
  const savedOpen = !document.body.classList.contains("hide-saved");
  $("changePlace").innerHTML = `${icon("pencil")}<span>${searchOpen ? "Hide map" : "Change"}</span>`;
  $("showSaved").innerHTML = `${icon("list")}<span>${savedOpen ? "Hide saved" : `Saved (${n})`}</span>`;
  $("showSaved").classList.toggle("hidden", !n);
}
$("changePlace").addEventListener("click", () => {
  const open = document.body.classList.contains("hide-search");
  setPanelOpen("search", open);
  if (open) $("searchPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("showSaved").addEventListener("click", () => {
  const open = document.body.classList.contains("hide-saved");
  setPanelOpen("saved", open);
  if (open) $("savedPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

// Back to the search and map, as before the report was run.
function showSearchView() {
  setRun(null);
  reportData = null;
  lastRunKey = null;
  removeReportMap();
  featureLayer.clearLayers();
  $("report").innerHTML = REPORT_PLACEHOLDER;
  hidePlaceBar();
  $("reportNav").classList.add("hidden");
  $("runBtn").disabled = false;
  shownSearch = location.search;
  updateStickyRun();
  window.scrollTo({ top: 0 });
}

window.addEventListener("popstate", () => {
  if (mapIsFull) { setMapFull(false, true); return; }      // Back closes the full-screen map first
  if (location.search === shownSearch) return;              // only the #section part changed
  if (!openReportFromAddress({ fromHistory: true })) showSearchView();
});

// A report address (?lat=..&lon=..&name=..&r=..): open its saved results, or run the checks.
// Returns false when the address has no location.
function openReportFromAddress(options) {
  const params = new URLSearchParams(location.search);
  const r = params.get("r");
  if (r && [...$("radius").options].some(o => o.value === r)) $("radius").value = r;
  if (!params.has("lat") || !params.has("lon")) return false;
  setLocation(params.get("lat"), params.get("lon"), params.get("name") || null);
  const snap = selected && findSnapshot({ lat: selected.lat, lon: selected.lon, radius: Number($("radius").value) });
  if (snap) showSnapshot(snap, options.fromHistory ? { fromHistory: true } : {}); else runChecks(options);
  return true;
}

// After 8 seconds, a report still loading names the services it is waiting for (the runner's waitingFor()).
function slowNote() {
  if (run.done || !run.startedAt || Date.now() - run.startedAt < SLOW_NOTE_MS) return "";
  const waiting = waitingFor();
  const items = Object.entries(waiting).map(([service, topics]) =>
    `<li><strong>${escapeHTML(service)}</strong>: ${topics.map(escapeHTML).join(", ")}</li>`).join("");
  return items && `<div class="notice slow-note no-print"><p>Still waiting for ${Object.keys(waiting).length > 1 ? "these services" : "this service"}.
      Topics that are ready are shown below.</p><ul>${items}</ul>
      <p class="help">A topic still waiting after 45 seconds shows “Try again”, and fills in by itself if the answer
      arrives later. <a href="status.html">Data service status</a></p></div>`;
}

const savedDate = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The runner settled a data task (key; null after 8 seconds, when recent answers fill in): draw what changed.
function showUpdate({ key, changed, done }) {
  changed.forEach(({ check, result }) => {
    // A topic not shown in this country leaves the report.
    if (!result) { const slot = $("slot-" + check.id); if (slot) slot.remove(); return; }
    showCheck(check, result);
  });
  if (key === "place") renderMeta();
  if (["landfill", "landslides", "planningNearby", "coalTips", "wasteSites"].includes(key)) replotFeatures();
  if (done) finishRun();
  else renderSummary();
}

function finishRun() {
  run.done = true;
  $("runBtn").disabled = false;
  renderSummary();
  $("checklistBox").innerHTML = buildViewing(orderedResults()) + buildChecklist(orderedResults());
  restoreTicks();
  renderSources();
  renderNotes();
  reportData = buildReportData();
  if (!run.snapshot) { saveCurrentReport(); saveSnapshot(); }
  if (!store.get(GUIDED_KEY, false)) { store.set(GUIDED_KEY, true); updateGuide(); }
  setExportEnabled(true);
}

/* ---------- saved results, so a saved property reopens instantly ---------- */
const snapKey = key => "plc-snap:" + key;

function saveSnapshot() {
  const R = run.R;
  const nearby = R.planningNearby && R.planningNearby.ok
    ? { ok: true, value: R.planningNearby.value.filter(e => ["control-of-major-accident-hazards-site", "contaminated-land"].includes(e.dataset)) }
    : null;
  store.set(snapKey(reportKey(run.loc)), {
    savedAt: new Date().toISOString(), loc: run.loc,
    results: orderedResults(),
    R: { place: R.place, landfill: R.landfill, landslides: R.landslides, coalTips: R.coalTips, wasteSites: R.wasteSites, planningNearby: nearby }
  });
}

// Show a saved report straight away, without asking the data services again.
function showSnapshot(snap, options = {}) {
  const loc = snap.loc;
  setRun({ loc, R: { loc, ...snap.R }, results: {}, done: false, snapshot: snap });
  snap.results.forEach(c => { run.results[c.id] = c; });
  reportData = null;
  featureLayer.clearLayers();
  const url = reportUrl(loc);
  if (!options.fromHistory) history.replaceState({ view: "report" }, "", url);
  shownSearch = location.search;
  lastRunKey = reportKey(loc);
  updateStickyRun();
  renderSkeleton(loc);
  const visible = shownChecks();
  CHECKS.forEach(c => {
    const slot = $("slot-" + c.id);
    const res = run.results[c.id];
    if (!slot) return;
    if (!visible.includes(c)) { slot.remove(); delete run.results[c.id]; return; }
    // Topics added to the app after this property was saved.
    const shown = res || topicResult(c, { status: "manual",
      found: "Not included in these saved results. Press “Refresh” to check it with the latest data." });
    if (!res) run.results[c.id] = shown;
    showCheck(c, shown);
  });
  replotFeatures();
  $("reportNav").classList.remove("hidden");
  showPlaceBar(loc);
  finishRun();
}

function findSnapshot(loc) {
  return store.get(snapKey(reportKey(loc)), null);
}

$("report").addEventListener("click", e => {
  if (e.target.closest("#refreshBtn") && run) runChecks({ fromHistory: true });
});

function setExportEnabled(on) {
  ["downloadHtml", "printReport", "printSummary"].forEach(id => { $(id).disabled = !on; });
}

// Phones: keep "Check this property" at the bottom of the screen until it is pressed,
// whenever the page's own button is scrolled out of view.
let runBtnVisible = true;
if ("IntersectionObserver" in window) {
  new IntersectionObserver(entries => { runBtnVisible = entries[0].isIntersecting; updateStickyRun(); })
    .observe($("runBtn"));
}
function updateStickyRun() {
  const box = $("stickyRun");
  if (!box) return;
  const pending = selected && reportKey({ lat: selected.lat, lon: selected.lon, radius: Number($("radius").value) }) !== lastRunKey;
  const show = !!pending && !runBtnVisible && !mapIsFull && window.innerWidth <= 800 && !$("confirm").classList.contains("hidden");
  box.classList.toggle("hidden", !show);
  document.body.classList.toggle("has-sticky", show);
}
$("stickyRunBtn").addEventListener("click", () => runChecks());
window.addEventListener("resize", updateStickyRun);

// "Try again" on a check that could not load: re-fetch only the data it is missing. On a saved report (which keeps
// only part of its data) it runs a fresh report instead, like Refresh (code review, 2.3.3).
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-retry]");
  if (!btn || !run) return;
  if (run.snapshot) { runChecks({ fromHistory: true }); return; }
  const retry = clearForRetry(btn.dataset.retry);
  if (!retry) return;
  retry.cleared.forEach(x => { if ($("slot-" + x.id)) showCheck(x, null); });
  setExportEnabled(false);
  renderSummary();
  restartTasks(retry.keys);
});

function plotFeatures(layer, R) {
  const nearby = okValue(R, "planningNearby");
  [
    [okValue(R, "landfill") || backupFor(R, "landfill")?.sites, MAP_COLOURS.landfill, "Old landfill site", s => s.site_name || "Unnamed"],
    [okValue(R, "landslides"), MAP_COLOURS.landslide, "Recorded landslide", s => s.name],
    [okValue(R, "coalTips"), MAP_COLOURS.coalTip, "Disused coal tip", s => [s.id || "Unnamed tip", s.category && "category " + s.category].filter(Boolean).join(", ")],
    [okValue(R, "wasteSites"), MAP_COLOURS.wasteSite, "Licensed waste site", s => [s.name || "Unnamed site", s.kinds.join(", ")].filter(Boolean).join(": ")],
    [byDataset(nearby, "control-of-major-accident-hazards-site"), MAP_COLOURS.hazard, "Major hazard site", s => s.name || ""],
    [byDataset(nearby, "contaminated-land"), MAP_COLOURS.contaminated, "Contaminated land", s => s.name || ""]
  ].forEach(([sites, colour, label, name]) => (sites || []).forEach(s => s.lat != null &&
    addMapPoint(layer, s.lat, s.lon, colour, `<strong>${label}</strong><br>` + escapeHTML(name(s)))));
}

function replotFeatures() {
  featureLayer.clearLayers();
  plotFeatures(featureLayer, run.R);
  if (reportFeatureLayer) {
    reportFeatureLayer.clearLayers();
    plotFeatures(reportFeatureLayer, run.R);
  }
}

export { openReportFromAddress, reportData, runChecks, savedDate, slowNote, snapKey, updatePlaceButtons,
  updateStickyRun };
