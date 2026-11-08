// Property Location Check – storage on this device, saved properties and compare.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { $, escapeHTML, icon, okValue, plural, STATUS_LABEL } from "./core.js";
import { TASKS } from "./tasks.js";
import { CHECKS } from "./checks/index.js";
import { forgetAnswers, orderedResults, reportData, run, snapKey, updatePlaceButtons } from "./run.js";
import { chip, isOld, OLD_MONTHS, prepareTables, renderMeta } from "./report.js";
import { downloadFile } from "./print.js";

/* =========================================================
   STORAGE – only on this device
========================================================= */

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  // quiet: for optional data (recent answers), a full or blocked storage fails silently instead of showing the bar.
  set(key, value, { quiet = false } = {}) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { if (!quiet) showStorageProblem(); return false; }   // storage full or blocked
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage blocked: nothing to remove */ }
  }
};

// Say plainly when something could not be saved, instead of losing it silently.
function showStorageProblem() { $("storageBar").classList.remove("hidden"); }
$("storageBarClose").addEventListener("click", () => $("storageBar").classList.add("hidden"));

// Ask the browser not to clear saved properties when the device is short of space.
// Most browsers decide by themselves, without asking the user.
function askToKeepData() {
  try {
    if (navigator.storage && navigator.storage.persist && !store.get("plc-persist-asked", false)) {
      navigator.storage.persist().catch(() => {});
      store.set("plc-persist-asked", true, { quiet: true });
    }
  } catch (e) {}
}
const SAVED_KEY = "plc-saved-v1";
const MAX_SAVED = 20;

function reportKey(loc) {
  return `${Number(loc.lat).toFixed(5)},${Number(loc.lon).toFixed(5)},${loc.radius}`;
}

function reportUrl(loc) {
  const params = new URLSearchParams({ lat: Number(loc.lat).toFixed(6), lon: Number(loc.lon).toFixed(6), name: loc.name, r: loc.radius });
  return location.pathname + "?" + params;
}


/* =========================================================
   SAVED PROPERTIES AND COMPARE
========================================================= */

function buildReportData() {
  const loc = run.loc;
  return {
    title: "Property Location Report",
    generatedAt: new Date().toISOString(),
    location: loc,
    place: okValue(run.R, "place"),
    checks: orderedResults().map(c => ({ id: c.id, group: c.group, title: c.title, result: STATUS_LABEL[c.status], found: c.found, dataDate: c.dataDate })),
    rawData: Object.fromEntries(TASKS.map(([k]) => [k, run.R[k]]))
  };
}

function saveCurrentReport() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  const entry = {
    key: reportKey(loc), name: loc.name, lat: loc.lat, lon: loc.lon, radius: loc.radius,
    savedAt: new Date().toISOString(),
    postcode: p ? p.postcode : "", district: p ? p.admin_district : "",
    checks: orderedResults().map(c => ({ id: c.id, title: c.title, status: c.status, found: c.found }))
  };
  const all = store.get(SAVED_KEY, []);
  const old = all.find(s => s.key === entry.key);
  if (old) { entry.starred = !!old.starred; if (old.name && old.renamed) { entry.name = old.name; entry.renamed = true; } }
  const saved = [entry, ...all.filter(s => s.key !== entry.key)];
  store.set(SAVED_KEY, trimSaved(saved));
  askToKeepData();
  renderSaved();
}

// Keep every starred property; keep the most recent others up to MAX_SAVED in total.
function trimSaved(list) {
  const starred = list.filter(s => s.starred);
  const others = list.filter(s => !s.starred).slice(0, Math.max(0, MAX_SAVED - starred.length));
  const keep = new Set([...starred, ...others].map(s => s.key));
  list.filter(s => !keep.has(s.key)).forEach(s => { store.remove(snapKey(s.key)); forgetAnswers(s.key); });
  return list.filter(s => keep.has(s.key));
}

function countChips(checks) {
  if (!Array.isArray(checks)) return "";   // an entry saved without topics never stops the list from drawing
  const n = s => checks.filter(c => c.status === s).length;
  return ["high", "medium", "low"].filter(s => n(s)).map(s => chip(s, `${n(s)} ${STATUS_LABEL[s].toLowerCase()}`)).join("");
}

// The 3-step guide shows until the first report is done (or if nothing has been saved yet on this device).
const GUIDED_KEY = "plc-guided";
function updateGuide() {
  const saved = store.get(SAVED_KEY, []);
  $("guide").classList.toggle("hidden", !!store.get(GUIDED_KEY, false) || (Array.isArray(saved) && saved.length > 0));
}

