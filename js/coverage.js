// Property Location Check – which countries each topic covers, and the topics left out of a report elsewhere.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { andList, escapeHTML, link, okValue } from "./core.js";
import { NATIONAL } from "./national.js";
import { CHECKS, COVERAGE, TOPIC_ICONS } from "./topics/index.js";
import { run } from "./runner.js";

const topicShown = (id, country) => !country || !COVERAGE[id] || COVERAGE[id].includes(country);

function nationalService(id, country) {
  const n = NATIONAL[country] || {};
  if (["flood", "surfacewater", "pastfloods"].includes(id) && n.flood) return n.flood;
  if (id === "radon" && n.radon) return n.radon;
  if (id === "soldprices" && n.prices) return n.prices;
  return n.env || null;
}

// The topics this report shows, and those left out because their data does not cover the place's country.
const placeCountry = () => { const p = run && okValue(run.R, "place"); return p && p.country; };
const shownChecks = () => CHECKS.filter(c => topicShown(c.id, placeCountry()));
const hiddenChecks = () => CHECKS.filter(c => !topicShown(c.id, placeCountry()));

// One sentence for the country note: what is left out here, and where to check it.
function notCoveredNote() {
  const hidden = hiddenChecks(), country = placeCountry();
  if (!hidden.length) return "";
  const names = andList(hidden.map(c => TOPIC_ICONS[c.id][1].toLowerCase()));
  const services = [...new Map(hidden.map(c => nationalService(c.id, country)).filter(Boolean).map(s => [s[1], s])).values()];
  return ` Not covered here, so left out: ${escapeHTML(names)}.` +
    (services.length ? ` Check them on ${andList(services.map(s => link(s[1], s[0])))}.` : "");
}

export { notCoveredNote, shownChecks, topicShown };
