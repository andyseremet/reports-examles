"use strict";
// Property Location Check – running the checks and building the report.
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
  $("toolbar").classList.remove("hidden");
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
  $("toolbar").classList.add("hidden");
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

// A topic whose data fails is tried once more by itself: after 8 seconds,
// or as soon as the signal returns if the device went offline.
// If it fails again, the topic shows a "Try again" button.
const AUTO_RETRY_MS = 8000;
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
        if (navigator.onLine) await new Promise(res => setTimeout(res, AUTO_RETRY_MS));
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
  if (country && COVERAGE[c.id] && !COVERAGE[c.id].includes(country)) return notCovered(c, country, place);
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
    run.results[c.id] = result;
    const slot = $("slot-" + c.id);
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
  CHECKS.forEach(c => {
    const slot = $("slot-" + c.id);
    const res = run.results[c.id];
    if (!slot) return;
    // Topics added to the app after this property was saved.
    const shown = res || topicResult(c, { status: "manual", gap: "saved",
      found: "Not included in these saved results. Press “Refresh” to check it with the latest data." });
    if (!res) run.results[c.id] = shown;
    showCheck(c, shown);
  });
  replotFeatures();
  $("toolbar").classList.remove("hidden");
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

/* ---------- private notes ---------- */
const notesKey = () => "plc-notes:" + reportKey(run.loc);

// "Next steps": notes, the viewing checklist and the checklist, each folded with a count so the report ends short.
function stepFold(id, title, count, body, cls = "") {
  return `<details class="step-fold ${cls}" id="${id}"><summary><h3>${title}</h3><span class="step-count">${count}</span>${moreToggle()}</summary>
    <div class="step-body">${body}</div></details>`;
}
const notesCount = text => text.trim() ? "Written" : "Empty";

function renderNotes() {
  const text = store.get(notesKey(), "");
  $("notesBox").innerHTML = stepFold("notes", "Your notes", notesCount(text), `
      <p class="help no-print">Private notes for this property, for example viewing times or questions. Saved only on this device, and included when you print or download the report.</p>
      <textarea id="notesText" rows="4" aria-label="Your notes" placeholder="e.g. Viewing on Saturday at 10am. Ask about the damp patch in the back bedroom."></textarea>
      <p class="help notes-status no-print">Saved on this device <span id="notesFlash" aria-live="polite"></span></p>
      <div class="notes-print" aria-hidden="true"></div>`, "notes");
  $("notesText").value = text;
  $("notesBox").querySelector(".notes-print").textContent = text;
}

let notesTimer = null;
document.addEventListener("input", e => {
  if (e.target.id !== "notesText" || !run) return;
  const text = e.target.value;
  $("notesBox").querySelector(".notes-print").textContent = text;
  $("notesBox").querySelector(".step-count").textContent = notesCount(text);
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    const ok = store.set(notesKey(), text);
    renderSaved();
    flashNotes(ok ? "Saved ✓" : "Not saved: see the message at the top");
  }, 400);
});
// A short "Saved ✓" after each change, read out once by screen readers.
let notesFlashTimer = null;
function flashNotes(msg) {
  const el = $("notesFlash");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(notesFlashTimer);
  notesFlashTimer = setTimeout(() => { el.textContent = ""; }, 2000);
}

// Where each result came from, and how current the data is.
function renderSources() {
  const rows = orderedResults().filter(c => c.source && c.source.name).map(c => `<tr>
      <td>${escapeHTML(c.title)}</td>
      <td>${c.source.url ? link(c.source.url, c.source.name) : escapeHTML(c.source.name)}</td>
      <td>${escapeHTML(c.dataDate || "Checked live on " + today())}</td></tr>`).join("");
  $("sourcesBox").innerHTML = `
    <p class="glossary-link">Not sure what a word means? ${link(GLOSSARY_PAGE, "What the words mean")} explains flood zones,
      radon, conservation areas and the other words in this report.</p>
    <details class="group sources-fold" id="sources">
      <summary><h2>Data sources and dates <span class="muted-count">(${plural(orderedResults().filter(c => c.source && c.source.name).length, "topic")})</span></h2></summary>
      <div class="table-wrap"><table><thead><tr><th>Topic</th><th>Source</th><th>Data date</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>`;
  prepareTables($("sourcesBox"), "Data sources");
}

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
    [okValue(R, "landfill"), MAP_COLOURS.landfill, "Old landfill site", s => s.site_name || "Unnamed"],
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

/* =========================================================
   REPORT
========================================================= */

function chip(status, text) {
  const symbol = STATUS_SYMBOL[status] ? `<span class="chip-symbol" aria-hidden="true">${STATUS_SYMBOL[status]}</span>` : "";
  return `<span class="chip ${status}">${symbol}${text || STATUS_LABEL[status] || "Checking…"}</span>`;
}

