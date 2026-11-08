// Property Location Check – the data tasks (TASKS): each topic's own data (js/topics/) and the data topics share
// (js/sources.js), in the order they start.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { SHARED_DATA } from "./sources.js";
import { CHECKS } from "./topics/index.js";

// Tasks start in this order. The Environment Agency server answers only a few requests at a time (PACED_HOSTS), so
// its most important topic, flooding from heavy rain, is listed first and road and rail noise last. A task not
// listed here starts last.
const TASK_ORDER = [
  "place", "surfaceWater", "pastFloods", "reservoirs", "landfill", "coastal", "planningPoint", "planningNearby",
  "radon", "coal", "air", "landslides", "shrinkSwell", "otherMining", "crime", "soldPrices", "floodNational",
  "amenities", "crimeArea", "noise", "railNoise", "walesSites", "coalTips", "scotlandSites", "wasteSites",
  "simdCrime", "niSites"
];

// Each data task: key, topic name, fetch function, and the service it waits for (named in the "Still waiting for"
// note when a report is slow).
const rank = key => { const i = TASK_ORDER.indexOf(key); return i < 0 ? TASK_ORDER.length : i; };
const TASKS = Object.entries({ ...SHARED_DATA, ...Object.assign({}, ...CHECKS.map(c => c.data || {})) })
  .map(([key, [name, fetch, service]]) => [key, name, fetch, service])
  .sort((a, b) => rank(a[0]) - rank(b[0]));
const TASK_FN = Object.fromEntries(TASKS.map(([key, , fn]) => [key, fn]));

export { TASK_FN, TASKS };
