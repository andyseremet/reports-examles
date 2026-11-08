"use strict";
// Property Location Check – running the checks: data tasks, Try again, recent answers, saved reports, the place bar and start-up from an address.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   RUN THE CHECKS – results appear as soon as their data arrives
========================================================= */

let run = null;                 // the report being built
let reportFeatureLayer = null;  // dots on the report map

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
  run = { loc, R: { loc }, results: {}, done: false, startedAt: Date.now(), previous: findSnapshot(loc) };
  const thisRun = run;
  setTimeout(() => { if (run === thisRun && !run.done) renderSummary(); }, SLOW_NOTE_MS);
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

  TASKS.forEach(([key]) => startTask(run, key));
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
  run = null;
  reportData = null;
  lastRunKey = null;
  if (reportMap) { reportMap.remove(); reportMap = null; }
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

// After 8 seconds, a report still loading names the services it is waiting for.
const SLOW_NOTE_MS = 8000;
function slowNote() {
  if (run.done || !run.startedAt || Date.now() - run.startedAt < SLOW_NOTE_MS) return "";
  const waiting = {};
  TASKS.filter(([key]) => !run.R[key]).forEach(([, topic, , service]) => (waiting[service] ||= []).push(topic));
  const items = Object.entries(waiting).map(([service, topics]) =>
    `<li><strong>${escapeHTML(service)}</strong>: ${topics.map(escapeHTML).join(", ")}</li>`).join("");
  return items && `<div class="notice slow-note no-print"><p>Still waiting for ${Object.keys(waiting).length > 1 ? "these services" : "this service"}.
      Topics that are ready are shown below.</p><ul>${items}</ul>
      <p class="help">Slow services usually answer within a minute. If one does not, its topic shows “Try again”.
      <a href="status.html">Data service status</a></p></div>`;
}

// A topic whose data fails is tried once more by itself: after 8 seconds (20 if the service refused us, which
// often lasts minutes, so it is not asked again too soon), or as soon as the signal returns if the device went offline.
// If it fails again, the topic shows a "Try again" button.
const AUTO_RETRY_MS = 8000, REFUSED_RETRY_MS = 20000;
const onlineAgain = () => navigator.onLine ? Promise.resolve()
  : new Promise(res => window.addEventListener("online", res, { once: true }));

/* ---------- recent answers: each service's answer for a place, kept 7 days, used only if that service fails ---------- */
// Optional: if the device runs out of space, the oldest places are dropped quietly (no "storage full" message).
const RECENT_DAYS = 7, RECENT_PLACES = 10, RECENT_MAX_CHARS = 200000, RECENT_INDEX = "plc-recent-index";
const recentKey = key => "plc-recent:" + key;
function rememberAnswer(loc, task, value) {
  const k = recentKey(reportKey(loc));
  try {   // optional: an answer that cannot be saved never stops the topic from showing
    if (JSON.stringify(value === undefined ? null : value).length > RECENT_MAX_CHARS) return;
    const all = store.get(k, {});
    all[task] = { at: new Date().toISOString(), value };
    const index = [k, ...store.get(RECENT_INDEX, []).filter(x => x !== k)];
    index.slice(RECENT_PLACES).forEach(x => store.remove(x));
    store.set(RECENT_INDEX, index.slice(0, RECENT_PLACES), { quiet: true });
    store.set(k, all, { quiet: true });
  } catch (e) { /* not saved: the cache is optional */ }
}
function recentAnswer(loc, task) {
  const a = store.get(recentKey(reportKey(loc)), {})[task];
  return a && Date.now() - new Date(a.at).getTime() < RECENT_DAYS * 864e5 ? a : null;
}
const forgetAnswers = key => store.remove(recentKey(key));

