"use strict";
// Property Location Check – shared check helpers and the list of report topics (CHECKS). Loaded after the section files.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   CHECKS – each turns raw data into a plain-English result:
   { id, group, title, status, found, details, meaning, actions[],
     seller[], conveyancer[], source:{name,url}, dataDate }
========================================================= */

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
    meaning: "<p>The official data service did not respond. Try again later, or use the official service linked below.</p>"
  };
}


const GROUPS = [
  { id: "flood", title: "Flooding", intro: "Flood risk from rivers, the sea and heavy rain." },
  { id: "ground", title: "Ground and land", intro: "What is in or under the ground: mining, radon, landfill, contamination, ground movement and coastal erosion." },
  { id: "living", title: "Living environment", intro: "What it is like to live here: noise, air quality, nearby schools, doctors and transport, crime, and recent sale prices." },
  { id: "planning", title: "Planning and surroundings", intro: "Rules that affect changes to the property, and protected places nearby." }
];

// Each check, the data it needs, and where it appears in the report.
const CHECKS = [
  { id: "flood", group: "flood", title: "Flooding from rivers and the sea", deps: ["planningPoint", "planningNearby", "floodNational"], build: checkFlood },
  { id: "surfacewater", group: "flood", title: "Flooding from heavy rain (surface water)", deps: ["surfaceWater", "floodNational"], build: checkSurfaceWater },
  { id: "coal", group: "ground", title: "Mining (coal and other)", deps: ["coal", "otherMining"], build: checkCoal },
  { id: "radon", group: "ground", title: "Radon gas", deps: ["radon"], build: checkRadon },
  { id: "landuse", group: "ground", title: "Past use of the land: landfill and contamination", deps: ["landfill", "planningPoint", "planningNearby", "coalTips", "wasteSites"], build: checkLanduse },
  { id: "landslides", group: "ground", title: "Landslides and ground movement", deps: ["landslides"], build: checkLandslides },
  { id: "clay", group: "ground", title: "Shrinking and swelling clay", deps: ["shrinkSwell"], build: checkClay },
  { id: "coastal", group: "ground", title: "Coastal erosion", deps: ["coastal"], build: checkCoastal },
  { id: "noise", group: "living", title: "Noise: road, railway and aircraft", deps: ["noise", "railNoise"], build: checkNoise },
  { id: "air", group: "living", title: "Air quality", deps: ["planningPoint", "planningNearby", "air", "walesSites", "scotlandSites", "niSites"], build: checkAir },
  { id: "amenities", group: "living", title: "Schools, doctors and transport", deps: ["amenities"], build: checkAmenities },
  { id: "crime", group: "living", title: "Reported crime", deps: ["crime", "crimeArea", "simdCrime"], build: checkCrime },
  { id: "soldprices", group: "living", title: "Recent sale prices nearby", deps: ["soldPrices"], build: checkSoldPrices },
  { id: "planning", group: "planning", title: "Planning restrictions and heritage", deps: ["planningPoint", "planningNearby", "walesSites", "scotlandSites", "niSites"], build: checkPlanning },
  { id: "nature", group: "planning", title: "Protected nature sites", deps: ["planningPoint", "planningNearby", "walesSites", "scotlandSites", "niSites"], build: checkNature }
];

// The viewing checklist ("At the viewing"): things to see or hear on the day, for topics rated
// "Look into this" or "Worth checking". General checks are added for every property.
const VIEWING_LOOK = {
  flood: ["Water marks, staining or new plaster low on the walls, and flood doors, barriers or raised air bricks."],
  surfacewater: ["Where rain would run: slopes towards the house, low doorways, blocked drains or gullies in the street."],
  coal: ["Cracks over doors and windows, sloping floors, or doors that stick (signs of ground movement)."],
  radon: ['<path d="M3 20h18"/><path d="M8 17c0-2 2-2 2-4s-2-2-2-4M12 17c0-2 2-2 2-4s-2-2-2-4M16 17c0-2 2-2 2-4s-2-2-2-4"/>', "Radon"],   // gas rising from the ground
  landuse: ["Signs of past industrial use nearby: bare or patchy ground, vent pipes or fenced-off land."],
  landslides: ["Cracks in walls, paths or garden walls, leaning walls or fences, and wet or slipping slopes."],
  clay: ["Cracks wider than a coin near doors and windows, and big trees close to the house (their roots dry out clay)."],
  coastal: ["How far the house is from the cliff edge or shore, and the state of any sea defences."],
  noise: ["Listen inside and in the garden with a window open, and look at the glazing on the noisy side."],
  air: ["Busy roads, junctions or works close by, and which rooms face them."]
};
const VIEWING_GENERAL = {
  look: [
    "Damp or mould: musty smells, stains on ceilings and walls, peeling paint.",
    "Roof, gutters and walls from outside: missing tiles, cracks, plants growing from gutters.",
    "Water pressure: run a tap and flush a toilet.",
    "Phone signal in the main rooms."
  ],
  ask: [
    "How old are the boiler and the windows, and when was the boiler last serviced?",
    "Why is the seller moving, and how long have they lived here?",
    "What is included in the sale?"
  ]
};

const TASK_FN = Object.fromEntries(TASKS.map(([key, , fn]) => [key, fn]));

