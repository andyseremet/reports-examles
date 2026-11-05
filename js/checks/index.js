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
  { id: "coal", group: "ground", title: "Coal mining", deps: ["coal"], build: checkCoal },
  { id: "radon", group: "ground", title: "Radon gas", deps: ["radon"], build: checkRadon },
  { id: "landuse", group: "ground", title: "Past use of the land: landfill and contamination", deps: ["landfill", "planningPoint", "planningNearby"], build: checkLanduse },
  { id: "landslides", group: "ground", title: "Landslides and ground movement", deps: ["landslides"], build: checkLandslides },
  { id: "coastal", group: "ground", title: "Coastal erosion", deps: ["coastal"], build: checkCoastal },
  { id: "noise", group: "living", title: "Noise: road, railway and aircraft", deps: ["noise", "railNoise"], build: checkNoise },
  { id: "air", group: "living", title: "Air quality", deps: ["planningPoint", "planningNearby", "air"], build: checkAir },
  { id: "amenities", group: "living", title: "Schools, doctors and transport", deps: ["amenities"], build: checkAmenities },
  { id: "crime", group: "living", title: "Reported crime", deps: ["crime", "crimeArea"], build: checkCrime },
  { id: "soldprices", group: "living", title: "Recent sale prices nearby", deps: ["soldPrices"], build: checkSoldPrices },
  { id: "planning", group: "planning", title: "Planning restrictions and heritage", deps: ["planningPoint", "planningNearby"], build: checkPlanning },
  { id: "trees", group: "planning", title: "Protected trees and Article 4 areas", deps: ["planningPoint", "trees"], build: checkTrees },
  { id: "nature", group: "planning", title: "Protected nature sites", deps: ["planningPoint", "planningNearby"], build: checkNature }
];

const TASK_FN = Object.fromEntries(TASKS.map(([key, , fn]) => [key, fn]));

// Short names and symbols for the row of topic icons in the summary.
const TOPIC_ICONS = {
  flood: ["🌊", "Flood"], coal: ["⛏️", "Coal"], radon: ["☢️", "Radon"], landuse: ["🗑️", "Land use"],
  landslides: ["⛰️", "Ground"], noise: ["🔊", "Noise"],
  air: ["💨", "Air"], crime: ["🚓", "Crime"], planning: ["🏛️", "Planning"], nature: ["🌳", "Nature"],
  surfacewater: ["🌧️", "Rain flood"], amenities: ["🏫", "Nearby"], trees: ["🌲", "Trees"], coastal: ["🏖️", "Coast"],
  soldprices: ["💷", "Prices"]
};

// Every check waits for the nearest-postcode lookup, which tells us the country.
CHECKS.forEach(c => { if (!c.deps.includes("place")) c.deps.push("place"); });

// Which countries each check's data covers. Outside these, the check says
// "Check yourself" and links to the right national service, instead of a
// misleading "No issue found".
const COVERAGE = {
  flood: ["England", "Scotland", "Wales"], surfacewater: ["England", "Scotland", "Wales"], landuse: ["England"], coastal: ["England"], soldprices: ["England", "Wales"], noise: ["England"],
  air: ["England"], planning: ["England"], trees: ["England"], nature: ["England"],
  crime: ["England", "Wales", "Northern Ireland"],
  coal: ["England", "Wales", "Scotland"], radon: ["England", "Wales", "Scotland"], landslides: ["England", "Wales", "Scotland"]
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
    flood: ["nidirect: flooding", "https://www.nidirect.gov.uk/"],
    gov: ["nidirect", "https://www.nidirect.gov.uk/"]
  }
};

function notCovered(c, country, place) {
  const n = NATIONAL[country] || {};
  const council = place && place.admin_district ? place.admin_district + " council" : "the local council";
  let service = n.env || n.gov;
  if (c.id === "flood" && n.flood) service = n.flood;
  if (c.id === "crime" && n.police) service = n.police;
  const covered = COVERAGE[c.id].join(", ").replace(/, ([^,]*)$/, " and $1");
  const actions = (c.id === "planning" || c.id === "nature" || c.id === "trees")
    ? [`Ask ${escapeHTML(council)}'s planning service about restrictions and protected sites.`]
    : service ? [`Check this on ${link(service[1], service[0])}.`] : [];
  return topicResult(c, {
    status: "manual", gap: "coverage",
    found: `Not covered in ${country}: the data we use covers ${covered} only.`,
    meaning: `<p>This check uses official data that only covers ${covered}, so we cannot give a result for a property in ${escapeHTML(country)}.
      Use the national service instead.</p>`,
    actions, ...(service && { source: { name: service[0], url: service[1] } })
  });
}
