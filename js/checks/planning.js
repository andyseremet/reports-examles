"use strict";
// Property Location Check – checks in the "Planning and surroundings" section.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

function checkPlanning(R) {
  if (isWales(R)) return checkPlanningWales(R);
  const base = {
    source: { name: "planning.data.gov.uk (Ministry of Housing, Communities and Local Government)", url: LINKS.planningData }
  };
  if (!R.planningPoint.ok) return unavailable(base, R, "planningPoint");

  const here = R.planningPoint.value;
  const rules = [
    ["conservation-area", "Conservation area", "Extra permission is needed for demolition, some extensions, and work on trees."],
    ["listed-building-outline", "Listed building", "Listed building consent is needed for most changes, inside and out."],
    ["green-belt", "Green Belt", "New building is strictly limited."],
    ["area-of-outstanding-natural-beauty", "National Landscape", "Stricter planning rules apply to protect the landscape."],
    ["national-park", "National Park", "The National Park authority deals with planning, with stricter rules."],
    ["world-heritage-site", "World Heritage Site", "Development must protect the site's heritage value."],
    ["scheduled-monument", "Scheduled monument", "Works need consent from Historic England."],
    ["hs2-safeguarded-area", "HS2 safeguarded area", "Land may be affected by the HS2 railway project."]
  ];
  const applies = rules.filter(([ds]) => byDataset(here, ds).length)
    .map(([ds, name, what]) => ({ name, what, detail: byDataset(here, ds)[0].name }));
  const listedNear = R.planningNearby.ok
    ? byDataset(R.planningNearby.value, "listed-building").filter(e => e.distanceKm != null && e.distanceKm <= 0.2) : [];

  return {
    ...base, status: applies.length ? "info" : "low",
    found: applies.length
      ? "Planning restrictions here: " + applies.map(a => a.name).join(", ") + "."
      : "No conservation area, listed building, Green Belt or similar restriction found here.",
    details: (applies.length ? `<ul>${applies.map(a => `<li><strong>${escapeHTML(a.name)}</strong>${a.detail ? " (" + escapeHTML(a.detail) + ")" : ""}: ${escapeHTML(a.what)}</li>`).join("")}</ul>` : "") +
      (listedNear.length ? `<p>${plural(listedNear.length, "listed building")} within 200 m.</p>` : ""),
    meaning: "<p>These rules mainly matter if you plan to extend, alter or build. Not every council publishes this data yet.</p>",
    actions: [
      "Search the council's planning website by postcode for applications on and next to the property.",
      `Check listed buildings on the ${link(LINKS.historicEngland, "National Heritage List for England")}.`
    ],
    seller: ["Have any extensions or alterations been made? Are there planning permissions and building regulations sign-offs for them?"]
  };
}

function checkNature(R) {
  if (isWales(R)) return checkNatureWales(R);
  const base = {
    source: { name: "Natural England data via planning.data.gov.uk; full map on MAGIC", url: LINKS.magic }
  };
  if (!R.planningNearby.ok) return unavailable(base, R, "planningNearby");
  const sets = {
    "site-of-special-scientific-interest": "Site of Special Scientific Interest",
    "special-area-of-conservation": "Special Area of Conservation",
    "special-protection-area": "Special Protection Area (birds)",
    "ancient-woodland": "Ancient woodland",
    "local-nature-reserve": "Local Nature Reserve"
  };
  const found = R.planningNearby.value.filter(e => sets[e.dataset]);
  const inSssi = R.planningPoint.ok && byDataset(R.planningPoint.value, "site-of-special-scientific-interest").length;
  return {
    ...base, status: found.length ? "info" : "low",
    found: inSssi
      ? "The property is inside a Site of Special Scientific Interest."
      : found.length ? `${plural(found.length, "protected nature site")} within ${formatRadius(R.loc.radius)}.` : `No protected nature sites within ${formatRadius(R.loc.radius)}.`,
    details: found.length ? `<ul>${found.slice(0, 8).map(e => `<li>${escapeHTML(sets[e.dataset])}: ${escapeHTML(e.name || "unnamed")}</li>`).join("")}</ul>` : "",
    meaning: "<p>Nature sites are usually a plus for buyers, but they can limit building work or land use nearby." +
      (inSssi ? " Inside a Site of Special Scientific Interest, many activities need consent from Natural England." : "") + "</p>"
  };
}