// Short names and symbols for the row of topic icons in the summary.
// Each topic's thin line icon (drawn like the share and print icons, 24 × 24) and its short name in the summary grid.
const WAVE = y => `<path d="M2 ${y}c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>`;
const TOPIC_ICONS = {
  flood: [WAVE(9) + WAVE(14) + WAVE(19), "Flood"],
  surfacewater: ['<path d="M7 15a4 4 0 1 1 .6-8 5 5 0 0 1 9.4 1.6A3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>', "Rain flood"],
  coal: ['<path d="M4 20l9-9"/><path d="M11 5c3.5-1.5 7-.5 9 2-3-.8-5.5-.3-7.5 1.5"/><path d="M11 5l-2 2 4 4 2-2"/>', "Mining"],
  radon: ['<circle cx="12" cy="12" r="1.8"/><path d="M10.5 10.5 7 5.2A8 8 0 0 0 4 12h6M14 12h6a8 8 0 0 0-3-6.8l-3.5 5.3M13 13.6l3 5.3a8 8 0 0 1-8 0l3-5.3"/>', "Radon"],
  landuse: [ICON_PATHS.bin, "Land use"],
  landslides: ['<path d="M3 20l6-10 4 6 3-4 5 8z"/>', "Ground"],
  clay: ['<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 12h18M9 5v7M15 12v7"/>', "Clay"],
  coastal: ['<path d="M3 20V8l5-2 3 4h2v10"/>' + '<path d="M13 17c2 0 2-1.5 4-1.5s2 1.5 4 1.5"/>', "Coast"],
  noise: ['<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>', "Noise"],
  air: ['<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>', "Air"],
  amenities: ['<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>', "Nearby"],
  crime: ['<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', "Crime"],
  soldprices: ['<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5A2.5 2.5 0 0 0 10 10v6M8 16h8M8.5 12.5h4.5"/>', "Prices"],
  planning: ['<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>', "Planning"],
  nature: ['<path d="M12 21v-6"/><path d="M12 15c-4 0-7-3-7-6.5C5 5.5 8 3 12 3s7 2.5 7 5.5c0 3.5-3 6.5-7 6.5z"/>', "Nature"]
};

// Every check waits for the nearest-postcode lookup, which tells us the country.
CHECKS.forEach(c => { if (!c.deps.includes("place")) c.deps.push("place"); });

// Which countries each check's data covers. Outside these, the check says
// "Check yourself" and links to the right national service, instead of a
// misleading "No issue found".
const COVERAGE = {
  flood: ["England", "Scotland", "Wales"], surfacewater: ["England", "Scotland", "Wales"], landuse: ["England", "Scotland", "Wales"],
  coastal: ["England", "Scotland", "Wales", "Northern Ireland"], soldprices: ["England", "Wales"], noise: ["England", "Scotland", "Wales", "Northern Ireland"],
  air: ["England", "Scotland", "Wales", "Northern Ireland"], planning: ["England", "Scotland", "Wales", "Northern Ireland"],
  nature: ["England", "Scotland", "Wales", "Northern Ireland"],
  crime: ["England", "Scotland", "Wales", "Northern Ireland"],
  coal: ["England", "Wales", "Scotland"], radon: ["England", "Wales", "Scotland"], landslides: ["England", "Wales", "Scotland"], clay: ["England", "Wales", "Scotland"]
};

const NATIONAL = {
  "Scotland": {
    env: ["SEPA (Scottish Environment Protection Agency)", "https://www.sepa.org.uk/"],
    flood: ["SEPA flood maps", "https://map.sepa.org.uk/floodmaps"],
    police: ["Police Scotland", "https://www.scotland.police.uk/"]
  },
  "Wales": {
    env: ["Natural Resources Wales", "https://naturalresources.wales/"],
    flood: ["Natural Resources Wales flood maps", "https://flood-risk-maps.naturalresources.wales/"]
  },
  "Northern Ireland": {
    env: ["DAERA (Department of Agriculture, Environment and Rural Affairs)", "https://www.daera-ni.gov.uk/"],
    flood: ["Flood Maps NI (Department for Infrastructure)", "https://www.infrastructure-ni.gov.uk/topics/rivers-and-flooding/flood-maps-ni"],
    gov: ["nidirect", "https://www.nidirect.gov.uk/"]
  }
};

function notCovered(c, country, place) {
  const n = NATIONAL[country] || {};
  const council = place && place.admin_district ? place.admin_district + " council" : "the local council";
  let service = n.env || n.gov;
  if ((c.id === "flood" || c.id === "surfacewater") && n.flood) service = n.flood;
  if (c.id === "crime" && n.police) service = n.police;
  const covered = COVERAGE[c.id].join(", ").replace(/, ([^,]*)$/, " and $1");
  const actions = (c.id === "planning" || c.id === "nature")
    ? [`Ask ${escapeHTML(council)}'s planning service about restrictions and protected sites.`]
    : service ? [`Check this on ${link(service[1], service[0])}.`] : [];
  return topicResult(c, {
    status: "manual",
    found: `Not covered in ${country}: the data we use covers ${covered} only.`,
    meaning: `<p>This check uses official data that only covers ${covered}, so we cannot give a result for a property in ${escapeHTML(country)}.
      Use the national service instead.</p>`,
    actions, ...(service && { source: { name: service[0], url: service[1] } })
  });
}
