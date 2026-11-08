// Property Location Check – topic: Protected nature sites. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { andList, escapeHTML, formatRadius, LINKS, plural } from "../core.js";
import { backupFor, backupNote, byDataset, isNI, isScotland, isWales, planningList, sitesKey, unavailable } from "./helpers.js";

function checkNature(R) {
  if (isWales(R) || isScotland(R) || isNI(R)) return checkNatureDevolved(R);
  const base = {
    source: { name: "Natural England data via planning.data.gov.uk; full map on MAGIC", url: LINKS.magic }
  };
  const backup = backupFor(R, "planningNearby");
  if (!R.planningNearby.ok && !backup) return unavailable(base, R, "planningNearby");
  if (backup) base.source = { name: "Natural England (planning.data.gov.uk was not answering); full map on MAGIC", url: LINKS.magic };
  const sets = {
    "site-of-special-scientific-interest": "Site of Special Scientific Interest",
    "special-area-of-conservation": "Special Area of Conservation",
    "special-protection-area": "Special Protection Area (birds)",
    "ancient-woodland": "Ancient woodland",
    "local-nature-reserve": "Local Nature Reserve"
  };
  const found = planningList(R, "planningNearby").filter(e => sets[e.dataset]);
  const inSssi = byDataset(planningList(R, "planningPoint") || [], "site-of-special-scientific-interest").length;
  const unchecked = backup ? Object.keys(sets).filter(ds => backup.missing.includes(ds)).map(ds => sets[ds]) : [];
  return {
    ...base, status: found.length ? "info" : unchecked.length ? "manual" : "low", ...(!found.length && unchecked.length && { gap: "down" }),
    found: inSssi
      ? "The property is inside a Site of Special Scientific Interest."
      : found.length ? `${plural(found.length, "protected nature site")} within ${formatRadius(R.loc.radius)}.` +
        (unchecked.length ? ` ${andList(unchecked)} could not be checked right now.` : "")
      : unchecked.length ? `No protected nature sites found within ${formatRadius(R.loc.radius)}, but ${andList(unchecked)} could not be checked right now.`
      : `No protected nature sites within ${formatRadius(R.loc.radius)}.`,
    details: (backup ? backupNote(backup, Object.keys(sets), unchecked) : "") + (found.length ? `<ul class="site-list">${found.slice(0, 8).map(e => `<li>${escapeHTML(sets[e.dataset])}: ${escapeHTML(e.name || "unnamed")}</li>`).join("")}</ul>` : ""),
    meaning: "<p>Nature sites are usually a plus for buyers, but they can limit building work or land use nearby." +
      (inSssi ? " Inside a Site of Special Scientific Interest, many activities need consent from Natural England." : "") + "</p>"
  };
}

function checkNatureDevolved(R) {
  const scot = isScotland(R), ni = isNI(R), key = sitesKey(R);
  const base = { source: ni
    ? { name: "DAERA (Northern Ireland Environment Agency) protected areas", url: LINKS.niNatureViewer }
    : scot
    ? { name: "NatureScot protected sites and Ancient Woodland Inventory", url: LINKS.natureScotSites }
    : { name: "Natural Resources Wales protected sites and Ancient Woodland Inventory 2021 (via DataMapWales)", url: LINKS.walesNature } };
  if (!R[key].ok) return unavailable(base, R, key);
  const w = R[key].value;
  // Named sites can come back once per part, so repeats are removed; ancient woodland areas have no names, so each counts.
  const seen = new Set();
  const woods = w.nature.filter(e => e.kind === "Ancient woodland");
  const sites = w.nature.filter(e => e.kind !== "Ancient woodland")
    .filter(e => { const k = e.kind + "|" + e.name; if (seen.has(k)) return false; seen.add(k); return true; });
  const found = [...sites, ...woods];
  const inSssi = w.sssi.length > 0;
  const within = `within about ${formatRadius(R.loc.radius)}`;
  const counted = [sites.length && plural(sites.length, "protected nature site"), woods.length && plural(woods.length, "area") + " of ancient woodland"]
    .filter(Boolean).join(" and ");
  return {
    ...base, status: found.length ? "info" : "low",
    found: inSssi
      ? `The property is inside ${ni ? "an Area" : "a Site"} of Special Scientific Interest (${w.sssi[0]}).`
      : found.length ? `${counted} ${within}.` : `No protected nature sites ${within}.`,
    details: found.length ? `<ul class="site-list">${sites.slice(0, 8).map(e => `<li>${escapeHTML(e.kind)}: ${escapeHTML(e.name || "unnamed")}</li>`).join("")}${
      woods.length ? `<li>Ancient woodland: ${plural(woods.length, "area")}</li>` : ""}</ul>` : "",
    meaning: "<p>Nature sites are usually a plus for buyers, but they can limit building work or land use nearby." +
      (inSssi ? ` Inside ${ni ? "an Area" : "a Site"} of Special Scientific Interest, many activities need consent from ${scot ? "NatureScot" : ni ? "DAERA" : "Natural Resources Wales"}.` : "") + "</p>" +
      (scot ? "<p>Ancient woodland counts only woods recorded as ancient; the inventory's younger, long-established woods are left out.</p>" : "")
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const natureTopic = {
  id: "nature", group: "planning", title: "Protected nature sites",
  countries: ["England", "Scotland", "Wales", "Northern Ireland"],
  // data: only shared data (js/sources.js)
  deps: ["planningPoint", "planningNearby", "walesSites", "scotlandSites", "niSites"],
  build: checkNature,
  icon: ['<path d="M12 21v-6"/><path d="M12 15c-4 0-7-3-7-6.5C5 5.5 8 3 12 3s7 2.5 7 5.5c0 3.5-3 6.5-7 6.5z"/>', "Nature"]
};

export { checkNature, natureTopic };
