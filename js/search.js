"use strict";
// Property Location Check – the map and the search box.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   MAP
========================================================= */

const ICONS = {
  search: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>`,
  layers: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8.5 12 14l10-5.5L12 3Z"/><path d="m2 13 10 5.5L22 13"/><path d="m2 17.5 10 5.5 10-5.5" opacity=".55"/></svg>`,
  expand: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
  collapse: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`,
  locate: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>`
};

// Touch screens: one finger scrolls the page, two fingers move the map.
const COARSE_POINTER = window.matchMedia("(pointer: coarse)").matches;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let mapIsFull = false;

let mapControls = [];

/* ---------- Background maps ----------
   Satellite is the default. If a provider stops serving tiles, the map
   switches to the next one automatically. */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const ESRI_CREDIT = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
const BASEMAPS = [
  { id: "satellite", name: "Satellite (with roads and names)",
    url: ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", maxNativeZoom: 19,
    attribution: ESRI_CREDIT + ", Maxar, Earthstar Geographics",
    labels: [ESRI + "Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
             ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"] },
  { id: "osm", name: "Street map (OpenStreetMap)",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  { id: "esriStreets", name: "Street map (Esri)",
    url: ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", maxNativeZoom: 19,
    attribution: ESRI_CREDIT + " — Source: Esri, HERE, Garmin, OpenStreetMap contributors and others" },
  { id: "topo", name: "Topographic (Esri)",
    url: ESRI + "World_Topo_Map/MapServer/tile/{z}/{y}/{x}", maxNativeZoom: 19,
    attribution: ESRI_CREDIT + " — Source: Esri, HERE, Garmin, OpenStreetMap contributors and others" },
  { id: "light", name: "Light map (CARTO)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", maxNativeZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' }
];
let currentBasemap = null;
let basemapLayers = [];

// Build the tile layers for one background map (plus labels for satellite).
function makeBasemapLayers(bm) {
  const opts = { maxZoom: 20, maxNativeZoom: bm.maxNativeZoom, attribution: bm.attribution, crossOrigin: true };
  const layers = [L.tileLayer(bm.url, opts)];
  (bm.labels || []).forEach(u => layers.push(L.tileLayer(u, { maxZoom: 20, maxNativeZoom: 19 })));
  return layers;
}

function setBasemap(id, isAutomatic) {
  const bm = BASEMAPS.find(b => b.id === id) || BASEMAPS[0];
  basemapLayers.forEach(l => map.removeLayer(l));
  basemapLayers = makeBasemapLayers(bm);
  basemapLayers.forEach(l => l.addTo(map));
  basemapLayers[0].bringToBack();
  currentBasemap = bm;
  const radio = document.querySelector(`input[name="basemap"][value="${bm.id}"]`);
  if (radio) radio.checked = true;
  watchBasemap(basemapLayers[0], bm);
  if (isAutomatic) showSearchStatus("The previous background map was not loading, so we switched to: " + bm.name + ".");
}

// If a provider fails (many tile errors and none loaded), move to the next one.
function watchBasemap(layer, bm) {
  let loaded = 0, failed = 0;
  layer.on("tileload", () => { loaded++; });
  layer.on("tileerror", () => {
    failed++;
    if (failed >= 6 && loaded === 0 && currentBasemap === bm) {
      const next = BASEMAPS[(BASEMAPS.indexOf(bm) + 1) % BASEMAPS.length];
      if (next !== bm) setBasemap(next.id, true);
    }
  });
}

// The box and button shared by every map button.
function mapButton(ctrl, icon, label) {
  const box = L.DomUtil.create("div", "map-ctrl leaflet-control");
  const btn = L.DomUtil.create("button", "map-btn", box);
  btn.type = "button";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = icon;
  L.DomEvent.disableClickPropagation(box);
  // Stop the click reaching the map too: the icon can change during the click, so the map
  // could not otherwise tell the click came from a button (and would move the pin).
  L.DomEvent.on(box, "click", L.DomEvent.stopPropagation);
  ctrl.box = box;
  ctrl.btn = btn;
  return { box, btn };
}

// A map button that opens a small panel.
function iconControl(position, icon, label, buildPanel) {
  const ctrl = L.control({ position });
  ctrl.onAdd = () => {
    const { box, btn } = mapButton(ctrl, icon, label);
    btn.setAttribute("aria-expanded", "false");
    const pop = L.DomUtil.create("div", "map-pop", box);
    buildPanel(pop);
    L.DomEvent.disableScrollPropagation(box);
    btn.addEventListener("click", () => setControlOpen(ctrl, !box.classList.contains("open")));
    return box;
  };
  mapControls.push(ctrl);
  return ctrl;
}

// A single map button that does something when pressed.
function buttonControl(position, icon, label, onClick) {
  const ctrl = L.control({ position });
  ctrl.onAdd = () => {
    const { box, btn } = mapButton(ctrl, icon, label);
    btn.addEventListener("click", () => onClick(btn));
    return box;
  };
  return ctrl;
}

function setControlOpen(ctrl, open) {
  if (open) mapControls.forEach(c => c !== ctrl && setControlOpen(c, false));   // one panel at a time
  ctrl.box.classList.toggle("open", open);
  ctrl.btn.setAttribute("aria-expanded", String(open));
  if (open && ctrl === searchControl) setTimeout(() => $("q").focus(), 0);
  if (!open && ctrl === searchControl) hideSuggestions();
}

function anyControlOpen() {
  return mapControls.some(c => c.box && c.box.classList.contains("open"));
}

let searchControl, layersControl, fullControl, locateControl;

function initMap() {
  map = L.map("map", {
    zoomControl: false, maxZoom: 20,
    scrollWheelZoom: false,          // zoom with Ctrl/⌘ + scroll instead (see setupGestureHandling)
    dragging: !COARSE_POINTER        // on touch screens, two fingers move the map
  }).setView([52.8, -1.6], 6);

  noiseLayer = L.tileLayer.wms(API.roadNoise, {
    layers: "Road_Noise_Lden_England_Round_4_All", format: "image/png",
    transparent: true, opacity: 0.55, attribution: "Road noise: Defra (OGL)"
  });

  // Top left: search, shown only in full screen. The page's search box moves inside it then
  // (placeSearchBox), and back above the map when full screen closes.
  searchControl = iconControl("topleft", ICONS.search, "Search for a postcode, address or place", () => {});
  searchControl.addTo(map);
  searchControl.box.classList.add("search-ctl");

  // Top right: layers and map key, then full screen.
  layersControl = iconControl("topright", ICONS.layers, "Map layers and key", pop => {
    pop.innerHTML = `
      <h3>Background map</h3>
      ${BASEMAPS.map((b, i) => `<label class="switch"><input type="radio" name="basemap" value="${b.id}" ${i === 0 ? "checked" : ""}> ${escapeHTML(b.name)}</label>`).join("")}
      <h3>Extra layers</h3>
      <label class="switch"><input type="checkbox" id="noiseToggle"> Show road noise</label>
      <h3>Map key</h3>
      <ul class="map-key">
        <li><span class="dot" style="background:#2a81cb"></span>The property (pin)</li>
        <li><span class="dot" style="background:transparent;box-shadow:0 0 0 2px #087f8c"></span>Search area</li>
        <li><span class="dot" style="background:${MAP_COLOURS.landfill}"></span>Old landfill site</li>
        <li><span class="dot" style="background:${MAP_COLOURS.contaminated}"></span>Contaminated land</li>
        <li><span class="dot" style="background:${MAP_COLOURS.hazard}"></span>Major hazard site</li>
        <li><span class="dot" style="background:${MAP_COLOURS.landslide}"></span>Recorded landslide</li>
        <li><span class="dot" style="background:${MAP_COLOURS.coalTip}"></span>Disused coal tip (Wales)</li>
        <li><span class="dot" style="background:${MAP_COLOURS.wasteSite}"></span>Licensed waste site (Scotland)</li>
      </ul>`;
    pop.querySelectorAll('input[name="basemap"]').forEach(radio =>
      radio.addEventListener("change", () => setBasemap(radio.value)));
    pop.querySelector("#noiseToggle").addEventListener("change", e => {
      if (e.target.checked) noiseLayer.addTo(map); else map.removeLayer(noiseLayer);
    });
  });
  layersControl.addTo(map);

  fullControl = buttonControl("topright", ICONS.expand, "Full-screen map", () => setMapFull(!mapIsFull));
  fullControl.addTo(map);

  setBasemap(BASEMAPS[0].id);   // satellite by default

  // Bottom right: zoom buttons, with "my location" above them.
  L.control.zoom({ position: "bottomright" }).addTo(map);
  locateControl = buttonControl("bottomright", ICONS.locate, "Put the pin where I am", locateMe);
  locateControl.addTo(map);

  featureLayer = L.layerGroup().addTo(map);
  setupGestureHandling();

  // In full screen the page's "Check this property" button is hidden, so show one on the map.
  const mapRun = L.DomUtil.create("button", "map-run", map.getContainer());
  mapRun.id = "mapRunBtn";
  mapRun.type = "button";
  mapRun.textContent = "Check this property";
  L.DomEvent.disableClickPropagation(mapRun);
  mapRun.addEventListener("click", () => runChecks());   // runChecks closes full screen itself

  // A tap on the map closes an open panel first, so the pin is not moved by accident.
  map.on("click", e => {
    if (anyControlOpen()) {
      mapControls.forEach(c => setControlOpen(c, false));
      return;
    }
    setLocation(e.latlng.lat, e.latlng.lng, null, { keepZoom: true });
  });
}

// Show a short hint when someone tries to move the map with one finger,
// or scroll-zoom without Ctrl/⌘, so the page can scroll normally.
function setupGestureHandling() {
  const el = map.getContainer();
  const hint = L.DomUtil.create("div", "map-hint", el);
  hint.setAttribute("aria-hidden", "true");
  let hideTimer;
  const showHint = text => {
    if (mapIsFull) return;
    hint.textContent = text;
    hint.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hint.classList.remove("show"), 1300);
  };

  el.addEventListener("touchmove", e => {
    if (!COARSE_POINTER || mapIsFull) return;
    if (e.touches.length === 1 && !e.target.closest(".leaflet-marker-icon, .leaflet-control")) {
      showHint("Use two fingers to move the map");
    } else {
      hint.classList.remove("show");
    }
  }, { passive: true });

  let wheelTotal = 0, lastZoomAt = 0;
  el.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey || mapIsFull)) {
      showHint(IS_MAC ? "Use ⌘ + scroll to zoom the map" : "Use Ctrl + scroll to zoom the map");
      return;                       // let the page scroll
    }
    e.preventDefault();
    wheelTotal += e.deltaY;
    const now = Date.now();
    if (Math.abs(wheelTotal) >= 40 && now - lastZoomAt > 180) {
      map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (wheelTotal < 0 ? 1 : -1));
      wheelTotal = 0;
      lastZoomAt = now;
    }
  }, { passive: false });
}