function renderSaved() {
  updateGuide();
  const raw = store.get(SAVED_KEY, []);
  const saved = Array.isArray(raw) ? [...raw].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)) : [];
  $("savedPanel").classList.toggle("hidden", !saved.length && !undoRemove);
  $("backupNote").classList.toggle("hidden", !backupDue(saved.length));
  updatePlaceButtons();
  $("savedList").innerHTML = saved.map(s => `
    <li>
      <label class="cmp" title="Select to compare"><input type="checkbox" data-compare="${escapeHTML(s.key)}" aria-label="Compare ${escapeHTML(s.name)}"><span aria-hidden="true">Compare</span></label>
      <button class="star-btn" type="button" data-star="${escapeHTML(s.key)}" aria-pressed="${s.starred ? "true" : "false"}"
        title="${s.starred ? "Remove from shortlist" : "Add to shortlist"}" aria-label="Shortlist ${escapeHTML(s.name)}">${s.starred ? "★" : "☆"}</button>
      <div class="saved-main">
        <a href="${escapeHTML(reportUrl(s))}">${escapeHTML(s.name)}</a>${store.get("plc-notes:" + s.key, "") ? ' <span class="note-mark" title="Has notes">📝</span>' : ""}
        <small>${s.postcode ? escapeHTML(s.postcode) + " · " : ""}${s.district ? escapeHTML(s.district) + " · " : ""}checked ${escapeHTML(new Date(s.savedAt).toLocaleDateString("en-GB"))}${isOld(s.savedAt) ? ` <span class="old-mark">· over ${OLD_MONTHS} months ago</span>` : ""}</small>
        <div class="mini-counts">${countChips(s.checks)}</div>
      </div>
      <div class="saved-btns">
        <button class="saved-act icon-label" type="button" data-rename="${escapeHTML(s.key)}" aria-label="Rename ${escapeHTML(s.name)}">${icon("pencil")}Rename</button>
        <button class="saved-act icon-label" type="button" data-remove="${escapeHTML(s.key)}" aria-label="Remove ${escapeHTML(s.name)}">${icon("bin")}Remove</button>
      </div>
    </li>`).join("");
  updateCompareButton();
}

// Suggest a backup once there are 5 or more saved properties and there has been
// no backup (or "Not now") in the last 30 days.
const BACKUP_MIN = 5, BACKUP_DAYS = 30;
function backupDue(count) {
  if (count < BACKUP_MIN) return false;
  const last = [store.get("plc-backup-at", null), store.get("plc-backup-later", null)]
    .filter(Boolean).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
  return !last.length || Date.now() - Math.max(...last) > BACKUP_DAYS * 86400000;
}
$("backupNow").addEventListener("click", () => { $("moveDevice").open = true; $("exportBtn").click(); });
$("backupLater").addEventListener("click", () => { store.set("plc-backup-later", new Date().toISOString()); renderSaved(); });

function selectedForCompare() {
  return [...document.querySelectorAll("#savedList input[data-compare]:checked")].map(b => b.dataset.compare);
}

// Compare takes 2 or 3 saved properties; once 3 are ticked, the other boxes are switched off.
const COMPARE_MAX = 3;
function updateCompareButton() {
  const n = selectedForCompare().length;
  $("compareBtn").disabled = n < 2;
  document.querySelectorAll("#savedList input[data-compare]").forEach(b => { b.disabled = !b.checked && n >= COMPARE_MAX; });
  $("compareHelp").textContent = n >= COMPARE_MAX ? `Ready to compare ${n}.`
    : n === 2 ? "Ready to compare 2. You can tick one more."
    : `Tick 2 or 3 properties to compare them (${n} chosen).`;
}

$("savedList").addEventListener("change", updateCompareButton);
function renameSaved(key, newName) {
  const name = newName.trim().slice(0, 80);
  if (!name) return;
  const saved = store.get(SAVED_KEY, []);
  const item = saved.find(s => s.key === key);
  if (!item) return;
  item.name = name;
  item.renamed = true;
  store.set(SAVED_KEY, saved);
  // If this property's report is open, update it too.
  if (run && reportKey(run.loc) === key) {
    run.loc.name = name;
    renderMeta();
    if (reportData) reportData.location.name = name;
    history.replaceState(history.state, "", reportUrl(run.loc));
  }
}

