// Property Location Check – the report page: topic cards, the layout, the cover, data sources and the report map.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { $, APP_VERSION, escapeHTML, formatRadius, icon, link, okValue, plural, STATUS_LABEL, STATUS_SYMBOL, today } from "./core.js";
import { CHECKS, GROUPS, TOPIC_ICONS } from "./topics/index.js";
import { orderedResults, run } from "./runner.js";
import { BASEMAPS, currentBasemap, makeBasemapLayers } from "./map.js";
import { savedDate } from "./run.js";
import { renderSummary } from "./summary.js";
import { stepFold } from "./next-steps.js";
import { updateNavFade, watchSections } from "./navigation.js";

/* =========================================================
   REPORT
========================================================= */

let reportMap = null;           // the small map in the report
let reportFeatureLayer = null;  // dots on the report map

// Remove the report map (back to the search view).
function removeReportMap() {
  if (reportMap) { reportMap.remove(); reportMap = null; }
}

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

// A topic that could not load, or shows a saved answer, offers "Try again": in its card and in the box under the grid.
const canRetry = r => r.status === "error" || !!r.fromSaved || r.gap === "down";
const retryButton = id => `<button class="primary small-btn" type="button" data-retry="${id}">Try again</button>`;

// Every topic card starts closed, problems too (owner, 8 November 2026): "Open problems", the Key findings links
// and the Problems tab open them.
function renderCheck(c) {
  const actions = c.actions && c.actions.length
    ? `<ul>${c.actions.map(a => `<li>${a}</li>`).join("")}</ul>`
    : "<p>Nothing more is needed for this topic.</p>";
  return `
    <details class="check ${c.status}" id="check-${c.id}">
      <summary>
        <h3>${escapeHTML(c.title)}</h3>${chip(c.status)}
        <span class="found">${c.fromSaved ? `<strong>Saved result from ${escapeHTML(savedDate(c.fromSaved))}:</strong> ` : ""}${escapeHTML(c.found)}</span>
        ${moreToggle()}
      </summary>
      <div class="check-body">
        ${c.fromSaved ? `<p class="notice saved-answer">${c.waiting ? "The data service is slow to answer" : "The data service is not answering right now"},
          so this is <strong>your saved result from ${escapeHTML(savedDate(c.fromSaved))}</strong>. It may be out of date.${c.waiting
          ? " It changes by itself when the answer arrives." : ""}</p>` : ""}
        ${canRetry(c) ? `<p>${retryButton(c.id)}</p>` : ""}
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
      <div class="summary-head">
        <h2 class="summary-title">Summary${infoButton("info-read", "How to read this report")}</h2>
        <span class="share-note no-print" id="shareNote" role="status"></span>
        <button class="icon-btn no-print" id="shareBtn" type="button" title="Share" aria-label="Share this report">${icon("share", 20)}</button>
        <button class="icon-btn no-print" id="printSummary" type="button" title="Print summary" aria-label="Print summary" disabled>${icon("printer", 20)}</button>
      </div>
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
      <div class="keep-row no-print">
        <button class="secondary icon-label" id="downloadHtml" type="button" disabled>${icon("download")}Download report</button>
        <button class="secondary icon-label" id="printReport" type="button" disabled>${icon("printer")}Print full report</button>
      </div>
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
    <p class="help print-only report-credits">Created with Property Location Check (version ${APP_VERSION}). Contains public sector information licensed under the Open Government
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
    <span class="coords">Location ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} · </span>Nearby search: ${formatRadius(loc.radius)} · Created ${escapeHTML(today())}`;
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

// Where each result came from, and how current the data is.
function renderSources() {
  const rows = orderedResults().filter(c => c.source && c.source.name).map(c => `<tr>
      <td>${escapeHTML(c.title)}</td>
      <td>${c.source.url ? link(c.source.url, c.source.name) : escapeHTML(c.source.name)}</td>
      <td>${escapeHTML(c.dataDate || "Checked live on " + today())}</td></tr>`).join("");
  $("sourcesBox").innerHTML = `
    <details class="sources-fold" id="sources">
      <summary>Data sources and dates</summary>
      <h2 class="print-only">Data sources and dates</h2>
      <div class="table-wrap"><table><thead><tr><th>Topic</th><th>Source</th><th>Data date</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>`;
  prepareTables($("sourcesBox"), "Data sources");
}

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

export { canRetry, chip, fitReportMap, isOld, moreToggle, OLD_MONTHS, prepareTables, removeReportMap, renderMeta,
  renderSkeleton, renderSources, reportFeatureLayer, reportMap, retryButton, showCheck };