// Wales: Cadw (listed buildings, scheduled monuments, historic parks and gardens, World Heritage Sites),
// conservation areas, and Natural Resources Wales (National Parks and National Landscapes), from DataMapWales.
function checkPlanningWales(R) {
  const base = { source: { name: "Cadw, Welsh councils' conservation areas and Natural Resources Wales (via DataMapWales)", url: LINKS.dataMapWales } };
  if (!R.walesSites.ok) return unavailable(base, R, "walesSites");
  const w = R.walesSites.value;
  const listedHere = w.listedHere.length
    ? [{ name: "Listed building", what: `A listed building is recorded within ${WALES_LISTED_HERE_M} m of the pin. It may be this property: listed building consent is needed for most changes, inside and out.`,
      detail: w.listedHere.map(b => b.name + (b.grade ? ` (Grade ${b.grade})` : "")).slice(0, 3).join("; ") }] : [];
  const rules = [
    [w.conservation, "Conservation area", "Extra permission is needed for demolition, some extensions, and work on trees."],
    [w.nationalPark, "National Park", "The National Park authority deals with planning, with stricter rules."],
    [w.landscape, "National Landscape", "Stricter planning rules apply to protect the landscape."],
    [w.heritage, "World Heritage Site", "Development must protect the site's heritage value."],
    [w.monument, "Scheduled monument", "Works need consent from Cadw."],
    [w.park, "Registered historic park or garden", "The council must take the park or garden into account when deciding planning applications."]
  ];
  const applies = [...rules.filter(([names]) => names.length).map(([names, name, what]) => ({ name, what, detail: names.slice(0, 3).join("; ") })), ...listedHere];
  return {
    ...base, status: applies.length ? "info" : "low",
    found: applies.length
      ? "Planning restrictions here: " + applies.map(a => a.name).join(", ") + "."
      : "No conservation area, listed building, National Park or similar restriction found here.",
    details: (applies.length ? `<ul>${applies.map(a => `<li><strong>${escapeHTML(a.name)}</strong>${a.detail ? " (" + escapeHTML(a.detail) + ")" : ""}: ${escapeHTML(a.what)}</li>`).join("")}</ul>` : "") +
      (w.listedNear ? `<p>${w.listedNearCapped ? "More than " + w.listedNear : plural(w.listedNear, "listed building")}${w.listedNearCapped ? " listed buildings" : ""} within ${WALES_LISTED_NEAR_M} m.</p>` : ""),
    meaning: `<p>These rules mainly matter if you plan to extend, alter or build. Conservation areas are drawn by each council;
      the national map may be a little out of date, so check with the council.</p>`,
    actions: [
      "Search the council's planning website by postcode for applications on and next to the property.",
      `Check listed buildings and other historic sites in ${link(LINKS.cadw, "Cadw's records")}.`
    ],
    seller: ["Have any extensions or alterations been made? Are there planning permissions and building regulations sign-offs for them?"]
  };
}

function checkNatureWales(R) {
  const base = { source: { name: "Natural Resources Wales protected sites and Ancient Woodland Inventory 2021 (via DataMapWales)", url: LINKS.walesNature } };
  if (!R.walesSites.ok) return unavailable(base, R, "walesSites");
  const w = R.walesSites.value;
  // Named sites can come back once per part, so repeats are removed; ancient woodland areas have no names, so each counts.
  const seen = new Set();
  const woods = w.nature.filter(e => e.kind === "Ancient woodland");
  const sites = w.nature.filter(e => e.kind !== "Ancient woodland")
    .filter(e => { const k = e.kind + "|" + e.name; if (seen.has(k)) return false; seen.add(k); return true; });
  const found = [...sites, ...woods];
  const inSssi = w.sssi.length > 0;
  const within = `within about ${formatRadius(R.loc.radius)}`;
  const counted = [sites.length && plural(sites.length, "protected nature site"), woods.length && plural(woods.length, "area") + " of ancient woodland"]
    .filter(Boolean).join(" and ");
  return {
    ...base, status: found.length ? "info" : "low",
    found: inSssi
      ? `The property is inside a Site of Special Scientific Interest (${w.sssi[0]}).`
      : found.length ? `${counted} ${within}.` : `No protected nature sites ${within}.`,
    details: found.length ? `<ul>${sites.slice(0, 8).map(e => `<li>${escapeHTML(e.kind)}: ${escapeHTML(e.name || "unnamed")}</li>`).join("")}${
      woods.length ? `<li>Ancient woodland: ${plural(woods.length, "area")}</li>` : ""}</ul>` : "",
    meaning: "<p>Nature sites are usually a plus for buyers, but they can limit building work or land use nearby." +
      (inSssi ? " Inside a Site of Special Scientific Interest, many activities need consent from Natural Resources Wales." : "") + "</p>"
  };
}