// Draw a topic in its slot. Topics with "No issue found" move into their section's folded row; others stay in
// the section's list, in the order of CHECKS.
function showCheck(c, result) {
  const slot = $("slot-" + c.id);
  if (!slot) return;
  slot.innerHTML = result ? renderCheck(result) : loadingCard(c);
  if (result) { prepareTables(slot, c.title); shortenLists(slot, c.title); }
  placeSlot(c, result ? result.status : "loading");
}
function placeSlot(c, status) {
  const slot = $("slot-" + c.id), group = $("group-" + c.group);
  if (!slot || !group) return;
  const target = group.querySelector(status === "low" ? ".fold-body" : ".group-topics");
  const order = CHECKS.map(x => x.id);
  const next = [...target.children].find(el => order.indexOf(el.id.slice(5)) > order.indexOf(c.id));
  if (slot.parentElement !== target || (next && slot.nextElementSibling !== next)) target.insertBefore(slot, next || null);
  updateFold(group);
}
function updateFold(group) {
  const fold = group.querySelector(".clear-fold");
  const ids = [...fold.querySelectorAll(".fold-body .slot")].map(el => el.id.slice(5));
  fold.hidden = !ids.length;
  const names = ids.map(id => TOPIC_ICONS[id] ? TOPIC_ICONS[id][1] : id).join(", ");
  fold.querySelector(".fold-title").innerHTML = `<span class="chip-symbol" aria-hidden="true">✓</span>${plural(ids.length, "topic")} with no issue found<span class="fold-names">: ${escapeHTML(names)}</span>`;
}

function infoButton(targetId, label) {
  return `<button class="info-btn" type="button" aria-expanded="false" aria-controls="${targetId}" aria-label="${escapeHTML(label)}">i</button>`;
}

function infoBox(targetId, html) {
  return `<div class="info-body" id="${targetId}" hidden>${html}</div>`;
}

function loadingCard(c) {
  return `<div class="check loading" aria-busy="true">
      <div><h3>${escapeHTML(c.title)}</h3><div class="skeleton"></div></div>
      <span class="chip loading">Checking…</span>
    </div>`;
}

// Tables: label each cell (shown as stacked cards on phones) and let keyboard users scroll them.
function prepareTables(container, title) {
  container.querySelectorAll(".table-wrap").forEach(wrap => {
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", (title || "Table") + " table");
    const table = wrap.querySelector("table");
    if (!table) return;
    table.classList.add("stack-table");
    const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(tr =>
      [...tr.children].forEach((td, i) => { if (heads[i]) td.setAttribute("data-label", heads[i]); }));
  });
}

// Lists of sites or sales inside a topic show the first 3 (the nearest, or the most recent), then "Show all N".
const LIST_SHOWN = 3;
function shortenLists(container, title) {
  container.querySelectorAll("table.site-list, ul.site-list").forEach((list, i) => {
    const rows = [...list.querySelectorAll(list.tagName === "UL" ? ":scope > li" : "tbody > tr")];
    if (rows.length <= LIST_SHOWN + 1) return;          // showing 3 of 4 would save nothing
    rows.slice(LIST_SHOWN).forEach(r => { r.hidden = true; r.classList.add("list-extra"); });
    const id = `${container.id}-list-${i}`;
    list.id = id;
    const label = `Show all ${rows.length}`;
    const btn = `<p class="show-all-row no-print"><button class="link-btn show-all" type="button" aria-expanded="false" aria-controls="${id}"
      data-label="${label}" aria-label="${label}: ${escapeHTML(title || "list")}">${label}</button></p>`;
    (list.closest(".table-wrap") || list).insertAdjacentHTML("afterend", btn);
  });
}
document.addEventListener("click", e => {
  const btn = e.target.closest(".show-all");
  if (!btn) return;
  const list = $(btn.getAttribute("aria-controls"));
  const show = btn.getAttribute("aria-expanded") !== "true";
  list.querySelectorAll(".list-extra").forEach(r => { r.hidden = !show; });
  btn.setAttribute("aria-expanded", String(show));
  btn.textContent = show ? "Show fewer" : btn.dataset.label;
  btn.setAttribute("aria-label", btn.textContent + btn.getAttribute("aria-label").replace(/^[^:]*/, ""));
});

// "Details" with a down arrow when closed, "Hide" with an up arrow when open (the words come from css/app.css).
function moreToggle() {
  return `<span class="more no-print" aria-hidden="true"><span class="more-text"></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>`;
}