$("savedList").addEventListener("click", e => {
  const ren = e.target.closest("[data-rename]");
  if (ren) {
    const li = ren.closest("li");
    const linkEl = li.querySelector(".saved-main a");
    const input = document.createElement("input");
    input.className = "rename-input";
    input.value = linkEl.textContent;
    input.setAttribute("aria-label", "New name for this property");
    linkEl.replaceWith(input);
    ren.innerHTML = icon("check") + "Save";
    ren.setAttribute("aria-label", "Save the new name");
    input.focus();
    input.select();
    let finished = false;
    const finish = save => {
      if (finished) return;
      finished = true;
      if (save) renameSaved(ren.dataset.rename, input.value);
      renderSaved();
    };
    input.addEventListener("keydown", ev => {
      if (ev.key === "Enter") finish(true);
      if (ev.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    return;
  }
  const star = e.target.closest("[data-star]");
  if (star) {
    const saved = store.get(SAVED_KEY, []);
    const item = saved.find(s => s.key === star.dataset.star);
    if (item) { item.starred = !item.starred; store.set(SAVED_KEY, saved); renderSaved(); }
    return;
  }
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  removeSaved(btn.dataset.remove);
});

// Remove a saved property, with "Undo" for a short time. Its report copy is kept in memory
// until then, so Undo puts it back exactly as it was. Notes and ticks stay on the device.
const UNDO_MS = 10000;
let undoRemove = null;   // { item, index, snap, timer }
function removeSaved(key) {
  finishUndo();
  const list = store.get(SAVED_KEY, []);
  const index = list.findIndex(s => s.key === key);
  if (index < 0) return;
  const item = list[index];
  undoRemove = { item, index, snap: store.get(snapKey(key), null), timer: setTimeout(() => finishUndo(true), UNDO_MS) };
  list.splice(index, 1);
  store.set(SAVED_KEY, list);
  store.remove(snapKey(key));
  renderSaved();
  $("undoText").textContent = `Removed ${item.name}.`;
  $("undoBar").classList.remove("hidden");
  $("undoBtn").focus();
}
// End the Undo offer: the removal stays. If the Undo button had focus, keep focus in the list.
function finishUndo(timedOut) {
  if (!undoRemove) return;
  if (timedOut) forgetAnswers(undoRemove.item.key);     // removed for good: its recent answers go too
  clearTimeout(undoRemove.timer);
  undoRemove = null;
  const hadFocus = document.activeElement === $("undoBtn");
  $("undoBar").classList.add("hidden");
  if (timedOut) renderSaved();
  if (hadFocus) ($("savedPanel").classList.contains("hidden") ? $("q") : $("savedTitle")).focus();
}
$("undoBtn").addEventListener("click", () => {
  if (!undoRemove) return;
  const { item, index, snap } = undoRemove;
  const list = store.get(SAVED_KEY, []).filter(s => s.key !== item.key);
  list.splice(Math.min(index, list.length), 0, item);
  store.set(SAVED_KEY, list);
  if (snap) store.set(snapKey(item.key), snap);
  finishUndo();
  renderSaved();
  const link = [...document.querySelectorAll("#savedList [data-remove]")].find(b => b.dataset.remove === item.key);
  if (link) link.closest("li").querySelector(".saved-main a").focus();
});

/* ---------- move the saved list to another device (a small file; no account) ---------- */
$("exportBtn").addEventListener("click", () => {
  const saved = store.get(SAVED_KEY, []);
  const pick = prefix => Object.fromEntries(saved.map(s => [s.key, store.get(prefix + s.key, null)]).filter(([, v]) => v != null && v !== ""));
  const data = {
    app: "property-location-check", format: 1, exportedAt: new Date().toISOString(),
    saved, snapshots: pick("plc-snap:"), notes: pick("plc-notes:"), ticks: pick("plc-ticks:")
  };
  downloadFile("property-check-saved-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(data), "application/json");
  store.set("plc-backup-at", new Date().toISOString());
  renderSaved();
  $("transferHelp").textContent = `Exported ${plural(saved.length, "property", "properties")}. Open the file on the other device with “Import list”.`;
});

// An imported file can come from anyone, so each property is rebuilt from plain values only (code review, 8 November
// 2026): known topics, the six ratings, text that is always shown escaped. Saved report snapshots in the file are left
// out (they hold the report's HTML): a property from a file gets a fresh report when it is opened.
function cleanImported(item) {
  if (!item || typeof item !== "object") return null;
  const lat = Number(item.lat), lon = Number(item.lon), radius = Number(item.radius) || 1000;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const text = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
  const known = new Set(CHECKS.map(c => c.id));
  const savedAt = Number.isNaN(Date.parse(item.savedAt)) ? new Date().toISOString() : new Date(item.savedAt).toISOString();
  const loc = { lat, lon, radius };
  return {
    key: reportKey(loc), name: text(item.name, 120) || "Imported property", lat, lon, radius, savedAt,
    postcode: text(item.postcode, 10), district: text(item.district, 80),
    ...(item.starred === true && { starred: true }), ...(item.renamed === true && { renamed: true }),
    checks: (Array.isArray(item.checks) ? item.checks : [])
      .filter(c => c && known.has(c.id) && Object.prototype.hasOwnProperty.call(STATUS_LABEL, c.status))
      .map(c => ({ id: c.id, title: text(c.title, 120), status: c.status, found: text(c.found, 600) }))
  };
}

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "property-location-check" || !Array.isArray(data.saved)) throw new Error("not a Property Location Check file");
    const mine = store.get(SAVED_KEY, []);
    let added = 0;
    data.saved.forEach(raw => {
      const item = cleanImported(raw);
      if (!item) return;
      const from = typeof raw.key === "string" ? raw.key : item.key;   // the file's own key, for its notes and ticks
      const i = mine.findIndex(s => s.key === item.key);
      if (i < 0) { mine.push(item); added++; }
      else if (new Date(item.savedAt) > new Date(mine[i].savedAt)) mine[i] = { ...item, starred: item.starred || mine[i].starred };
      const note = data.notes && data.notes[from];
      if (typeof note === "string" && note && !store.get("plc-notes:" + item.key, "")) store.set("plc-notes:" + item.key, note.slice(0, 20000));
      const ticks = data.ticks && data.ticks[from];
      if (Array.isArray(ticks)) store.set("plc-ticks:" + item.key,
        [...new Set([...store.get("plc-ticks:" + item.key, []), ...ticks.filter(t => typeof t === "string").map(t => t.slice(0, 200))])].slice(0, 200));
    });
    store.set(SAVED_KEY, trimSaved(mine.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))));
    renderSaved();
    $("transferHelp").textContent = `Imported: ${plural(added, "new property", "new properties")}; others were updated where the file was newer.`;
  } catch (err) {
    $("transferHelp").textContent = "That file could not be imported: " + err.message + ".";
  }
});