function startTask(r, key, autoRetry = true) {
  delete r.R[key];
  TASK_FN[key](r.loc).then(
    value => { r.R[key] = { ok: true, value }; rememberAnswer(r.loc, key, value); },
    async error => {
      if (autoRetry && r === run) {
        if (navigator.onLine) await new Promise(res => setTimeout(res, error.refused ? REFUSED_RETRY_MS : AUTO_RETRY_MS));
        else await onlineAgain();
        if (r === run) { r.autoRetried = [...(r.autoRetried || []), key]; startTask(r, key, false); }
        return "retrying";
      }
      // The service did not answer: use its answer from the last 7 days, if there is one (shown dated on the topic).
      const recent = recentAnswer(r.loc, key);
      r.R[key] = recent ? { ok: true, value: recent.value, cachedAt: recent.at }
        : { ok: false, error: error.message || "unknown error", ...(error.backup && { backup: error.backup }) };
    }
  ).then(state => { if (state !== "retrying" && r === run) onTaskSettled(key); });
}

const depsReady = c => c.deps.every(k => run.R[k]);

// A topic result with everything the report needs. Each check gives only what differs from these.
function topicResult(c, fields) {
  return { meaning: "", actions: [], seller: [], conveyancer: [], source: { name: "", url: "" }, ...fields, id: c.id, group: c.group, title: c.title };
}

function buildCheck(c) {
  const place = okValue(run.R, "place");
  const country = place && place.country;
  if (!topicShown(c.id, country)) return null;   // not covered in this country: left out (js/coverage.js)
  let result;
  try { result = topicResult(c, { dataDate: "Checked live on " + today(), ...c.build(run.R) }); }
  catch (e) { result = topicResult(c, { status: "error", found: "This check failed: " + e.message }); }
  // A service failed: show this place's saved earlier answer, dated, if there is one. A check that still answers
  // in part (for example other mining when the coal service is down) marks itself with failedService.
  if (result.status === "error" || result.failedService) return savedInstead(c, result);
  // Built partly from recent answers (a service did not answer): say so, with the oldest answer's date.
  const cached = c.deps.map(k => run.R[k] && run.R[k].cachedAt).filter(Boolean).sort()[0];
  return cached ? { ...result, fromSaved: cached } : result;
}

// A service that does not answer: if this place was checked before, show that earlier answer, clearly dated,
// with "Try again" (an answer that was itself saved earlier keeps its first date).
function savedInstead(c, failed) {
  const prev = run.previous && run.previous.results.find(r => r.id === c.id && r.status !== "error");
  if (!prev) return failed;
  const from = prev.fromSaved || run.previous.savedAt;
  return { ...prev, fromSaved: from };
}
const savedDate = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function onTaskSettled(key) {
  CHECKS.filter(c => c.deps.includes(key) && depsReady(c)).forEach(c => {
    const result = buildCheck(c);
    // A topic not shown in this country leaves the report.
    if (!result) { delete run.results[c.id]; const slot = $("slot-" + c.id); if (slot) slot.remove(); return; }
    run.results[c.id] = result;
    showCheck(c, result);
  });
  if (key === "place") renderMeta();
  if (["landfill", "landslides", "planningNearby", "coalTips", "wasteSites"].includes(key)) replotFeatures();
  if (TASKS.every(([k]) => run.R[k])) finishRun();
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
  run = { loc, R: { loc, ...snap.R }, results: {}, done: false, snapshot: snap };
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

function orderedResults() {
  return CHECKS.map(c => run.results[c.id]).filter(Boolean);
}

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

// "Try again" on a check that could not load: re-fetch only the data it is missing.
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-retry]");
  if (!btn || !run) return;
  const c = CHECKS.find(x => x.id === btn.dataset.retry);
  if (!c) return;
  let keys = c.deps.filter(k => !run.R[k] || !run.R[k].ok);
  if (!keys.length) keys = c.deps.slice();
  keys.forEach(k => {
    delete run.R[k];
    CHECKS.filter(x => x.deps.includes(k)).forEach(x => {
      delete run.results[x.id];
      const slot = $("slot-" + x.id);
      if (slot) showCheck(x, null);
    });
  });
  run.done = false;            // the report is being completed again
  setExportEnabled(false);
  renderSummary();
  keys.forEach(k => startTask(run, k, false));
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