function renderCheck(c) {
  const open = ["high", "medium", "error"].includes(c.status);
  const actions = c.actions && c.actions.length
    ? `<ul>${c.actions.map(a => `<li>${a}</li>`).join("")}</ul>`
    : "<p>Nothing more is needed for this topic.</p>";
  return `
    <details class="check ${c.status}" id="check-${c.id}" ${open ? "open" : ""}>
      <summary>
        <h3>${escapeHTML(c.title)}</h3>${chip(c.status)}
        <span class="found">${c.fromSaved ? `<strong>Saved result from ${escapeHTML(savedDate(c.fromSaved))}:</strong> ` : ""}${escapeHTML(c.found)}</span>
        ${moreToggle()}
      </summary>
      <div class="check-body">
        ${c.fromSaved ? `<p class="notice saved-answer">The data service is not answering right now, so this is <strong>your saved result
          from ${escapeHTML(savedDate(c.fromSaved))}</strong>. It may be out of date.</p>` : ""}
        ${c.status === "error" || c.fromSaved || c.gap === "down" ? `<p><button class="primary small-btn" type="button" data-retry="${c.id}">Try again</button></p>` : ""}
        <h4>What to do</h4>${actions}
        ${c.details || c.meaning ? `
        <p class="info-row"><button class="link-btn more-btn" type="button" data-info aria-expanded="false" aria-controls="about-${c.id}">More: what we found and what it means</button></p>
        <div class="info-body more-body" id="about-${c.id}" hidden>
          ${c.details ? `<h4>What we found</h4>${c.details}` : ""}
          ${c.meaning ? `<h4>What this means</h4>${c.meaning}` : ""}
        </div>` : ""}
      </div>
    </details>`;
}

function renderSkeleton(loc) {
  if (reportMap) { reportMap.remove(); reportMap = null; reportFeatureLayer = null; }
  $("report").innerHTML = `
    <div class="cover" id="reportTop">
      <h1>Property Location Report</h1>
      <p class="meta" id="reportMeta"></p>
      <div id="coverDetails"></div>
      <div id="reportMap" aria-label="Map of the property and nearby features"></div>
      <p class="map-caption print-only" id="mapCaption"></p>
      <h2 class="summary-title">Summary${infoButton("info-read", "How to read this report")}</h2>
      ${infoBox("info-read", `
        <ul class="legend-list">
          <li>${chip("high")} Something that could affect value, insurance, health or safety. Investigate before you commit.</li>
          <li>${chip("medium")} Something nearby or at a moderate level. Ask questions or order a specialist search.</li>
          <li>${chip("low")} Nothing found in the data checked. This is not a guarantee.</li>
          <li>${chip("info")} Useful local facts, for example planning restrictions.</li>
          <li>${chip("manual")} The data does not cover this place, or nothing is published: check it another way.</li>
        </ul>
        <p><strong>Please note:</strong> this is a free first look using public data. It does not replace a building survey or
          the searches your conveyancer orders. “No issue found” means nothing was found in the data we checked, not that there
          is no risk. Results are for the pin location. Tap a heading to open or close a topic. Words with a dotted line link to
          their meaning.</p>`)}
      <div id="summaryBox" aria-live="polite"></div>
      <p class="print-only print-contents"><strong>Contents:</strong> Summary · ${GROUPS.map(g => escapeHTML(g.title)).join(" · ")}
        · Next steps · Data sources and dates · Notes</p>
    </div>

    <div class="details-start">
      ${GROUPS.map(g => `
        <section class="group" id="group-${g.id}">
          <h2>${escapeHTML(g.title)}</h2>
          <p class="group-intro">${escapeHTML(g.intro)}</p>
          <div class="group-topics">${CHECKS.filter(c => c.group === g.id).map(c => `<div class="slot" id="slot-${c.id}">${loadingCard(c)}</div>`).join("")}</div>
          <details class="clear-fold" hidden><summary><span class="fold-title"></span>${moreToggle()}</summary><div class="fold-body"></div></details>
        </section>`).join("")}
    </div>

    <section class="group next-steps" id="nextSteps">
      <h2>Next steps</h2>
      <div id="notesBox"></div>
      <div id="checklistBox">
        ${stepFold("viewing", "At the viewing", "", `<p class="help">Your viewing checklist appears here when all the checks are finished.</p>`, "checklist viewing")}
        ${stepFold("checklist", "Your checklist", "", `<p class="help">Your checklist appears here when all the checks are finished.</p>`, "checklist")}
      </div>
    </section>

    <div id="sourcesBox"></div>

    <p class="help print-only live-link">Live report, with the latest data: ${escapeHTML(location.href)}</p>
    <section class="print-only notes-page" aria-hidden="true"><h2>Notes</h2>${'<div class="note-line"></div>'.repeat(24)}</section>
    <p class="help">Created with Property Location Check (version ${APP_VERSION}). Contains public sector information licensed under the Open Government
      Licence v3.0; map data © OpenStreetMap contributors, © Esri and © CARTO; Copernicus Atmosphere Monitoring Service.</p>`;

  // Drawn straight away (not behind a button), so its map pictures have loaded by the time the report is printed.
  drawReportMap(loc);
  renderMeta();
  renderSummary();
  watchSections();
  updateNavFade();
}

function renderMeta() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  $("reportMeta").innerHTML = `
    <strong>${escapeHTML(loc.name)}</strong><br>
    ${p ? `Nearest postcode ${escapeHTML(p.postcode)} · ${escapeHTML(p.admin_district || "")}${p.admin_ward ? " · " + escapeHTML(p.admin_ward) + " ward" : ""}${p.fromBackup ? " (from OpenStreetMap: postcodes.io was not answering)" : ""}<br>` : ""}
    Location ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} · Nearby search: ${formatRadius(loc.radius)} · Created ${escapeHTML(today())}`;
  $("coverDetails").innerHTML = coverDetails(loc, p);
  $("mapCaption").textContent = `Figure 1. The property and the ${formatRadius(loc.radius)} search area.`;
}