// Full-screen map: one finger moves the map, the wheel zooms.
function setMapFull(on, fromHistory) {
  // The phone's Back button closes the full-screen map.
  if (on && !mapIsFull && !fromHistory) history.pushState({ view: "fullmap" }, "", location.href);
  if (!on && mapIsFull && !fromHistory && history.state && history.state.view === "fullmap") {
    history.back();                 // the popstate handler finishes closing it
    return;
  }
  mapIsFull = on;
  $("map").classList.toggle("map-full", on);
  placeSearchBox();
  document.body.classList.toggle("no-scroll", on);
  if (COARSE_POINTER) { if (on) map.dragging.enable(); else map.dragging.disable(); }
  fullControl.btn.innerHTML = on ? ICONS.collapse : ICONS.expand;
  fullControl.btn.title = on ? "Exit full screen" : "Full-screen map";
  fullControl.btn.setAttribute("aria-label", fullControl.btn.title);
  fullControl.btn.classList.toggle("active", on);
  updateMapRunButton();
  updateStickyRun();
  setTimeout(() => map.invalidateSize(), 60);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && mapIsFull) setMapFull(false);
});

// The search box sits above the map, or inside the map's search button in full screen.
function placeSearchBox() {
  const box = $("searchBox");
  if (mapIsFull) searchControl.box.querySelector(".map-pop").appendChild(box);
  else { setControlOpen(searchControl, false); $("searchPanel").insertBefore(box, $("searchStatus")); }
}

