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
import * as floodChecks from "./checks/flood.js";
import * as groundChecks from "./checks/ground.js";
import * as livingChecks from "./checks/living.js";
import * as planningChecks from "./checks/planning.js";
import * as checkList from "./checks/index.js";
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

const reach = (from, names) => names.forEach(name =>
  Object.defineProperty(window, name, { get: () => from[name], configurable: true }));

reach(coreModule, ["$", "formatDistance", "GLOSSARY", "icon", "link", "okValue", "PLANNING_AT_POINT",
  "PLANNING_NEARBY", "STATUS_ORDER", "term", "today"]);
reach(apiModule, ["fetchJSON", "once"]);
reach(storeModule, ["reportKey", "store"]);
reach(dataModule, ["distanceToGeometryKm", "getAmenities", "getCoal", "getCoastalErosion", "getCrime",
  "getCrimeArea", "getLandfill", "getOtherMining", "getPastFloods", "getPlace", "getRailNoise", "getReservoirFlood",
  "getRoadNoise", "getShrinkSwell", "getSoldPrices", "inScotland", "placeFromOsm"]);
reach(backupsModule, ["withBackup"]);
reach(dataWalesModule, ["getCoalTips", "getWalesSites"]);
reach(dataScotlandModule, ["getScotlandSites", "getSimdCrime", "getWasteSites"]);
reach(dataNiModule, ["getNISites"]);
reach(floodChecks, ["checkFlood", "checkPastFloods", "reservoirNote"]);
reach(groundChecks, ["checkClay", "checkCoal", "checkCoastal", "checkLanduse"]);
reach(livingChecks, ["checkAir", "checkAmenities", "checkCrime", "checkNoise", "checkSoldPrices"]);
reach(planningChecks, ["checkNature", "checkPlanning"]);
reach(checkList, ["CHECKS", "TASK_FN", "unavailable", "VIEWING_LOOK"]);
reach(coverageModule, ["COVERAGE", "shownChecks", "topicShown"]);
reach(runnerModule, ["forgetAnswers", "orderedResults", "recentAnswer", "rememberAnswer", "savedInstead",
  "startTask", "topicResult"]);
reach(mapModule, ["map", "mapIsFull"]);
reach(searchModule, ["searchPhoton"]);
reach(savedModule, ["renderSaved", "SAVED_KEY"]);
reach(runModule, ["snapKey"]);
reach(summaryModule, ["doneVerdict", "whyBox"]);
reach(reportModule, ["chip", "reportMap"]);
reach(nextStepsModule, ["conveyancerText", "restoreTicks"]);
reach(navigationModule, ["problemTopics"]);
Object.defineProperty(window, "run", { get: () => runnerModule.run, set: value => runnerModule.setRun(value), configurable: true });
