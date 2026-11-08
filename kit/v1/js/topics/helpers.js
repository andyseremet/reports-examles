// Property Location Check – helpers the topics share: how a failed or backed-up source is worded, the country of the
// place, and the flood zone wording used by more than one flood topic.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, okValue } from "../core.js";

/* =========================================================
   Each topic turns raw data into a plain-English result:
   { id, group, title, status, found, details, meaning, actions[],
     seller[], conveyancer[], source:{name,url}, dataDate }
========================================================= */

// Flood Zones 1 to 3 (England and Wales): the rating and a one-line finding.
const zoneLevel = z => z >= 3 ? 3 : z === 2 ? 2 : 1;

const zoneNumber = text => text ? zoneLevel(Number((String(text).match(/\d/) || [1])[0])) : 1;

const ZONE_STATUS = { 3: "high", 2: "medium", 1: "low" };

function zoneFound(level, from, nameZone1 = true) {
  const chance = { 3: "High", 2: "Medium", 1: "Low" }[level];
  return `${chance} chance of flooding from ${from}` + (level > 1 || nameZone1 ? ` (Flood Zone ${level}).` : ".");
}

// SEPA likelihoods: high about 10% each year, medium 0.5%, low 0.1%.
const SEPA_CHANCE = { High: "about a 1 in 10 chance each year", Medium: "about a 1 in 200 chance each year", Low: "about a 1 in 1,000 chance each year" };

const LEVEL_STATUS = { High: "high", Medium: "medium", Low: "low" };

function byDataset(list, dataset) {
  return (list || []).filter(e => e.dataset === dataset);
}

// True for an address in Wales, where some topics use Welsh data (DataMapWales) instead of England's.
function isWales(R) {
  return okValue(R, "place")?.country === "Wales";
}

// True for an address in Scotland, where some topics use Scottish data instead of England's.
function isScotland(R) {
  return okValue(R, "place")?.country === "Scotland";
}

// True for an address in Northern Ireland, where some topics use DAERA and Department for Communities data.
function isNI(R) {
  return okValue(R, "place")?.country === "Northern Ireland";
}

// The data task with Welsh, Scottish or Northern Ireland heritage, nature and air hotspots for this address.
const sitesKey = R => isScotland(R) ? "scotlandSites" : isNI(R) ? "niSites" : "walesSites";

// planning.data.gov.uk did not answer, but Historic England and Natural England did (see planningBackup in js/data.js).
// Returns the entities to use, or null when the main source answered or no backup did.
const backupFor = (R, key) => R[key] && !R[key].ok && R[key].backup ? R[key].backup : null;

const planningList = (R, key) => R[key] && R[key].ok ? R[key].value : (backupFor(R, key) ? backupFor(R, key).entities : null);

// Who answered a topic's datasets from the backup, e.g. "Historic England and Natural England".
const backupFrom = (backup, datasets) => [...new Set(datasets.map(d => backup.from[d]).filter(Boolean))].join(" and ");

// A note for a topic answered from the backup, naming what could not be checked.
function backupNote(backup, datasets, missingNames) {
  return `<p class="notice backup-note-topic"><strong>planning.data.gov.uk is not answering</strong>, so this came from
    ${escapeHTML(backupFrom(backup, datasets))} instead.${missingNames.length ? ` Not checked this time: ${missingNames.map(escapeHTML).join(", ")}.` : ""}
    Try again later for the full check.</p>`;
}

function unavailable(base, R, key) {
  return {
    ...base, status: "error",
    found: "This check could not be completed right now: " + R[key].error + ".",
    meaning: R[key].slow
      ? "<p>The official data service is slow to answer. This topic fills in by itself if the answer arrives, or press Try again.</p>"
      : "<p>The official data service did not respond. Try again later, or use the official service linked below.</p>"
  };
}

// Short names and symbols for the row of topic icons in the summary.
// Each topic's thin line icon (drawn like the share and print icons, 24 × 24) and its short name in the summary grid.
const WAVE = y => `<path d="M2 ${y}c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>`;

export { backupFor, backupFrom, backupNote, byDataset, isNI, isScotland, isWales, LEVEL_STATUS, planningList,
  SEPA_CHANCE, sitesKey, unavailable, WAVE, ZONE_STATUS, zoneFound, zoneLevel, zoneNumber };
