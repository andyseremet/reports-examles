// Property Location Check – the app names that the daily check (tests/live/, tests/a11y-check.mjs) reads from the page.
// A module (no build step): modules keep their names to themselves, so this file puts these on `window`, read-only,
// always showing the current value. `run` can also be set, as some test steps do. A test that reads a new app name
// from the page needs it listed here (docs/TESTING.md).

import * as core from "./core.js";
import * as api from "./api.js";
import * as data from "./data.js";
import * as backups from "./backups.js";
import * as dataWales from "./data-wales.js";
import * as dataScotland from "./data-scotland.js";
import * as dataNi from "./data-ni.js";
import * as floodChecks from "./checks/flood.js";
import * as groundChecks from "./checks/ground.js";
import * as livingChecks from "./checks/living.js";
import * as planningChecks from "./checks/planning.js";
import * as checkList from "./checks/index.js";
import * as coverage from "./coverage.js";
import * as mapModule from "./map.js";
import * as search from "./search.js";
import * as saved from "./saved.js";
import * as runModule from "./run.js";
import * as summary from "./summary.js";
import * as report from "./report.js";
import * as nextSteps from "./next-steps.js";
import * as navigation from "./navigation.js";

const reach = (from, names) => names.forEach(name =>
  Object.defineProperty(window, name, { get: () => from[name], configurable: true }));

reach(core, ["$", "formatDistance", "GLOSSARY", "icon", "link", "okValue", "PLANNING_AT_POINT", "PLANNING_NEARBY",
  "STATUS_ORDER", "term", "today"]);
reach(api, ["fetchJSON", "once"]);
reach(data, ["distanceToGeometryKm", "getAmenities", "getCoal", "getCoastalErosion", "getCrime", "getCrimeArea",
  "getLandfill", "getOtherMining", "getPastFloods", "getPlace", "getRailNoise", "getReservoirFlood", "getRoadNoise",
  "getShrinkSwell", "getSoldPrices", "inScotland", "placeFromOsm"]);
reach(backups, ["withBackup"]);
reach(dataWales, ["getCoalTips", "getWalesSites"]);
reach(dataScotland, ["getScotlandSites", "getSimdCrime", "getWasteSites"]);
reach(dataNi, ["getNISites"]);
reach(floodChecks, ["checkFlood", "checkPastFloods", "reservoirNote"]);
reach(groundChecks, ["checkClay", "checkCoal", "checkCoastal", "checkLanduse"]);
reach(livingChecks, ["checkAir", "checkAmenities", "checkCrime", "checkNoise", "checkSoldPrices"]);
reach(planningChecks, ["checkNature", "checkPlanning"]);
reach(checkList, ["CHECKS", "TASK_FN", "unavailable", "VIEWING_LOOK"]);
reach(coverage, ["COVERAGE", "shownChecks", "topicShown"]);
reach(mapModule, ["map", "mapIsFull"]);
reach(search, ["searchPhoton"]);
reach(saved, ["renderSaved", "reportKey", "SAVED_KEY", "store"]);
reach(runModule, ["forgetAnswers", "orderedResults", "recentAnswer", "rememberAnswer", "savedInstead", "snapKey",
  "startTask", "topicResult"]);
reach(summary, ["doneVerdict", "whyBox"]);
reach(report, ["chip", "reportMap"]);
reach(nextSteps, ["conveyancerText", "restoreTicks"]);
reach(navigation, ["problemTopics"]);
Object.defineProperty(window, "run", { get: () => runModule.run, set: value => runModule.setRun(value), configurable: true });