// Printed cover: the property's details as a small table (shown on paper only).
function coverDetails(loc, p) {
  const rows = [
    ["Property", loc.name],
    p && p.postcode && ["Nearest postcode", p.postcode],
    p && (p.admin_district || p.admin_ward) && ["Council and ward", [p.admin_district, p.admin_ward && p.admin_ward + " ward"].filter(Boolean).join(", ")],
    ["Search area", "within " + formatRadius(loc.radius) + " of the pin"],
    ["Report date", today()]
  ].filter(Boolean);
  return `<div class="cover-row print-only"><table class="cover-details">${rows.map(([k, v]) =>
    `<tr><th scope="row">${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`).join("")}</table>${liveQr()}</div>`;
}

// A QR code for the live report (qrcode-generator, loaded by index.html). Left out if the library did not load.
function liveQr() {
  if (typeof qrcode !== "function") return "";
  try {
    const qr = qrcode(0, "M");
    qr.addData(location.href);
    qr.make();
    return `<figure class="cover-qr">${qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true, alt: "QR code for the live report" })}
      <figcaption>Scan for the live report</figcaption></figure>`;   // the full web address is at the end of the report
  } catch (e) { return ""; }
}

// Saved results older than this are flagged, with a suggestion to refresh them.
const OLD_MONTHS = 3;
function isOld(savedAt) {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - OLD_MONTHS);
  return new Date(savedAt) < limit;
}

function renderSummary() {
  const results = orderedResults();
  const n = s => results.filter(c => c.status === s).length;
  // One line under the topic grid: each rating's symbol, colour and count (ratings with no topics are left out).
  const legend = ["high", "medium", "low", "info", "manual", "error"].filter(s => n(s))
    .map(s => `<li>${chip(s, `${n(s)} ${STATUS_LABEL[s].toLowerCase()}`)}</li>`).join("");
  const ready = results.length;
  const p = okValue(run.R, "place");
  const outsideEngland = p && p.country && p.country !== "England";
  const priority = results.filter(c => ["high", "medium"].includes(c.status))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const gaps = n("manual") + n("error");
  const notCoveredText = gaps ? ` <strong>${plural(gaps, "topic")}</strong> could not be checked here (see “Where we could not give an answer”).` : "";

  let verdict;
  if (!run.done) {
    verdict = `<p class="verdict">Checking official data… <strong>${ready} of ${CHECKS.length}</strong> topics ready.</p>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${CHECKS.length}" aria-valuenow="${ready}">
        <span style="width:${Math.round(ready / CHECKS.length * 100)}%"></span></div>${slowNote()}`;
  } else if (n("high") || n("medium")) {
    // One clear sentence, then the rest in smaller words underneath.
    const found = [n("high") && `<strong>${plural(n("high"), "thing")} to look into</strong>`,
      n("medium") && `<strong>${n("medium")} worth checking</strong>`].filter(Boolean).join(" and ");
    verdict = `<p class="verdict">We found ${found}.</p>
      <p class="verdict-sub">${plural(n("low"), "check")} found no issue.${notCoveredText}</p>`;
  } else {
    verdict = `<p class="verdict"><strong>No issues found</strong> in the ${plural(n("low") + n("info"), "check")} we ran.</p>
      <p class="verdict-sub">${notCoveredText.trim()} Still go through the checklist at the end.</p>`;
  }

  const old = run.snapshot && isOld(run.snapshot.savedAt);
  const savedNote = run.snapshot ? `<div class="notice saved-note${old ? " old" : ""}">Saved results from
      <strong>${escapeHTML(new Date(run.snapshot.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</strong>.
      ${old ? `<span><strong>These results are over ${OLD_MONTHS} months old.</strong> Official data may have changed since; refresh before relying on them.</span>` : ""}
      <button class="primary small-btn icon-label" type="button" id="refreshBtn" aria-label="Refresh with the latest data">${icon("refresh")}Refresh</button></div>` : "";
  $("summaryBox").innerHTML = `
    ${savedNote}
    ${verdict}
    <ul class="topic-strip" aria-label="All topics at a glance">
      ${CHECKS.map(c => {
        const res = run.results[c.id];
        const st = res ? res.status : "loading";
        const [icon, short] = TOPIC_ICONS[c.id];
        const label = res ? STATUS_LABEL[st] : "Checking";
        // The spoken name starts with the visible short name, so voice control users can say it.
        const name = ` ${c.title.toLowerCase()} `.includes(` ${short.toLowerCase()} `) ? c.title : `${short} (${c.title})`;
        return `<li><button type="button" class="topic ${st}" data-why="${c.id}" aria-controls="whyBox"
            aria-expanded="${run.whyId === c.id}" aria-label="${escapeHTML(name)}: ${label}. Show why">
<span class="topic-icon" aria-hidden="true">${icon}</span><span class="topic-name">${short}</span></button></li>`;
      }).join("")}
    </ul>
    ${legend ? `<ul class="rating-legend" aria-label="Topics by rating">${legend}</ul>` : ""}
    ${run.done && priority.length ? `<div class="key-findings"><h3>Key findings</h3><ol>${priority.slice(0, 3).map(c =>
      `<li>${chip(c.status)} <a href="#check-${c.id}" data-open="check-${c.id}"><strong>${escapeHTML(c.title)}</strong></a>: ${escapeHTML(c.found)}</li>`).join("")}</ol>${priority.length > 3
      ? `<p>And ${plural(priority.length - 3, "more topic")} to look into or check: see the <span class="print-only">table</span><span class="no-print">sections</span> below.</p>` : ""}</div>` : ""}
    ${glanceTable(results)}
    ${whyBox()}
    ${dataGapsBox(results)}
    ${outsideEngland ? `<div class="notice"><strong>This location is in ${escapeHTML(p.country)}.</strong>
      ${p.country === "Wales"
        ? "Topics use Welsh data where England's stops at the border. Where Wales publishes nothing (for example old landfill sites), the topic says “Check yourself”."
        : p.country === "Scotland"
        ? "Topics use Scottish data where England's stops at the border. Where Scotland publishes nothing (for example old landfill sites or sale prices), the topic says “Check yourself”."
        : p.country === "Northern Ireland"
        ? "Heritage, nature, noise and coast use Northern Ireland data. Where nothing is published openly (for example flood maps, radon or old landfill sites), the topic says “Check yourself”, with a link to the right service."
        : "Some official data only covers England. Those topics are marked “Check yourself”, with a link to the right national service."}</div>` : ""}`;
  updateToggleAll();
}

