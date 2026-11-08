// Property Location Check kit – the app's topics for other apps and small new apps (docs/KIT.md). One file to load:
//   <script type="module" src="https://andyseremet.github.io/reports-examles/kit/v1/js/kit.js"></script>
//   <plc-topic topic="radon" postcode="S70 2TA"></plc-topic>
// or, in code: import { checkPlace } from ".../kit/v1/js/kit.js"; checkPlace({ postcode: "S70 2TA" }, { topics: ["radon"] }).
// Cards come plain (js/card.js): the host app styles them. The same rules as the app apply: missing data is "Check
// yourself", and requests to paced services (the Environment Agency map server, OpenStreetMap's Nominatim) wait their
// turn. Load one copy of the kit per page, so they share one queue.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, okValue } from "./core.js";
import { API, fetchJSON } from "./api.js";
import { CHECKS } from "./topics/index.js";
import { startRun } from "./runner.js";
import { plainLoadingCard, renderCard } from "./card.js";

const KIT_VERSION = "1";
const RADIUS_M = [250, 500, 1000, 2000];   // the search distances the app offers; 1000 by default

// The topics, in report order: { id, group, title, countries, deps, icon, … } (js/topics/).
const TOPICS = CHECKS;
const topicById = id => CHECKS.find(c => c.id === id) || null;

// A postcode's place, from postcodes.io: { lat, lon, name }. Throws a plain-English error when it is not found.
async function findPostcode(postcode) {
  const pc = String(postcode || "").trim();
  if (!pc) throw new Error("No postcode was given.");
  let r;
  try { r = (await fetchJSON(API.postcodes + "/" + encodeURIComponent(pc))).result; }
  catch (e) { throw new Error(/404/.test(e.message) ? `The postcode ${pc} was not found.` : "The postcode could not be looked up right now."); }
  if (!r) throw new Error(`The postcode ${pc} was not found.`);
  return { lat: r.latitude, lon: r.longitude, name: r.postcode };
}

// where: { postcode } or { lat, lon, name? }; radius in metres (one of RADIUS_M).
async function placeFor(where, radius = 1000) {
  if (!RADIUS_M.includes(Number(radius))) throw new Error(`The distance must be one of ${RADIUS_M.join(", ")} metres.`);
  const p = where && where.postcode ? await findPostcode(where.postcode)
    : where && Number.isFinite(Number(where.lat)) && Number.isFinite(Number(where.lon))
      ? { lat: Number(where.lat), lon: Number(where.lon), name: where.name || `${Number(where.lat).toFixed(5)}, ${Number(where.lon).toFixed(5)}` }
      : null;
  if (!p) throw new Error("Give a postcode, or a latitude and longitude.");
  return { name: where.name || p.name, lat: p.lat, lon: p.lon, radius: Number(radius) };
}

// Check some topics for one place, beside anything else running on the page. onCard(topic, result, html) is called each
// time a topic's result is ready or changes (result null: not covered in that country; html: its plain card).
// Resolves with { place, country, results } once every topic has its answer (at most about 45 seconds).
async function checkPlace(where, { topics = CHECKS.map(c => c.id), radius = 1000, onCard = null } = {}) {
  const checks = topics.map(id => topicById(id) || (() => { throw new Error(`There is no topic called "${id}".`); })());
  const loc = await placeFor(where, radius);
  return new Promise(resolve => {
    let finished = false;
    const r = startRun(loc, { checks, main: false, onUpdate: ({ changed, done }) => {
      const country = (okValue(r.R, "place") || {}).country || null;
      changed.forEach(({ check, result }) => { if (onCard) onCard(check, result, renderCard(check, result, { country })); });
      if (done && !finished) { finished = true; resolve({ place: loc, country, results: { ...r.results } }); }
    } });
  });
}

/* ---------- <plc-topic topic="radon" postcode="S70 2TA" radius="1000"> (or lat="…" lon="…" name="…") ----------
   Shows one topic's plain card. Tags on one page for the same place share one run, so no data is asked twice.
   Each new result also fires a "plc-result" event on the tag (detail: { topic, result }). */
const waitingTags = [];
function queueTag(tag) {
  waitingTags.push(tag);
  if (waitingTags.length === 1) queueMicrotask(startTags);
}
function startTags() {
  const tags = waitingTags.splice(0);
  const groups = new Map();
  for (const tag of tags) {
    const a = name => (tag.getAttribute(name) || "").trim();
    const where = a("postcode") ? { postcode: a("postcode") } : { lat: a("lat"), lon: a("lon"), name: a("name") || undefined };
    if (a("name")) where.name = a("name");
    const radius = a("radius") || "1000";
    const key = JSON.stringify([where.postcode ? where.postcode.toUpperCase().replace(/\s+/g, "") : [where.lat, where.lon], radius]);
    if (!groups.has(key)) groups.set(key, { where, radius, tags: [] });
    groups.get(key).tags.push(tag);
  }
  for (const { where, radius, tags: group } of groups.values()) runTags(where, radius, group);
}
function runTags(where, radius, tags) {
  const known = tags.filter(tag => {
    const c = topicById(tag.getAttribute("topic"));
    tag.innerHTML = c ? plainLoadingCard(c) : `<p class="plc-error">There is no topic called "${escapeHTML(tag.getAttribute("topic") || "")}".</p>`;
    return c;
  });
  if (!known.length) return;
  const ids = [...new Set(known.map(tag => tag.getAttribute("topic")))];
  checkPlace(where, { topics: ids, radius, onCard: (check, result, html) => {
    known.filter(tag => tag.getAttribute("topic") === check.id).forEach(tag => {
      tag.innerHTML = html;
      tag.dispatchEvent(new CustomEvent("plc-result", { detail: { topic: check.id, result }, bubbles: true }));
      const retry = tag.querySelector(".plc-retry");
      if (retry) retry.addEventListener("click", () => runTags(where, radius, [tag]), { once: true });
    });
  } }).catch(e => known.forEach(tag => { tag.innerHTML = `<p class="plc-error">${escapeHTML(e.message)}</p>`; }));
}
// Browsers only: the tag needs custom elements. Without them (for example in Node.js) the rest of the kit still loads,
// so code can list the topics or run checkPlace where fetch exists.
if (typeof HTMLElement !== "undefined" && typeof customElements !== "undefined" && !customElements.get("plc-topic")) {
  customElements.define("plc-topic", class PlcTopic extends HTMLElement {
    connectedCallback() {
      if (this.started) return;
      this.started = true;
      queueTag(this);
    }
  });
}

export { checkPlace, findPostcode, KIT_VERSION, RADIUS_M, topicById, TOPICS };
