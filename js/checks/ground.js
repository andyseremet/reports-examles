"use strict";
// Property Location Check – checks in the "Ground and land" section.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

function checkRadon(R) {
  const base = {
    source: { name: "British Geological Survey and UK Health Security Agency, Radon Indicative Atlas", url: LINKS.bgsRadon }
  };
  if (!R.radon.ok) return unavailable(base, R, "radon");
  const r = R.radon.value;
  if (!r) {
    return { ...base, status: "manual", gap: "coverage", found: "No radon data for this point (the data covers Great Britain only).",
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

function checkCoal(R) {
  const base = {
    source: { name: "Mining Remediation Authority (formerly the Coal Authority)", url: LINKS.coalInfo }
  };
  if (!R.coal.ok) return unavailable(base, R, "coal");
  const c = R.coal.value;
  let status, found, meaning;
  if (c.highAtPoint) {
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
    meaning = "No coal mining search is needed. Other kinds of mining (for example tin, lead, salt or chalk) are not covered by this check.";
  }
  return {
    ...base, status, found,
    details: !c.highAtPoint && c.highNearby ? `<p>A coal mining high-risk area lies within ${formatRadius(R.loc.radius)}.</p>` : "",
    meaning: `<p>${meaning}</p>`,
    actions: status === "low" ? [] : [
      `See old mine shafts and shallow workings on the ${link(LINKS.coalMap, "Mining Remediation Authority map")}.`,
      "Tell your surveyor, so they can look for signs of ground movement."
    ],
    seller: status === "low" ? [] : ["Have there been any subsidence or mining damage claims?"],
    conveyancer: status === "low" ? [] : ["A coal mining report (CON29M). It lists mine shafts, past subsidence claims and future mining plans."]
  };
}

// Past use of the land: old landfill (Environment Agency) and brownfield, contaminated land and major hazard sites
// (planning.data.gov.uk). In November 2026 the national contaminated land and major hazard datasets held no
// records at all, so finding none of those proves nothing: the topic never says "No issue found" because of them.
function checkLanduse(R) {
  if (isWales(R)) return checkLanduseWales(R);
  if (isScotland(R)) return checkLanduseScotland(R);
  const base = {
    source: { name: "Environment Agency Historic Landfill Sites; council brownfield registers on planning.data.gov.uk", url: LINKS.landfill }
  };
  if (!R.landfill.ok) return unavailable(base, R, "landfill");
  const sites = R.landfill.value;
  const nearest = sites[0];
  const nearby = okValue(R, "planningNearby") || [];
  const here = byDataset(okValue(R, "planningPoint"), "contaminated-land");
  const contaminated = byDataset(nearby, "contaminated-land");
  const comah = byDataset(nearby, "control-of-major-accident-hazards-site");
  const brownfield = byDataset(nearby, "brownfield-land");
  const council = okValue(R, "place") ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);

  // Landfill sets the rating: within 250 m "Look into this", up to 1 km "Worth checking", further "For information".
  let status = "info";
  const parts = [];
  if (sites.length) {
    const d = nearest.distanceKm ?? 0;
    status = d <= 0.25 ? "high" : d <= 1 ? "medium" : "info";
    parts.push(`${plural(sites.length, "old landfill site")} within ${within}, the nearest about ${formatDistance(nearest.distanceKm)} away.`);
  } else {
    parts.push(`No old landfill sites recorded within ${within}.`);
  }
  if (here.length) { status = "high"; parts.push("The council has recorded this land as contaminated."); }
  else if (contaminated.length) { if (status !== "high") status = "medium"; parts.push(`${plural(contaminated.length, "contaminated land site")} recorded nearby.`); }
  if (comah.length) { if (status !== "high") status = "medium"; parts.push(`${plural(comah.length, "major hazard site")} nearby.`); }
  if (!here.length && !contaminated.length) parts.push("Contaminated land is not published nationally: ask the council or rely on the environmental search.");

  const wasteTypes = s => [s.household && "household", s.special && "hazardous (“special”)", s.industrial && "industrial",
    s.commercial && "commercial", s.inert && "inert (soil, rubble)"].filter(Boolean).join(", ") || "not recorded";
  const years = s => (s.firstinput || s.lastinput) ? `${(s.firstinput || "").slice(0, 4) || "?"}–${(s.lastinput || "").slice(0, 4) || "?"}` : "not recorded";
  const lines = [];
  if (comah.length) lines.push(`<li>Major hazard sites (${term("COMAH", "Control of Major Accident Hazards: sites storing large amounts of dangerous substances, such as chemicals or fuel")}): ${escapeHTML(comah.map(c => c.name).filter(Boolean).slice(0, 5).join(", "))}</li>`);
  if (brownfield.length) lines.push(`<li>${plural(brownfield.length, "brownfield site")} within ${within}. These are previously developed plots, often earmarked for new homes, which may mean building work nearby. Some were industrial in the past.</li>`);

  return {
    ...base, status, found: parts.join(" "),
    details: (sites.length ? `<div class="table-wrap"><table><thead><tr><th>Old landfill site</th><th>Distance</th><th>Waste</th><th>Years used</th></tr></thead><tbody>${
      sites.slice(0, 10).map(s => `<tr><td>${escapeHTML(s.site_name || "Unnamed site")}</td><td>${escapeHTML(formatDistance(s.distanceKm))}</td><td>${escapeHTML(wasteTypes(s))}</td><td>${escapeHTML(years(s))}</td></tr>`).join("")
    }</tbody></table></div>` : "") + (lines.length ? `<ul>${lines.join("")}</ul>` : ""),
    meaning: `<p>Old landfill can give off gas or affect the ground. Sites within 250 m usually get a closer look. Household and hazardous
      waste carry more risk than inert waste such as soil and rubble. The orange dots on the map show where the sites are.</p>
      <p>Rating: landfill within 250 m “Look into this”, 250 m to 1 km “Worth checking”, further away “For information”.</p>
      <p>Councils must keep a register of contaminated land, but registers are not published nationally, so this check cannot rule
      contamination out. Former petrol stations, factories, railways and gasworks are common sources. The environmental search your
      conveyancer orders looks at the past uses of the land.</p>`,
    actions: [
      ...(sites.length ? ["If a landfill site is very close, ask the council whether it has been investigated."] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

// Wales: old landfill sites and contaminated land are not published nationally, so with no coal tip nearby
// the topic stays "Check yourself" (missing data is never good news).
const COAL_TIP_CLOSE_KM = 0.25;
function checkLanduseWales(R) {
  const base = { source: { name: "Welsh Government, disused coal tips in Wales (DataMapWales)", url: LINKS.walesCoalTips } };
  if (!R.coalTips.ok) return unavailable(base, R, "coalTips");
  const tips = R.coalTips.value || [];
  const council = okValue(R, "place") ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);
  const close = tips.filter(t => t.distanceKm != null && t.distanceKm <= COAL_TIP_CLOSE_KM);
  const higher = tips.filter(t => t.category === "C" || t.category === "D");
  const status = close.length ? "medium" : tips.length ? "info" : "manual";
  const found = tips.length
    ? `${plural(tips.length, "disused coal tip")} within ${within}${tips[0].distanceKm == null ? "" : `, the nearest about ${formatDistance(tips[0].distanceKm)} away`}${higher.length ? ` (${plural(higher.length, "tip")} in the more often inspected categories C and D)` : ""}. Landfill and contaminated land are not published for Wales.`
    : `No disused coal tips within ${within}. Old landfill sites and contaminated land are not published for Wales, so check these another way.`;
  return {
    ...base, status, found, ...(status === "manual" && { gap: "coverage" }),
    dataDate: `Coal tip map as of March 2026. Checked live on ${today()}`,
    details: tips.length ? `<div class="table-wrap"><table><thead><tr><th>Coal tip</th><th>Distance</th><th>Category</th><th>Last inspected</th></tr></thead><tbody>${
      tips.slice(0, 10).map(t => `<tr><td>${escapeHTML(t.id || "Unnamed tip")}</td><td>${escapeHTML(t.distanceKm == null ? "Nearby" : formatDistance(t.distanceKm))}</td><td>${escapeHTML(COAL_TIP_CATEGORY[t.category] || t.category || "Not recorded")}</td><td>${escapeHTML(t.inspected || "Not recorded")}</td></tr>`).join("")
    }</tbody></table></div>` : "",
    meaning: `<p>Wales has more than 2,000 disused coal tips, mostly in the south Wales valleys. The Welsh Government gives each one
      a category that sets how often it is inspected. Categories C and D are inspected most often, to check drainage and
      stability. This does not mean they are about to move. Categories A, B and R are much less likely to affect public safety.</p>
      <p>Rating: a coal tip within 250 m is “Worth checking”; further away it is “For information”. With no coal tip nearby this
      topic says “Check yourself”, because old landfill sites and contaminated land are not published for Wales.</p>
      <p>Former factories, petrol stations, railways and gasworks are common sources of contamination. The environmental search
      your conveyancer orders looks at the past uses of the land.</p>`,
    actions: [
      ...(tips.length ? [`See the tips on the ${link(LINKS.walesCoalTips, "Welsh Government's disused coal tips map")}, and ask ${escapeHTML(council)} about any close to the property.`] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area, and Natural Resources Wales about old landfill sites.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

// Scotland: SEPA licensed waste sites. Old (closed) landfill and contaminated land are not published nationally,
// so with no licensed landfill nearby the topic is never "No issue found".
function checkLanduseScotland(R) {
  const base = { source: { name: "SEPA, licensed waste sites (waste management licences and permits)", url: LINKS.sepaPermits } };
  if (!R.wasteSites.ok) return unavailable(base, R, "wasteSites");
  const sites = R.wasteSites.value || [];
  const council = okValue(R, "place") ? R.place.value.admin_district + " Council" : "the local council";
  const within = formatRadius(R.loc.radius);
  const landfill = sites.filter(s => s.landfill);
  // Landfill uses the England rule: within 250 m "Look into this", up to 1 km "Worth checking". Other waste sites are for information.
  const d = landfill.length ? (landfill[0].distanceKm ?? 0) : null;
  const status = d != null ? (d <= 0.25 ? "high" : d <= 1 ? "medium" : "info") : sites.length ? "info" : "manual";
  const others = sites.length - landfill.length;
  const found = [
    landfill.length ? `${plural(landfill.length, "licensed landfill site")} within ${within}, the nearest about ${formatDistance(landfill[0].distanceKm)} away.` : "",
    others ? `${plural(others, "other licensed waste site")} (such as recycling centres, transfer stations or scrapyards) within ${within}.` : "",
    !sites.length ? `No licensed waste sites within ${within}.` : "",
    "Old, closed landfill sites and contaminated land are not published for Scotland, so check these another way."
  ].filter(Boolean).join(" ");
  return {
    ...base, status, found, ...(status === "manual" && { gap: "coverage" }),
    details: sites.length ? `<div class="table-wrap"><table><thead><tr><th>Waste site</th><th>Distance</th><th>Activity</th></tr></thead><tbody>${
      sites.slice(0, 10).map(s => `<tr><td>${escapeHTML(s.name || "Unnamed site")}</td><td>${escapeHTML(formatDistance(s.distanceKm))}</td><td>${escapeHTML(s.kinds.join(", ") || "Not recorded")}</td></tr>`).join("")
    }</tbody></table></div>` : "",
    meaning: `<p>These are sites SEPA licenses to handle waste today, including landfill. Landfill can give off gas or affect the ground.
      Busy waste sites can also bring lorries, noise or smells. The dark green dots on the map show where the sites are.</p>
      <p>Rating: licensed landfill within 250 m “Look into this”, 250 m to 1 km “Worth checking”; other waste sites are “For information”.
      With no waste site nearby this topic says “Check yourself”, because old landfill sites and contaminated land are not published for Scotland.</p>
      <p>Former factories, petrol stations, railways, gasworks and mines are common sources of contamination. The environmental search
      your solicitor orders looks at the past uses of the land.</p>`,
    actions: [
      ...(sites.length ? [`Find out more about a site in ${link(LINKS.sepaPermits, "SEPA's authorisations and permits")} (search by its address).`] : []),
      `Ask ${escapeHTML(council)} for its contaminated land register entry for the area, and about any old landfill sites.`
    ],
    seller: ["Do you know of any previous industrial use of the land, or any underground fuel or oil tanks?"],
    conveyancer: ["An environmental search. It covers landfill, contaminated land and former industrial uses of the land."]
  };
}

function checkLandslides(R) {
  const base = {
    source: { name: "British Geological Survey, National Landslide Database", url: LINKS.landslides }
  };
  if (!R.landslides.ok) return unavailable(base, R, "landslides");
  const s = R.landslides.value;
  return {
    // Only a landslide within 500 m is worth checking; further ones are for information.
    ...base, status: !s.length ? "low" : (s[0].distanceKm ?? 0) <= 0.5 ? "medium" : "info",
    found: s.length
      ? `${plural(s.length, "recorded landslide")} within ${formatRadius(R.loc.radius)}. The nearest is about ${formatDistance(s[0].distanceKm)} away.`
      : `No recorded landslides within ${formatRadius(R.loc.radius)}.`,
    details: s.length ? `<ul>${s.slice(0, 5).map(x => `<li>${escapeHTML(x.name)} (${escapeHTML(formatDistance(x.distanceKm))})</li>`).join("")}</ul>` : "",
    meaning: `<p>Rating: a recorded landslide within 500 m is “Worth checking”; further away it is “For information”.</p>
      <p>This check does not cover clay soil that shrinks and swells in dry and wet weather. That is the most common
      cause of subsidence in England, especially in the South East.</p>`,
    actions: [`For clay soil, sinkholes and other ground hazards, the environmental search or a ${link(LINKS.geosure, "BGS GeoSure")} report can help.`],
    seller: ["Has there been any subsidence, cracking or underpinning?"]
  };
}

// Shoreline management plan policies, in plain words.

const SHORELINE_PLAN = {
  "hold the line": "keep the existing sea defences",
  "advance the line": "build new defences further out to sea",
  "managed realignment": "let the coast move back in a planned way",
  "no active intervention": "no money is planned for sea defences"
};
function shorelinePlan(policy) {
  const words = SHORELINE_PLAN[String(policy || "").trim().toLowerCase()];
  return words ? `“${escapeHTML(policy)}” (${words})` : policy ? `“${escapeHTML(policy)}”` : "";
}

function checkCoastal(R) {
  const wales = isWales(R), scot = isScotland(R);
  const agency = wales ? "Natural Resources Wales" : "the Environment Agency";
  const base = {
    source: scot
      ? { name: "Dynamic Coast (NatureScot and the Scottish Government), 2021, higher-emissions forecast", url: LINKS.dynamicCoast }
      : wales
      ? { name: "Natural Resources Wales, National Coastal Erosion Risk Map (NCERM, via DataMapWales)", url: LINKS.walesCoast }
      : { name: "Environment Agency, National Coastal Erosion Risk Map (NCERM 2024)", url: LINKS.coastalData }
  };
  if (!R.coastal.ok) return unavailable(base, R, "coastal");
  const c = R.coastal.value;
  if (c.published) base.dataDate = `Map last updated ${c.published}. Checked live on ${today()}`;
  const checker = scot ? link(LINKS.dynamicCoast, "Dynamic Coast map")
    : wales ? link(LINKS.walesCoast, "Natural Resources Wales coastal erosion map") : link(LINKS.coastalMap, "Check coastal erosion management in your area");
  const [soon, later] = c.years || [2055, 2105];
  const upTo = m => m != null ? ` (up to about ${m} m of land lost)` : "";
  if (!c.nearCoast) {
    return {
      ...base, status: "low",
      found: scot ? "No soft coast (sand, gravel or soft rock) is mapped within 1 km." : "Not near the coast: no coastline is mapped within 1 km.",
      meaning: "<p>This check looks for coast within 1 km of the property that is expected to wear away over the next 100 years.</p>" +
        (scot ? "<p>Dynamic Coast maps all of Scotland's soft coast. Rocky coasts wear away too slowly to be mapped.</p>" : "")
    };
  }
  const plan = c.plan.now || c.plan.later;
  const planLine = wales && c.plan.area
    ? `<p>This stretch of coast is covered by the ${term("shoreline management plan", `The long-term plan for this stretch of coast, agreed by the councils and ${agency}`)} ${escapeHTML(c.plan.area)}.</p>`
    : plan
    ? `<p>The local ${term("shoreline management plan", `The long-term plan for this stretch of coast, agreed by the council and ${agency}`)}
      ${c.plan.area ? `(${escapeHTML(c.plan.area)}) ` : ""}says ${shorelinePlan(c.plan.now)} until about 2055${c.plan.later && c.plan.later !== c.plan.now ? `, then ${shorelinePlan(c.plan.later)}` : ""}.</p>`
    : "";
  let status, found;
  if (c.inside2055) {
    status = "high";
    found = `The property is inside the area the coast is expected to reach by ${soon}${upTo(c.metres2055)}.`;
  } else if (c.inside2105) {
    status = "medium";
    found = `The property is inside the area the coast is expected to reach by ${later}${upTo(c.metres2105)}, but not by ${soon}.`;
  } else if (c.erosionKm != null && c.erosionKm <= 0.2) {
    status = "info";
    found = `The coast nearby is expected to wear away. The edge of the area expected to be lost by ${later} is about ${formatDistance(c.erosionKm)} from the property.`;
  } else {
    status = "low";
    found = c.erosionKm != null
      ? `The coast is within 1 km. The nearest area expected to be lost by ${later} is about ${formatDistance(c.erosionKm)} away.`
      : `The coast is within 1 km, but no land there is expected to be lost to the sea by ${later}.`;
  }
  return {
    ...base, status, found,
    meaning: `<p>Rating: inside the area expected to be lost by ${soon} is “Look into this”; by ${later} is “Worth checking”;
      within 200 m of it is “For information”.</p>
      ${planLine}
      <p>${scot
        ? `Dynamic Coast projects past shoreline change forward with rising sea levels. The online map uses the higher-emissions
          forecast, so it is a cautious view: with lower emissions, less land would be lost. It maps soft coasts (sand, gravel and soft rock) only.
          It is a national guide and cannot give exact details for a single property.`
        : `${wales ? "The map assumes the shoreline plan is carried out." : "The map assumes the shoreline plan is carried out and the sea level rise the Environment Agency advises planning for."}
      ${wales ? "Natural Resources Wales" : "The Environment Agency"} says it is a national guide and cannot give exact details for a single property.`}</p>`,
    actions: status === "low" ? [] : [
      scot ? `See how this stretch of coast is changing on the ${checker}.` : `See the map and the plan for this stretch of coast on ${checker}.`,
      "Ask the council's coastal team how the coast here is changing, and whether the defences will be kept."
    ],
    seller: status === "low" ? [] : ["Has the cliff or shore near the property moved, or have the sea defences been repaired, in your time here?"],
    conveyancer: status === "low" ? [] : ["Does the environmental search cover coastal erosion, and will lenders and insurers accept the property?"]
  };
}