// Printed report, page 1: every topic in one table (rating symbol and label, and the one-line finding), in report order.
// On screen the topic grid does this job, so the table is shown on paper only (css/app.css, .print-only).
function glanceTable(results) {
  if (!results.length) return "";
  return `<div class="glance print-only"><h3>All topics at a glance</h3>
    <table class="glance-table"><thead><tr><th>Topic</th><th>Rating</th><th>What we found</th></tr></thead><tbody>${
      GROUPS.map(g => {
        const rows = results.filter(c => c.group === g.id);
        return rows.length ? `<tr class="glance-group"><th colspan="3" scope="colgroup">${escapeHTML(g.title)}</th></tr>` +
          rows.map(c => `<tr><td>${escapeHTML(c.title)}</td><td>${chip(c.status)}</td><td>${escapeHTML(c.found)}</td></tr>`).join("") : "";
      }).join("")
    }</tbody></table>
    <p class="glance-key">❗ Look into this: could affect value, insurance, health or safety. ⚠️ Worth checking: ask questions or
      order a search. ✓ No issue found in the data checked. ℹ️ For information. ? Check yourself: no data here.</p>
    <p class="glance-note">A free first look using public data. It does not replace a building survey or your conveyancer's
      searches. “No issue found” means nothing was found in the data we checked, not that there is no risk.</p></div>`;
}

// Topics with no real answer: why, and who to ask instead. Hidden when every topic has an answer.
const GAP_REASON = {
  coverage: "Not covered here",
  nodata: "No data found",
  down: "Service not answering",
  saved: "Not in saved results"
};

function gapKind(c) {
  if (c.status === "error" || c.fromSaved) return "down";
  return c.status === "manual" ? (c.gap || "nodata") : null;
}

const GAPS_OPEN_MAX = 3;
function dataGapsBox(results) {
  const gaps = results.filter(gapKind);
  if (!gaps.length) return "";
  const askInstead = c => {
    if (gapKind(c) === "down") {
      // On paper the button is left out, so the sentence must still read well without it.
      return `<span class="no-print"><button class="primary small-btn" type="button" data-retry="${c.id}">Try again</button>${c.source && c.source.url ? ", or " : ". "}</span>` +
        (c.source && c.source.url ? `use ${link(c.source.url, c.source.name)}. ` : "") +
        `Is it down for everyone? See ${link(new URL("status.html", location.href).href, "data service status")}.`;
    }
    if (gapKind(c) === "saved") return "Press “Refresh” above.";
    if (c.actions && c.actions.length) return c.actions[0];
    return c.source && c.source.url ? `See ${link(c.source.url, c.source.name)}.` : "Ask your conveyancer to include this in their searches.";
  };
  // Folds away with "Details / Hide" like a topic card. It starts open for up to GAPS_OPEN_MAX topics; after the
  // person opens or closes it, their choice is kept while the rest of the report loads.
  const open = run.gapsOpen ?? gaps.length <= GAPS_OPEN_MAX;
  return `<details class="gaps-box" id="gapsBox"${open ? " open" : ""}>
    <summary>
      <h3 id="gapsTitle">Where we could not give an answer</h3>
      <p>${plural(gaps.length, "topic")} could not be checked here. Missing data does not mean there is no problem, so check ${gaps.length === 1 ? "it" : "them"} another way.</p>
      ${moreToggle()}
    </summary>
    <ul>${gaps.map(c => `<li><span class="gap-reason">${GAP_REASON[gapKind(c)]}</span>
      <a href="#check-${c.id}" data-open="check-${c.id}">${escapeHTML(c.title)}</a>
      <span>${escapeHTML(c.found)}</span>
      <span class="gap-ask"><strong>Instead:</strong> ${askInstead(c)}</span></li>`).join("")}</ul>
  </details>`;
}

