"use strict";
// Property Location Check – the search box: suggestions as you type, postcode and address search.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   SEARCH WITH SUGGESTIONS
   - Postcodes and place names are suggested as you type (postcodes.io).
   - Full addresses are searched when you press Enter or Search
     (OpenStreetMap Nominatim does not allow search-as-you-type).
========================================================= */

// The search box's hint is its label's words; on the narrowest screens a shorter hint fits without being cut off.
const narrowSearch = matchMedia("(max-width: 360px)");
const setSearchHint = () => { $("q").placeholder = narrowSearch.matches ? "Postcode or place" : "Postcode, address or place"; };
narrowSearch.addEventListener("change", setSearchHint);
setSearchHint();

// The message under the search box ("Finding your location…", "No match found", …); empty hides it.
function showSearchStatus(message, isError) {
  const el = $("searchStatus");
  el.textContent = message || "";
  el.className = "status" + (isError ? " error" : "") + (message ? "" : " hidden");
}

const POSTCODE_START = /^[A-Za-z]{1,2}\d/;
const FULL_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
let suggestTimer = null;
let suggestItems = [];
let activeIndex = -1;
let suggestRequest = 0;

$("q").addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const q = $("q").value.trim();
  if (q.length < 2) return hideSuggestions();
  suggestTimer = setTimeout(() => loadSuggestions(q), 250);
});

$("q").addEventListener("keydown", e => {
  const open = !$("suggestions").classList.contains("hidden");
  if (e.key === "ArrowDown" && open) { e.preventDefault(); moveActive(1); }
  else if (e.key === "ArrowUp" && open) { e.preventDefault(); moveActive(-1); }
  else if (e.key === "Escape") {
    if (open) hideSuggestions();
    else if (mapIsFull) { setControlOpen(searchControl, false); searchControl.btn.focus(); }
  }
  else if (e.key === "Enter") {
    e.preventDefault();
    if (open && activeIndex >= 0) chooseSuggestion(suggestItems[activeIndex]);
    else runSearch();
  }
});

$("searchBtn").addEventListener("click", runSearch);

document.addEventListener("click", e => {
  if (!e.target.closest(".search-box")) hideSuggestions();
});

async function loadSuggestions(q) {
  const requestId = ++suggestRequest;
  let items = [];
  try {
    if (POSTCODE_START.test(q)) {
      const d = await fetchJSON(API.postcodes + "/" + encodeURIComponent(q) + "/autocomplete?limit=10");
      items = (d.result || []).map(pc => ({ type: "postcode", label: pc, hint: "Postcode" }));
    } else {
      const d = await fetchJSON(API.places + "?q=" + encodeURIComponent(q) + "&limit=6");
      items = (d.result || [])
        .filter(p => !p.country || p.country === "England" || p.country === "Wales")
        .map(p => ({
          type: "place", label: p.name_1,
          hint: [p.local_type, p.district_borough || p.county_unitary, p.region].filter(Boolean).join(", "),
          lat: p.latitude, lon: p.longitude
        }));
    }
  } catch (e) {
    items = [];
  }
  if (requestId !== suggestRequest || $("q").value.trim() !== q) return;   // a newer search has started
  if (!FULL_POSTCODE.test(q)) items.push({ type: "address", label: q });
  showSuggestions(items);
}

function showSuggestions(items) {
  suggestItems = items;
  activeIndex = -1;
  const list = $("suggestions");
  if (!items.length) return hideSuggestions();
  list.innerHTML = items.map((it, i) => `
    <li role="option" id="sug-${i}" aria-selected="false" class="${it.type === "address" ? "address-search" : ""}" data-i="${i}">
      ${it.type === "address"
        ? "Search for “" + escapeHTML(it.label) + "” as an address"
        : escapeHTML(it.label) + `<br><small>${escapeHTML(it.hint)}</small>`}
    </li>`).join("");
  list.querySelectorAll("li").forEach(li =>
    li.addEventListener("click", () => chooseSuggestion(suggestItems[Number(li.dataset.i)])));
  list.classList.remove("hidden");
  $("q").setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
  $("suggestions").classList.add("hidden");
  $("q").setAttribute("aria-expanded", "false");
  $("q").removeAttribute("aria-activedescendant");
  activeIndex = -1;
}

