// Property Location Check – the app names that the daily check (tests/live/, tests/a11y-check.mjs) reads from the page.
// A module (no build step): modules keep their names to themselves, so this file puts these on `window`, read-only,
// always showing the current value. `run` can also be set, as some test steps do. A test that reads a new app name
// from the page needs it listed here (docs/TESTING.md).

import * as coreModule from "./core.js";
import * as apiModule from "./api.js";
import * as storeModule from "./store.js";
import * as dataModule from "./data.js";
import * as backupsModule from "./backups.js";
import * as dataWalesModule from "./data-wales.js";
import * as dataScotlandModule from "./data-scotland.js";
import * as dataNiModule from "./data-ni.js";
import * as sourcesModule from "./sources.js";
import * as helpersModule from "./topics/helpers.js";
import * as indexModule from "./topics/index.js";
import * as tasksModule from "./tasks.js";
import * as coverageModule from "./coverage.js";
import * as runnerModule from "./runner.js";
import * as mapModule from "./map.js";
import * as searchModule from "./search.js";
import * as savedModule from "./saved.js";
import * as runModule from "./run.js";
import * as summaryModule from "./summary.js";
import * as reportModule from "./report.js";
import * as nextStepsModule from "./next-steps.js";
import * as navigationModule from "./navigation.js";
import * as floodModule from "./topics/flood.js";
import * as pastfloodsModule from "./topics/pastfloods.js";
import * as coalModule from "./topics/coal.js";
import * as landuseModule from "./topics/landuse.js";
import * as clayModule from "./topics/clay.js";
import * as coastalModule from "./topics/coastal.js";
import * as noiseModule from "./topics/noise.js";
import * as airModule from "./topics/air.js";
import * as amenitiesModule from "./topics/amenities.js";
import * as crimeModule from "./topics/crime.js";
import * as soldpricesModule from "./topics/soldprices.js";
import * as planningModule from "./topics/planning.js";
import * as natureModule from "./topics/nature.js";

const reach = (from, names) => names.forEach(name =>
  Object.defineProperty(window, name, { get: () => from[name], configurable: true }));

reach(coreModule, ["$", "formatDistance", "GLOSSARY", "icon", "link", "okValue", "PLANNING_AT_POINT",
  "PLANNING_NEARBY", "STATUS_ORDER", "term", "today"]);
reach(apiModule, ["fetchJSON", "once"]);
reach(storeModule, ["reportKey", "store"]);
reach(dataModule, ["distanceToGeometryKm", "getPlace", "inScotland", "placeFromOsm"]);
reach(backupsModule, ["withBackup"]);
reach(dataWalesModule, ["getWalesSites"]);
reach(dataScotlandModule, ["getScotlandSites"]);
reach(dataNiModule, ["getNISites"]);
reach(sourcesModule, ["SHARED_DATA"]);
reach(helpersModule, ["unavailable"]);
reach(indexModule, ["CHECKS", "COVERAGE", "GROUPS", "TOPIC_ICONS", "VIEWING_LOOK"]);
reach(tasksModule, ["TASK_FN", "TASKS"]);
reach(coverageModule, ["shownChecks", "topicShown"]);
reach(runnerModule, ["forgetAnswers", "orderedResults", "recentAnswer", "rememberAnswer", "savedInstead", "startRun",
  "startTask", "topicResult"]);
reach(mapModule, ["map", "mapIsFull"]);
reach(searchModule, ["searchPhoton"]);
reach(savedModule, ["renderSaved", "SAVED_KEY"]);
reach(runModule, ["snapKey"]);
reach(summaryModule, ["doneVerdict", "whyBox"]);
reach(reportModule, ["chip", "reportMap"]);
reach(nextStepsModule, ["conveyancerText", "restoreTicks"]);
reach(navigationModule, ["problemTopics"]);
reach(floodModule, ["checkFlood", "getReservoirFlood", "reservoirNote"]);
reach(pastfloodsModule, ["checkPastFloods", "getPastFloods"]);
reach(coalModule, ["checkCoal", "getCoal", "getOtherMining"]);
reach(landuseModule, ["checkLanduse", "getCoalTips", "getLandfill", "getWasteSites"]);
reach(clayModule, ["checkClay", "getShrinkSwell"]);
reach(coastalModule, ["checkCoastal", "getCoastalErosion"]);
reach(noiseModule, ["checkNoise", "getRailNoise", "getRoadNoise"]);
reach(airModule, ["checkAir"]);
reach(amenitiesModule, ["checkAmenities", "getAmenities"]);
reach(crimeModule, ["checkCrime", "getCrime", "getCrimeArea", "getSimdCrime"]);
reach(soldpricesModule, ["checkSoldPrices", "getSoldPrices"]);
reach(planningModule, ["checkPlanning"]);
reach(natureModule, ["checkNature"]);
Object.defineProperty(window, "run", { get: () => runnerModule.run, set: value => runnerModule.setRun(value), configurable: true });
