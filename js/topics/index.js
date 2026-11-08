// Property Location Check – the list of report topics (CHECKS), in report order, and what the report reads from them.
// Each topic is one file in js/topics/ (docs/CODE.md, "Adding a topic").
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { floodTopic } from "./flood.js";
import { surfacewaterTopic } from "./surfacewater.js";
import { pastfloodsTopic } from "./pastfloods.js";
import { coalTopic } from "./coal.js";
import { radonTopic } from "./radon.js";
import { landuseTopic } from "./landuse.js";
import { landslidesTopic } from "./landslides.js";
import { clayTopic } from "./clay.js";
import { coastalTopic } from "./coastal.js";
import { noiseTopic } from "./noise.js";
import { airTopic } from "./air.js";
import { amenitiesTopic } from "./amenities.js";
import { crimeTopic } from "./crime.js";
import { soldpricesTopic } from "./soldprices.js";
import { planningTopic } from "./planning.js";
import { natureTopic } from "./nature.js";

const GROUPS = [
  { id: "flood", title: "Flooding", intro: "Flood risk from rivers, the sea and heavy rain." },
  { id: "ground", title: "Ground and land", intro: "What is in or under the ground: mining, radon, landfill, contamination, ground movement and coastal erosion." },
  { id: "living", title: "Living environment", intro: "What it is like to live here: noise, air quality, nearby schools, doctors and transport, crime, and recent sale prices." },
  { id: "planning", title: "Planning and surroundings", intro: "Rules that affect changes to the property, and protected places nearby." }
];

// Each topic, in report order.
const CHECKS = [
  floodTopic, surfacewaterTopic, pastfloodsTopic, coalTopic, radonTopic, landuseTopic, landslidesTopic, clayTopic, coastalTopic, noiseTopic, airTopic, amenitiesTopic, crimeTopic, soldpricesTopic, planningTopic, natureTopic
];
// Every topic waits for the nearest-postcode lookup, which tells us the country.
CHECKS.forEach(c => { if (!c.deps.includes("place")) c.deps.push("place"); });

// Each topic's thin line icon (drawn like the share and print icons, 24 × 24) and its short name in the summary grid.
const TOPIC_ICONS = Object.fromEntries(CHECKS.map(c => [c.id, c.icon]));

// The viewing checklist ("At the viewing"): things to see or hear on the day, for topics rated
// "Look into this" or "Worth checking" (each topic's viewing list). General checks are added for every property.
const VIEWING_LOOK = Object.fromEntries(CHECKS.filter(c => c.viewing).map(c => [c.id, c.viewing]));
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

// Which countries each topic's data covers. Outside them the topic is left out of the report (owner, 8 November
// 2026), and the country note in the summary names it, with links to the national services (notCoveredNote in
// js/coverage.js). Missing data inside a covered country is still rated "Check yourself", never hidden.
const COVERAGE = Object.fromEntries(CHECKS.filter(c => c.countries).map(c => [c.id, c.countries]));

export { CHECKS, COVERAGE, GROUPS, TOPIC_ICONS, VIEWING_GENERAL, VIEWING_LOOK };