function moveActive(step) {
  const lis = $("suggestions").querySelectorAll("li");
  if (!lis.length) return;
  activeIndex = (activeIndex + step + lis.length) % lis.length;
  lis.forEach((li, i) => li.setAttribute("aria-selected", i === activeIndex ? "true" : "false"));
  $("q").setAttribute("aria-activedescendant", "sug-" + activeIndex);
  lis[activeIndex].scrollIntoView({ block: "nearest" });
}

function chooseSuggestion(item) {
  hideSuggestions();
  if (!item) return;
  if (item.type === "postcode") return lookupPostcode(item.label);
  if (item.type === "place") {
    $("q").value = item.label;
    showSearchStatus("");
    setLocation(item.lat, item.lon, item.label, { zoom: item.isAddress ? 18 : 15 });
    if (!item.isAddress) $("confirmText").textContent = item.label + " (centre of the area)";
    return;
  }
  return addressSearch(item.label);
}

function runSearch() {
  const q = $("q").value.trim();
  hideSuggestions();
  if (!q) { $("q").focus(); return; }
  if (FULL_POSTCODE.test(q)) return lookupPostcode(q);
  return addressSearch(q);
}

async function lookupPostcode(pc) {
  showSearchStatus("Finding " + pc.toUpperCase() + "…");
  try {
    const r = (await fetchJSON(API.postcodes + "/" + encodeURIComponent(pc))).result;
    $("q").value = r.postcode;
    showSearchStatus("");
    setLocation(r.latitude, r.longitude, r.postcode + ", " + r.admin_district);
  } catch (e) {
    if (!$("q").value.trim()) $("q").value = pc.toUpperCase();   // opened from a link: show the postcode to correct it
    showSearchStatus("We couldn't find that postcode. Check it, or try the full address.", true);
  }
}

// Address search: OpenStreetMap's Nominatim first; if it does not answer, Photon (also OpenStreetMap data).
async function searchNominatim(q) {
  const results = await fetchJSON(API.nominatim + "?format=json&limit=5&countrycodes=gb&q=" + encodeURIComponent(q));
  return results.map(r => {
    const parts = r.display_name.split(",").map(s => s.trim());
    return { type: "place", isAddress: true, label: parts.slice(0, 3).join(", "),
      hint: parts.slice(3, 6).join(", "), lat: Number(r.lat), lon: Number(r.lon) };
  });
}
async function searchPhoton(q) {
  const d = await fetchJSON(API.photon + "?limit=5&bbox=-8.7,49.8,1.9,60.9&q=" + encodeURIComponent(q));
  return (d.features || []).filter(f => f.properties.countrycode === "GB").map(f => {
    const p = f.properties;
    const first = [p.housenumber, p.street].filter(Boolean).join(" ");
    const label = [p.name, first].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") || p.city || "";
    return { type: "place", isAddress: true, label, hint: [p.city || p.town, p.county, p.postcode].filter(Boolean).join(", "),
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
  });
}

async function addressSearch(q) {
  showSearchStatus("Searching for “" + q + "”…");
  try {
    const items = await searchNominatim(q).catch(() => searchPhoton(q));
    if (!items.length) {
      showSearchStatus("No match found. Try a postcode, or click the map to drop a pin.", true);
      return;
    }
    if (items.length === 1) return chooseSuggestion(items[0]);
    showSearchStatus("Several matches found. Pick the right one from the list.");
    showSuggestions(items);
  } catch (e) {
    showSearchStatus("Search failed: " + e.message + ". Try again, or click the map.", true);
  }
}