// The one-line reason for the topic tapped in the strip above.
function whyBox() {
  const c = run.whyId && CHECKS.find(x => x.id === run.whyId);
  if (!c) return `<div id="whyBox" hidden></div>`;
  const res = run.results[c.id];
  const st = res ? res.status : "loading";
  const text = res ? res.found : "Still checking the official data…";
  return `<div id="whyBox" class="why-box ${st}" aria-live="polite">
    <strong>${escapeHTML(c.title)}: ${res ? STATUS_LABEL[st] : "Checking"}</strong>
    <p>${escapeHTML(text || "")}</p>
    ${res ? `<a href="#check-${c.id}" data-open="check-${c.id}">Read the full section</a>` : ""}</div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-why]");
  if (!btn || !run) return;
  run.whyId = run.whyId === btn.dataset.why ? null : btn.dataset.why;
  renderSummary();
  const again = document.querySelector(`[data-why="${btn.dataset.why}"]`);
  if (again) again.focus();
});

// Fit the search circle to the map's current size (after it changes, for example for printing).
function fitReportMap() {
  if (!reportMap || !run) return;
  reportMap.invalidateSize();
  reportMap.fitBounds(L.latLng(run.loc.lat, run.loc.lon).toBounds(run.loc.radius * 2), { padding: [10, 10] });
}

function drawReportMap(loc) {
  if (reportMap) { reportMap.remove(); reportMap = null; }
  reportMap = L.map("reportMap", {
    zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false
  });
  // Set the view first: layers need a map view before they can be drawn.
  reportMap.fitBounds(L.latLng(loc.lat, loc.lon).toBounds(loc.radius * 2), { padding: [10, 10] });
  makeBasemapLayers(currentBasemap || BASEMAPS[0]).forEach(l => l.addTo(reportMap));   // same background as the main map
  L.circle([loc.lat, loc.lon], { radius: loc.radius, color: "#087f8c", weight: 2, fillOpacity: 0.05 }).addTo(reportMap);
  L.marker([loc.lat, loc.lon]).addTo(reportMap);
  reportFeatureLayer = L.layerGroup().addTo(reportMap);
}

/* ---------- checklist with ticks remembered on this device ---------- */

const plainText = html => String(html).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function buildChecklist(checks) {
  const uniq = arr => [...new Set(arr)];
  const seller = uniq([
    ...checks.flatMap(c => c.seller || []),
    "Is there, or has there ever been, Japanese knotweed on or near the property?",
    "Are there any disputes with neighbours, or shared access or drainage arrangements?"
  ]).map(escapeHTML);
  const conveyancer = uniq([
    "A local authority search (planning history, road schemes, building control).",
    "A drainage and water search.",
    ...checks.flatMap(c => c.conveyancer || [])
  ]).map(escapeHTML);
  const yourself = [
    `Check flooding from groundwater and reservoirs: ${link(LINKS.floodLongTerm, "GOV.UK long-term flood risk")}.`,
    `See the full noise maps for your street: ${link(LINKS.noise, "Defra noise maps")}.`,
    `Find the energy performance certificate (EPC): ${link(LINKS.epc, "GOV.UK")}.`,
    `Check mobile and broadband coverage: ${link(LINKS.ofcom, "Ofcom")}.`,
    "Search the council's planning website for applications nearby.",
    "Visit at different times of day, including rush hour and evening.",
    "Get a building survey (RICS Level 2 or 3), especially for older homes."
  ];
  lastChecklist = { seller: seller.map(plainText), conveyancer: conveyancer.map(plainText) };
  const list = items => `<ul>${items.map(i =>
    `<li><label class="tick"><input type="checkbox" data-tick="${escapeHTML(plainText(i))}"><span>${i}</span></label></li>`).join("")}</ul>`;
  return stepFold("checklist", "Your checklist", "", `
      <p class="help">Everything to follow up, gathered from the checks above: questions for the seller, searches for your conveyancer
        and things to check yourself.<span class="no-print"> Tick items as you go: your ticks are remembered on this device for this property.</span></p>
      <div class="send-box no-print">
        <p><strong>Send to my conveyancer:</strong> an email, or text to copy, with the link to this report, the topics to look into and the questions below.</p>
        <div class="send-buttons">
          <button class="primary icon-label" id="emailConveyancer" type="button" aria-label="Email to my conveyancer">${icon("mail")}Email</button>
          <button class="secondary icon-label" id="copyConveyancer" type="button" aria-label="Copy as text">${icon("copy")}Copy</button>
        </div>
        <p class="help" id="sendNote" role="status"></p>
      </div>
      ${tickHeading("Questions to ask the seller or estate agent", seller.length)}${list(seller)}
      ${tickHeading("Searches and reports to ask your conveyancer for", conveyancer.length)}${list(conveyancer)}
      ${tickHeading("Things to check yourself", yourself.length)}${list(yourself)}`, "checklist");
}

// "At the viewing": up to about 12 things to look for and ask on the day, the most serious topics first.
const VIEWING_MAX = { look: 7, ask: 5 };
function buildViewing(checks) {
  const flagged = checks.filter(c => ["high", "medium"].includes(c.status))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const pick = (items, max) => [...new Set(items)].slice(0, max);
  const look = pick([...flagged.flatMap(c => VIEWING_LOOK[c.id] || []), ...VIEWING_GENERAL.look], VIEWING_MAX.look);
  const ask = pick([...flagged.flatMap(c => c.seller || []), ...VIEWING_GENERAL.ask], VIEWING_MAX.ask);
  const list = items => `<ul>${items.map(i =>
    `<li><label class="tick"><input type="checkbox" data-tick="${escapeHTML(i)}"><span>${escapeHTML(i)}</span></label></li>`).join("")}</ul>`;
  return stepFold("viewing", "At the viewing", "", `
      <p class="viewing-sheet print-only"><strong>Take this page to the viewing.</strong> Tick each item as you go.</p>
      <p class="help">A short list for the day you see the property, built from this report: the topics to look into come first.<span class="no-print">
        Your ticks are remembered on this device for this property, and saved properties open without a signal.</span></p>
      ${tickHeading("Look for", look.length)}${list(look)}
      ${tickHeading("Ask on the day", ask.length)}${list(ask)}`, "checklist viewing");
}

let lastChecklist = { seller: [], conveyancer: [] };

// Each list's heading says how many of its items are ticked, e.g. "2 of 7 done".
function tickHeading(title, total) {
  return `<h4 class="tick-heading">${title} <span class="tick-count">0 of ${total} done</span></h4>`;
}
function updateTickCounts() {
  document.querySelectorAll("#checklistBox .tick-heading").forEach(h => {
    const boxes = [...h.nextElementSibling.querySelectorAll("input[data-tick]")];
    const done = boxes.filter(b => b.checked).length;
    const count = h.querySelector(".tick-count");
    count.textContent = `${done} of ${boxes.length} done`;
    count.classList.toggle("all-done", boxes.length > 0 && done === boxes.length);
  });
  // Each fold's summary adds up its lists, e.g. "2 of 12 done".
  document.querySelectorAll("#checklistBox .step-fold").forEach(f => {
    const boxes = [...f.querySelectorAll("input[data-tick]")];
    if (!boxes.length) return;
    const done = boxes.filter(b => b.checked).length;
    const count = f.querySelector(".step-count");
    count.textContent = `${done} of ${boxes.length} done`;
    count.classList.toggle("all-done", done === boxes.length);
  });
}

/* ---------- send to my conveyancer ---------- */
// Plain text for an email or a message. Nothing passes through the app: the email opens in the person's
// own email app, or the text is copied for them to paste.
function conveyancerText() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  const where = loc.name + (p && p.postcode && !loc.name.includes(p.postcode) ? ` (near ${p.postcode})` : "");
  const flagged = orderedResults().filter(c => c.status === "high" || c.status === "medium");
  const lines = [
    "Hello,", "",
    `I am looking at buying ${where}. I ran a free check of official open data for the location. The full report is here:`,
    new URL(reportUrl(loc), location.href).href, ""
  ];
  if (flagged.length) {
    lines.push("Topics to look into:");
    flagged.forEach(c => lines.push(`- ${c.title}: ${STATUS_LABEL[c.status]}. ${plainText(c.found)}`));
  } else {
    lines.push("The check found nothing rated \"Look into this\" or \"Worth checking\".");
  }
  lines.push("", "Please could you include these searches:");
  lastChecklist.conveyancer.forEach(i => lines.push("- " + i));
  lines.push("", "Questions I plan to ask the seller or estate agent:");
  lastChecklist.seller.forEach(i => lines.push("- " + i));
  lines.push("", "This check is a first look from public data and does not replace the official searches.", "", "Thank you");
  return lines.join("\n");
}

function conveyancerSubject() {
  return "Property I am buying: " + run.loc.name;
}

document.addEventListener("click", async e => {
  if (!run) return;
  if (e.target.closest("#emailConveyancer")) {
    e.preventDefault();
    $("sendNote").textContent = "Opening your email app. Add your conveyancer's address and send. If the email looks cut off, use Copy.";
    location.href = "mailto:?subject=" + encodeURIComponent(conveyancerSubject()) + "&body=" + encodeURIComponent(conveyancerText());
  }
  if (e.target.closest("#copyConveyancer")) {
    const text = conveyancerSubject() + "\n\n" + conveyancerText();
    try { await navigator.clipboard.writeText(text); $("sendNote").textContent = "Copied. Paste it into an email or message to your conveyancer."; }
    catch (err) { prompt("Copy this text:", text); }
  }
});

const ticksKey = () => "plc-ticks:" + reportKey(run.loc);

function restoreTicks() {
  const ticked = new Set(store.get(ticksKey(), []));
  document.querySelectorAll("#checklistBox input[data-tick]").forEach(box => { box.checked = ticked.has(box.dataset.tick); });
  updateTickCounts();
}

document.addEventListener("change", e => {
  const box = e.target.closest("#checklistBox input[data-tick]");
  if (!box || !run) return;
  const ticked = new Set(store.get(ticksKey(), []));
  if (box.checked) ticked.add(box.dataset.tick); else ticked.delete(box.dataset.tick);
  store.set(ticksKey(), [...ticked]);
  // A question can be in both lists: keep its boxes the same.
  document.querySelectorAll("#checklistBox input[data-tick]").forEach(b => { if (b.dataset.tick === box.dataset.tick) b.checked = box.checked; });
  updateTickCounts();
});

/* ---------- section bar, open/close all, back to top ---------- */

let sectionObserver = null;
function watchSections() {
  if (sectionObserver) sectionObserver.disconnect();
  if (!("IntersectionObserver" in window)) return;
  sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      document.querySelectorAll("#reportNav a").forEach(a => a.classList.toggle("active", a.dataset.nav === id));
      document.querySelectorAll("#tabBar [data-tab]").forEach(a =>
        a.classList.toggle("active", a.dataset.tab === id || (!!a.dataset.tabPrefix && id.startsWith(a.dataset.tabPrefix))));
      const active = document.querySelector(`#reportNav a[data-nav="${id}"]`);
      if (active) {
        const box = $("navLinks"), l = active.offsetLeft - box.offsetLeft;
        if (l < box.scrollLeft || l + active.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: l - 24, behavior: "smooth" });
        updateNavFade();
      }
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  ["reportTop", "group-flood", "group-ground", "group-living", "group-planning", "nextSteps"].forEach(id => {
    const el = $(id);
    if (el) sectionObserver.observe(el);
  });
}

