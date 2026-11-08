// Property Location Check – Next steps: private notes, the viewing checklist, the checklist with ticks, and Send to my conveyancer.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { $, escapeHTML, icon, link, LINKS, okValue, STATUS_LABEL, STATUS_ORDER } from "./core.js";
import { reportKey, store } from "./store.js";
import { VIEWING_GENERAL, VIEWING_LOOK } from "./topics/index.js";
import { orderedResults, run } from "./runner.js";
import { renderSaved, reportUrl } from "./saved.js";
import { moreToggle } from "./report.js";

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
      <div class="send-box no-print">
        <div class="send-buttons"><strong>Send to my conveyancer</strong>
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

export { buildChecklist, buildViewing, conveyancerText, renderNotes, restoreTicks, stepFold };
