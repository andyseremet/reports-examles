// Property Location Check – which countries each topic covers, and the topics left out of a report elsewhere.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { andList, escapeHTML, link, okValue } from "./core.js";
import { CHECKS, TOPIC_ICONS } from "./checks/index.js";
import { run } from "./runner.js";

// Which countries each topic's data covers. Outside them the topic is left out of the report (owner, 8 November
// 2026), and the country note in the summary names it, with links to the national services (notCoveredNote).
// Missing data inside a covered country is still rated "Check yourself", never hidden.
const COVERAGE = {
  flood: ["England", "Scotland", "Wales"], surfacewater: ["England", "Scotland", "Wales"], landuse: ["England", "Scotland", "Wales"],
  pastfloods: ["England", "Wales"],
  coastal: ["England", "Scotland", "Wales", "Northern Ireland"], soldprices: ["England", "Wales"], noise: ["England", "Scotland", "Wales", "Northern Ireland"],
  air: ["England", "Scotland", "Wales", "Northern Ireland"], planning: ["England", "Scotland", "Wales", "Northern Ireland"],
  nature: ["England", "Scotland", "Wales", "Northern Ireland"],
  crime: ["England", "Scotland", "Wales", "Northern Ireland"],
  coal: ["England", "Wales", "Scotland"], radon: ["England", "Wales", "Scotland"], landslides: ["England", "Wales", "Scotland"], clay: ["England", "Wales", "Scotland"]
};
const topicShown = (id, country) => !country || !COVERAGE[id] || COVERAGE[id].includes(country);

// The national service to use instead, for a topic left out in that country.
const NATIONAL = {
  "Scotland": {
    env: ["SEPA (Scottish Environment Protection Agency)", "https://www.sepa.org.uk/"],
    flood: ["SEPA flood maps", "https://map.sepa.org.uk/floodmaps"],
    prices: ["Registers of Scotland", "https://www.ros.gov.uk/"],
    police: ["Police Scotland", "https://www.scotland.police.uk/"]   // also used by checkCrime
  },
  "Wales": {
    env: ["Natural Resources Wales", "https://naturalresources.wales/"],
    flood: ["Natural Resources Wales flood maps", "https://flood-risk-maps.naturalresources.wales/"]
  },
  "Northern Ireland": {
    env: ["DAERA (Department of Agriculture, Environment and Rural Affairs)", "https://www.daera-ni.gov.uk/"],
    flood: ["Flood Maps NI (Department for Infrastructure)", "https://www.infrastructure-ni.gov.uk/topics/rivers-and-flooding/flood-maps-ni"],
    radon: ["UKHSA radon maps", "https://www.ukradon.org/"],
    prices: ["nidirect", "https://www.nidirect.gov.uk/"]
  }
};
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

export { COVERAGE, NATIONAL, notCoveredNote, shownChecks, topicShown };