$("compareBtn").addEventListener("click", () => {
  const saved = store.get(SAVED_KEY, []);
  const list = selectedForCompare().map(k => saved.find(s => s.key === k)).filter(Boolean);
  if (list.length < 2) return;
  const find = (s, id) => (Array.isArray(s.checks) ? s.checks : []).find(x => x.id === id);
  const cell = (s, id) => {
    const c = find(s, id);
    return c ? `${chip(c.status)}<br><small>${escapeHTML(c.found)}</small>` : "<small>Not checked</small>";
  };
  // A topic "differs" when the properties do not all have the same rating.
  const differs = id => new Set(list.map(s => (find(s, id) || {}).status || "none")).size > 1;
  // Topics that at least one of them has (a topic shown only in some countries may be in none).
  const topics = CHECKS.filter(c => list.some(s => find(s, c.id)));
  const diffCount = topics.filter(c => differs(c.id)).length;
  const head = s => `<a href="${escapeHTML(reportUrl(s))}">${escapeHTML(s.name)}</a><br><small>${escapeHTML(s.postcode || "")} · checked ${escapeHTML(new Date(s.savedAt).toLocaleDateString("en-GB"))}</small>`;
  $("compareTitle").textContent = `Comparing ${list.length === 3 ? "three" : "two"} properties`;
  $("compareBody").innerHTML = `
    <label class="diff-only"><input type="checkbox" id="diffOnly"> Show only topics that differ</label>
    <p class="help" id="diffHelp" role="status"></p>
    <div class="table-wrap"><table class="compare-table" id="compareTable">
      <thead><tr><th>Topic</th>${list.map(s => `<th>${head(s)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Overall</td>${list.map(s => `<td>${countChips(s.checks)}</td>`).join("")}</tr>
        ${topics.map(c => `<tr${differs(c.id) ? "" : ' class="same"'}><td>${escapeHTML(c.title)}</td>${list.map(s => `<td>${cell(s, c.id)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table></div>
    <p class="help">Saved results from the day each property was checked. Open a property to run its checks again with the latest data.</p>`;
  const showDiff = () => {
    const only = $("diffOnly").checked;
    $("compareTable").classList.toggle("only-diff", only);
    $("diffHelp").textContent = !diffCount ? "Every topic has the same rating for these properties."
      : only ? `Showing the ${plural(diffCount, "topic", "topics")} with different ratings, of ${topics.length}.`
      : `${plural(diffCount, "topic has", "topics have")} different ratings, of ${topics.length}.`;
  };
  $("diffOnly").disabled = !diffCount;
  $("diffOnly").addEventListener("change", showDiff);
  showDiff();
  prepareTables($("compareBody"), "Comparison");
  $("comparePanel").classList.remove("hidden");
  $("comparePanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("closeCompare").addEventListener("click", () => $("comparePanel").classList.add("hidden"));

export { buildReportData, GUIDED_KEY, renderSaved, reportKey, reportUrl, saveCurrentReport, SAVED_KEY, store,
  updateGuide };