// One button: "Close all" while any topic is open; otherwise "Open problems", which opens only the topics rated
// Look into this or Worth checking (opening every topic made a phone report about 28 screens long).
function allTopics() { return [...document.querySelectorAll("#report details.check, #report details.clear-fold")]; }
function problemTopics() { return [...document.querySelectorAll("#report details.check.high, #report details.check.medium")]; }
// Phone tab bar: "Problems (2)" opens the topics rated Look into this or Worth checking and goes to the first one.
function updateTabBar() {
  const n = problemTopics().length;
  $("tabProblemsText").textContent = `Problems (${n})`;
  $("tabProblems").disabled = !n;
}
$("tabProblems").addEventListener("click", () => {
  const list = problemTopics();
  if (!list.length) return;
  list.forEach(d => { d.open = true; });          // each change of "open" refreshes the buttons (toggle listener)
  const first = list.find(d => d.classList.contains("high")) || list[0];
  openTopic(first);
  first.scrollIntoView({ behavior: "smooth", block: "start" });
});

function updateToggleAll() {
  updateTabBar();
  const anyOpen = allTopics().some(d => d.open);
  $("toggleAll").textContent = anyOpen ? "Close all" : "Open problems";
  $("toggleAll").disabled = !anyOpen && !problemTopics().length;
}
$("toggleAll").addEventListener("click", () => {
  if ($("toggleAll").textContent === "Close all") allTopics().forEach(d => { d.open = false; });
  else problemTopics().forEach(d => { d.open = true; });
  updateToggleAll();
});
// Remember whether the person opened or closed the gaps box, so the next redraw keeps it that way.
document.addEventListener("click", e => {
  const sum = e.target.closest && e.target.closest("#gapsBox > summary");
  if (sum && run) run.gapsOpen = !sum.parentElement.open;
});
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("#report details.check, #report details.clear-fold")) updateToggleAll(); }, true);

