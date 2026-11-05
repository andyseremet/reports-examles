"use strict";
// Property Location Check – checks in the "Planning and surroundings" section.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

function checkPlanning(R) {
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
    meaning: "<p>These rules mainly matter if you plan to extend, alter or build. Not every council publishes this data yet. Protected trees and Article 4 areas have their own topic below.</p>",
    actions: [
      "Search the council's planning website by postcode for applications on and next to the property.",
      `Check listed buildings on the ${link(LINKS.historicEngland, "National Heritage List for England")}.`
    ],
    seller: ["Have any extensions or alterations been made? Are there planning permissions and building regulations sign-offs for them?"]
  };
}

function checkTrees(R) {
  const base = {
    source: { name: "Council data published on planning.data.gov.uk (Ministry of Housing, Communities and Local Government)", url: LINKS.planningData },
    dataDate: "Checked live on " + today() + "; as published by the council"
  };
  if (!R.trees.ok) return unavailable(base, R, "trees");
  if (!R.planningPoint.ok) return unavailable(base, R, "planningPoint");
  const t = R.trees.value;
  const here = okValue(R, "planningPoint") || [];
  const council = t.council || "the council";
  const names = list => [...new Set(list.map(e => e.name).filter(Boolean))];
  const article4 = names(byDataset(here, "article-4-direction-area"));
  const zoneHere = byDataset(here, "tree-preservation-zone").length > 0;
  const trees = t.nearby.filter(e => e.dataset === "tree").sort(byDistance);
  const zonesNear = !zoneHere && t.nearby.some(e => e.dataset === "tree-preservation-zone");
  const p = t.published;
  const noTreeData = p && p.trees === 0, noA4Data = p && p.article4 === 0;

  const items = [];
  if (article4.length) items.push(`<li><strong>Article 4 area</strong> (${article4.map(escapeHTML).join("; ")}): some changes that normally need no
    planning permission do need it here. Depending on the direction, this can cover things like new windows, porches,
    extensions, or turning a house into flats or shared housing.</li>`);
  if (zoneHere) items.push("<li><strong>Tree Preservation Order area:</strong> the pin is inside an area where trees are protected.</li>");
  if (zonesNear) items.push(`<li>A <strong>Tree Preservation Order area</strong> is within ${TREE_NEAR_M} m of the pin.</li>`);
  if (trees.length) items.push(`<li><strong>${plural(trees.length, "protected tree")}</strong> within ${TREE_NEAR_M} m, the nearest ${trees[0].distanceKm != null && trees[0].distanceKm < 0.01
    ? "less than 10 m" : "about " + formatDistance(trees[0].distanceKm)} away${trees[0].order ? " (order " + escapeHTML(trees[0].order) + ")" : ""}.</li>`);
  const missing = [noTreeData && "protected trees", noA4Data && "Article 4 areas"].filter(Boolean);
  const missingNote = missing.length
    ? `<p><strong>${escapeHTML(council)} has not published its ${missing.join(" or ")} on planning.data.gov.uk</strong>, so a clear result is not possible
      for ${missing.length > 1 ? "these" : "this"}. Ask the council, or check the local authority search.</p>` : "";
  const unknownNote = p ? "" : "<p>We could not tell which council's data covers this place, so a clear result is not possible.</p>";

  let status, found;
  const bits = [article4.length && "Article 4 area", (zoneHere || zonesNear) && "Tree Preservation Order area",
    trees.length && plural(trees.length, "protected tree") + " nearby"].filter(Boolean);
  if (bits.length) {
    status = "info";
    found = "Found: " + bits.join(", ") + ".";
  } else if (!p || noTreeData || noA4Data) {
    status = "manual";
    found = !p ? "Could not tell whether the council has published this data. Ask the council."
      : missing.length > 1 ? `None published: ${council} has not published protected trees or Article 4 areas. Ask the council or your conveyancer.`
      : `No ${noTreeData ? "Article 4 area" : "protected trees"} found, but ${council} has not published its ${missing[0]}. Ask the council or your conveyancer.`;
  } else {
    status = "low";
    found = `No Article 4 area or protected trees found within ${TREE_NEAR_M} m, in the data ${council} has published.`;
  }

  const anyTree = zoneHere || zonesNear || trees.length;
  return {
    ...base, status, found,
    details: (items.length ? `<ul>${items.join("")}</ul>` : "") + missingNote + unknownNote,
    meaning: `<p><strong>Tree Preservation Orders</strong> protect single trees, groups or woodland. You need the council's consent to cut down,
      top or prune a protected tree, even in your own garden. Large trees close to a house can also matter for subsidence on clay soils.</p>
      <p><strong>Article 4 directions</strong> remove some "permitted development" rights, so changes that normally need no planning permission
      need it in that area. Each direction covers different things, so ask the council what this one restricts.</p>
      <p>This only shows what councils have published so far. The local authority search your conveyancer orders is the definitive record.</p>`,
    actions: [
      `Ask ${escapeHTML(council)} for a Tree Preservation Order and Article 4 check, or look on its planning website.`,
      ...(anyTree ? ["Look at the trees on and next to the property when you visit, and ask the surveyor about any close to the house."] : [])
    ],
    seller: anyTree ? ["Are any trees on or next to the property protected? Has any protected tree work been done, and was consent given?"] : [],
    conveyancer: ["Confirm from the local authority search whether a Tree Preservation Order or Article 4 direction affects the property."]
  };
}

function checkNature(R) {
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
