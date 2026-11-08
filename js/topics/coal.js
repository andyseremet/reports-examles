// Property Location Check – topic: Mining (coal and other). Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { formatRadius, link, LINKS } from "../core.js";
import { API, arcgisQuery } from "../api.js";
import { inNI } from "../data.js";
import { unavailable } from "./helpers.js";

async function getCoal(loc) {
  const [highAtPoint, lowAtPoint, highNearby] = await Promise.all([
    arcgisQuery(API.coalHigh, loc, 0),
    arcgisQuery(API.coalLow, loc, 0),
    arcgisQuery(API.coalHigh, loc, loc.radius)
  ]);
  return { highAtPoint: highAtPoint.length > 0, lowAtPoint: lowAtPoint.length > 0, highNearby: highNearby.length > 0 };
}

// Mining other than coal (tin, lead, iron, salt and so on): Significant, Moderate, Low or NA (no known record).
async function getOtherMining(loc) {
  if (await inNI(loc)) return null;
  const f = await arcgisQuery(API.otherMining, loc, 0, { outFields: "Class,Legend" });
  return f[0] ? { level: f[0].attributes.Class, legend: f[0].attributes.Legend } : null;
}

function checkCoal(R) {
  const base = {
    source: { name: "Mining Remediation Authority (formerly the Coal Authority); British Geological Survey, mining other than coal (1 km overview)", url: LINKS.coalInfo }
  };
  // Mining other than coal (tin, copper, lead, iron, salt and so on): the British Geological Survey's 1 km overview.
  const otherNotes = {
    Significant: "Other underground mining (for example tin, copper, lead or iron) is known or considered likely in this area.",
    Moderate: "Small-scale underground mining other than coal may have happened in this area.",
    Low: "Localised small-scale mining other than coal may have happened in this area."
  };
  // The coal service failed: still show what the other-mining overview found (never hide a "Significant"),
  // and say coal could not be checked. With no other-mining answer either, the topic is not available.
  // (A saved earlier answer for this place still comes first: see failedService in buildCheck.)
  const otherOnly = !R.coal.ok && R.otherMining.ok && R.otherMining.value && !!otherNotes[R.otherMining.value.level];
  if (!R.coal.ok && !otherOnly) return unavailable(base, R, "coal");
  const c = R.coal.ok ? R.coal.value : {};
  let status, found, meaning;
  if (!R.coal.ok) {
    status = "manual";
    found = "Coal mining could not be checked right now: check it on the Mining Remediation Authority map.";
    meaning = "The coal mining service did not respond.";
  } else if (c.highAtPoint) {
    status = "high";
    found = "In a coal mining high-risk area: old mine workings are recorded at or near the surface.";
    meaning = "Features such as old mine shafts or shallow workings are recorded here. They can cause the ground to move or collapse. The official term is a “Development High Risk Area”.";
  } else if (c.lowAtPoint) {
    status = "medium";
    found = "On the coalfield: coal was, or may have been, mined deep underground here.";
    meaning = "Deep mining is unlikely to affect the surface today, but a coal mining search is normally ordered for homes here. The official term is a “Development Low Risk Area”.";
  } else {
    status = "low";
    found = "Outside the coalfield: no recorded coal mining here.";
    meaning = "No coal mining search is needed.";
  }
  // Where underground mining is known or likely, a mining search is worth ordering; it is never good news if unknown.
  const other = R.otherMining.ok ? R.otherMining.value : undefined;
  const otherSignificant = other && other.level === "Significant";
  if (other && otherNotes[other.level]) found += " " + otherNotes[other.level];
  if (otherSignificant && ["low", "manual"].includes(status)) status = "medium";
  else if (other && other.level === "Moderate" && status === "low") status = "info";
  if (other === undefined && status === "low") {     // the other-mining overview did not answer: not "No issue found"
    status = "manual";
    found += " Mining other than coal could not be checked right now.";
  } else if (other === null && status === "low") {   // no hexagon here (the overview says "NA" where nothing is known): missing data
    status = "manual";
    found += " No data on mining other than coal was found for this spot.";
  }
  meaning += " Mining other than coal comes from the British Geological Survey's overview in 1 km hexagons, so it describes the area, not the exact plot.";
  return {
    ...((status === "manual" || !R.coal.ok) && { gap: "down" }), ...(!R.coal.ok && { failedService: "coal" }),
    ...base, status, found,
    details: !c.highAtPoint && c.highNearby ? `<p>A coal mining high-risk area lies within ${formatRadius(R.loc.radius)}.</p>` : "",
    meaning: `<p>${meaning}</p>`,
    actions: [
      ...(otherSignificant ? [`Ask your conveyancer for a mining search that covers mining other than coal (in Cornwall and West Devon, the Cornwall and West Devon mining search). See the ${link(LINKS.otherMiningInfo, "British Geological Survey's mining hazard data")}.`] : []),
      ...(R.coal.ok && !c.highAtPoint && !c.lowAtPoint ? [] : [
        `See old mine shafts and shallow workings on the ${link(LINKS.coalMap, "Mining Remediation Authority map")}.`,
        "Tell your surveyor, so they can look for signs of ground movement."
      ])
    ],
    seller: status === "low" ? [] : ["Have there been any subsidence or mining damage claims?"],
    conveyancer: [
      ...(R.coal.ok && !c.highAtPoint && !c.lowAtPoint ? [] : ["A coal mining report (CON29M). It lists mine shafts, past subsidence claims and future mining plans."]),
      ...(otherSignificant ? ["A mining search covering mining other than coal (in Cornwall and West Devon, the Cornwall and West Devon mining search)."] : [])
    ]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const coalTopic = {
  id: "coal", group: "ground", title: "Mining (coal and other)",
  countries: ["England", "Wales", "Scotland"],
  data: {
    coal: ["Coal mining", getCoal, "Mining Remediation Authority"],
    otherMining: ["Mining other than coal", getOtherMining, "British Geological Survey"]
  },
  deps: ["coal", "otherMining"],
  build: checkCoal,
  icon: ['<path d="M4 20l9-9"/><path d="M11 5c3.5-1.5 7-.5 9 2-3-.8-5.5-.3-7.5 1.5"/><path d="M11 5l-2 2 4 4 2-2"/>', "Mining"],
  viewing: ["Cracks over doors and windows, sloping floors, or doors that stick (signs of ground movement)."]
};

export { checkCoal, coalTopic, getCoal, getOtherMining };