// Fade the edge of the section links where more of them are hidden to the side.
function updateNavFade() {
  const el = $("navLinks");
  el.classList.toggle("more-left", el.scrollLeft > 2);
  el.classList.toggle("more-right", el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
}
$("navLinks").addEventListener("scroll", updateNavFade, { passive: true });
window.addEventListener("resize", updateNavFade);

// Links within the report (section bar, topic icons, "Key findings") scroll to their
// section without adding steps to the browser history, and open the topic they point to.
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !a.closest("#report, #reportNav, #toolbar, #tabBar")) return;
  const target = document.getElementById(a.getAttribute("href").slice(1));
  if (!target) return;
  e.preventDefault();
  if (target.tagName === "DETAILS") target.open = true;
  if (a.dataset.open && $(a.dataset.open)) openTopic($(a.dataset.open));
  target.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Open a topic card (and its "no issue found" fold, if it sits in one) and focus its heading.
function openTopic(d) {
  const fold = d.closest(".clear-fold");
  if (fold) fold.open = true;
  d.open = true;
  const s = d.querySelector("summary"); if (s) s.focus({ preventScroll: true });
}

window.addEventListener("scroll", () => {
  $("toTop").classList.toggle("hidden", window.scrollY < 700);
}, { passive: true });
$("toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