// Take the reader to the search box: on the page, or opened on the full-screen map.
function openSearch() {
  if (mapIsFull) setControlOpen(searchControl, true);
  else { $("searchBox").scrollIntoView({ block: "nearest" }); $("q").focus(); }
}

function updateMapRunButton() {
  const btn = $("mapRunBtn");
  if (btn) btn.classList.toggle("show", mapIsFull && !!selected);
}

function locateMe(btn) {
  if (!navigator.geolocation) return showSearchStatus("Your browser cannot share its location.", true);
  if (btn) btn.classList.add("busy");
  showSearchStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    p => {
      if (btn) btn.classList.remove("busy");
      showSearchStatus("");
      setLocation(p.coords.latitude, p.coords.longitude, null);
    },
    e => {
      if (btn) btn.classList.remove("busy");
      showSearchStatus("Your location is not available: " + e.message + ". Check that location access is allowed.", true);
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

function setLocation(lat, lon, label, options = {}) {
  lat = Number(lat); lon = Number(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    showSearchStatus("That location is not valid. Search for a postcode, or tap the map.", true);
    return;
  }
  const inUK = lat >= 49.8 && lat <= 61 && lon >= -8.7 && lon <= 2;
  showSearchStatus(inUK ? "" : "This location is outside the UK. The checks cover England, Wales, Scotland and Northern Ireland.", !inUK);

  // Keep a searched name when the pin is only nudged (within 200 m), and never
  // overwrite a name the user typed in More options.
  if (label) namedPlace = { lat, lon, label };
  else if (namedPlace && distanceKm(namedPlace, { lat, lon }) <= 0.2) label = namedPlace.label;
  else namedPlace = null;

  selected = { lat, lon, label: label || null };
  $("latitude").value = lat.toFixed(6);
  $("longitude").value = lon.toFixed(6);
  if (!siteNameTyped) $("siteName").value = label || "";

  if (!marker) {
    marker = L.marker([lat, lon], { draggable: true, title: "Property location", keyboard: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      setLocation(p.lat, p.lng, null, { keepZoom: true });
    });
  } else {
    marker.setLatLng([lat, lon]);
  }

  if (!options.keepZoom || map.getZoom() < 15) map.setView([lat, lon], options.zoom || 17);
  else map.panTo([lat, lon]);

  featureLayer.clearLayers();
  drawRadius();
  if (searchControl) setControlOpen(searchControl, false);   // show the pin, not the search panel
  updateMapRunButton();

  $("confirm").classList.remove("hidden");
  $("confirmText").textContent = label || "Pin placed on the map";

  updateStickyRun();

  // When the pin is placed by hand, name it after the nearest postcode.
  if (!label) {
    fetchJSON(API.postcodes + "?lon=" + lon + "&lat=" + lat + "&radius=500&limit=1")
      .then(d => {
        const pc = d.result && d.result[0];
        if (pc && selected && selected.lat === lat && selected.lon === lon) {
          selected.label = "Near " + pc.postcode;
          if (!siteNameTyped) $("siteName").value = selected.label;
          $("confirmText").textContent = "Near " + pc.postcode + ", " + pc.admin_district;
        }
      })
      .catch(() => {});
  }
}

function drawRadius() {
  if (!selected) return;
  if (radiusCircle) map.removeLayer(radiusCircle);
  radiusCircle = L.circle([selected.lat, selected.lon], {
    radius: Number($("radius").value), color: "#087f8c", weight: 2,
    fillColor: "#087f8c", fillOpacity: 0.05, interactive: false
  }).addTo(map);
}

function addMapPoint(layer, lat, lon, colour, popup) {
  L.circleMarker([lat, lon], { radius: 7, color: "#fff", weight: 2, fillColor: colour, fillOpacity: 0.95 })
    .bindPopup(popup).addTo(layer);
}

$("radius").addEventListener("change", () => { drawRadius(); updateStickyRun(); });

let namedPlace = null;        // the last place found by search, to keep its name when the pin is nudged
let siteNameTyped = false;    // true once the user types their own name
$("siteName").addEventListener("input", () => { siteNameTyped = $("siteName").value.trim() !== ""; });

$("usePinBtn").addEventListener("click", () => {
  const lat = Number($("latitude").value), lon = Number($("longitude").value);
  if (!$("latitude").value || !$("longitude").value || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    alert("Please enter a valid latitude and longitude.");
    return;
  }
  setLocation(lat, lon, $("siteName").value.trim() || null);
});

/* =========================================================
   SEARCH WITH SUGGESTIONS
   - Postcodes and place names are suggested as you type (postcodes.io).
   - Full addresses are searched when you press Enter or Search
     (OpenStreetMap Nominatim does not allow search-as-you-type).
========================================================= */

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
