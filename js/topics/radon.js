// Property Location Check – topic: Radon gas. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { link, LINKS, today } from "../core.js";
import { API, arcgisQuery } from "../api.js";
import { unavailable } from "./helpers.js";

async function getRadon(loc) {
  const f = await arcgisQuery(API.radon, loc, 0, { outFields: "Description,CLASS_MAX,VERSION" });
  return f[0] ? f[0].attributes : null;
}

function checkRadon(R) {
  const base = {
    source: { name: "British Geological Survey and UK Health Security Agency, Radon Indicative Atlas", url: LINKS.bgsRadon }
  };
  if (!R.radon.ok) return unavailable(base, R, "radon");
  const r = R.radon.value;
  if (!r) {
    return { ...base, status: "manual", found: "No radon data for this point (the data covers Great Britain only).",
      meaning: "", actions: [`Check the address on ${link(LINKS.ukradon, "UKradon")}.`] };
  }
  if (r.VERSION) base.dataDate = r.VERSION + ", checked " + today();
  const cls = Number(r.CLASS_MAX);
  const bands = { 1: "fewer than 1", 2: "1 to 3", 3: "3 to 5", 4: "5 to 10", 5: "10 to 30", 6: "more than 30" };
  const status = cls <= 1 ? "low" : cls <= 3 ? "medium" : "high";
  const found = cls <= 1
    ? "Low radon area: fewer than 1 in every 100 homes are estimated to have high radon."
    : `Raised radon area: in parts of this area, ${bands[cls] || "some"} in every 100 homes are estimated to have high radon.`;

  return {
    ...base, status, found,
    details: `<div class="table-wrap"><table>
        <thead><tr><th>Measure</th><th>This area</th><th>WHO recommendation</th><th>UK guidance</th></tr></thead>
        <tbody><tr>
          <td>Radon level inside homes</td>
          <td>Not measured for this home. ${cls <= 1 ? "Fewer than 1" : (bands[cls] || "Some")} in every 100 homes nearby are estimated to be above the UK Action Level.</td>
          <td>Below 100 Bq/m³</td>
          <td>Action Level 200 Bq/m³; Target Level 100 Bq/m³</td>
        </tr></tbody>
      </table></div>`,
    meaning: `<p>Bq/m³ (becquerels per cubic metre) measures how much radon is in the air. The
      ${link(LINKS.whoRadon, "WHO Handbook on Indoor Radon")} recommends homes stay below 100 Bq/m³. In the UK, the
      ${link(LINKS.ukRadonLevels, "UK Health Security Agency")} advises fixing homes at or above 200 Bq/m³ (the Action Level),
      and aiming for below 100 Bq/m³ (the Target Level). Only a test inside the home can measure its level.</p>
      <p>Radon is a natural radioactive gas that comes up from the ground. You cannot see or smell it. Long-term exposure
      is the second biggest cause of lung cancer in the UK after smoking. It is easy to test for, and high levels can
      usually be reduced at modest cost, for example with a small fan under the floor.</p>
      <p>This is the <em>highest</em> level anywhere in the surrounding 1 km square, so the property itself may be lower.</p>`,
    actions: cls > 1 ? [
      `Buy an address-level radon report from ${link(LINKS.ukradon, "UKradon")} (run by the UK Health Security Agency) for a small fee.`,
      "After you move in, test with a 3-month radon detector."
    ] : [],
    seller: cls > 1 ? ["Has the property been tested for radon? Were radon protection measures fitted?"] : []
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const radonTopic = {
  id: "radon", group: "ground", title: "Radon gas",
  countries: ["England", "Wales", "Scotland"],
  data: {
    radon: ["Radon gas", getRadon, "British Geological Survey"]
  },
  deps: ["radon"],
  build: checkRadon,
  icon: ['<path d="M3 20h18"/><path d="M8 17c0-2 2-2 2-4s-2-2-2-4M12 17c0-2 2-2 2-4s-2-2-2-4M16 17c0-2 2-2 2-4s-2-2-2-4"/>', "Radon"],
  viewing: ["A radon sump or a small vent pipe outside, or a radon test result the seller can show you."]
};

export { radonTopic };
