"use strict";
// Property Location Check – map, search, running the checks, the report, saved properties, sharing and start-up.
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

  // Top left: search. The search box from the page is moved inside it.
  searchControl = iconControl("topleft", ICONS.search, "Search for a postcode, address or place",
    pop => pop.appendChild($("searchBox")));
  searchControl.addTo(map);

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
  showSearchStatus(inUK ? "" : "This location is outside the UK. The checks cover England, and some cover Scotland, Wales and Northern Ireland.", !inUK);

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
    else { setControlOpen(searchControl, false); searchControl.btn.focus(); }
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

async function addressSearch(q) {
  showSearchStatus("Searching for “" + q + "”…");
  try {
    const results = await fetchJSON(API.nominatim + "?format=json&limit=5&countrycodes=gb&q=" + encodeURIComponent(q));
    if (!results.length) {
      showSearchStatus("No match found. Try a postcode, or click the map to drop a pin.", true);
      return;
    }
    const items = results.map(r => {
      const parts = r.display_name.split(",").map(s => s.trim());
      return { type: "place", isAddress: true, label: parts.slice(0, 3).join(", "),
        hint: parts.slice(3, 6).join(", "), lat: Number(r.lat), lon: Number(r.lon) };
    });
    if (items.length === 1) return chooseSuggestion(items[0]);
    showSearchStatus("Several matches found. Pick the right one from the list.");
    showSuggestions(items);
  } catch (e) {
    showSearchStatus("Search failed: " + e.message + ". Try again, or click the map.", true);
  }
}


/* =========================================================
   STORAGE – only on this device
========================================================= */

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { showStorageProblem(); return false; }   // storage full or blocked
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage blocked: nothing to remove */ }
  }
};

// Say plainly when something could not be saved, instead of losing it silently.
function showStorageProblem() { $("storageBar").classList.remove("hidden"); }
$("storageBarClose").addEventListener("click", () => $("storageBar").classList.add("hidden"));

// Ask the browser not to clear saved properties when the device is short of space.
// Most browsers decide by themselves, without asking the user.
function askToKeepData() {
  try {
    if (navigator.storage && navigator.storage.persist && !store.get("plc-persist-asked", false)) {
      navigator.storage.persist().catch(() => {});
      localStorage.setItem("plc-persist-asked", "true");
    }
  } catch (e) {}
}
const SAVED_KEY = "plc-saved-v1";
const MAX_SAVED = 20;

function reportKey(loc) {
  return `${Number(loc.lat).toFixed(5)},${Number(loc.lon).toFixed(5)},${loc.radius}`;
}

function reportUrl(loc) {
  const params = new URLSearchParams({ lat: Number(loc.lat).toFixed(6), lon: Number(loc.lon).toFixed(6), name: loc.name, r: loc.radius });
  return location.pathname + "?" + params;
}

/* =========================================================
   RUN THE CHECKS – results appear as soon as their data arrives
========================================================= */

let run = null;                 // the report being built
let reportFeatureLayer = null;  // dots on the report map

$("runBtn").addEventListener("click", () => runChecks());

function runChecks(options = {}) {
  if (!selected) { setControlOpen(searchControl, true); return; }
  if (!navigator.onLine) {                 // no signal: start by itself once it is back
    queuedRun = { options, name: $("siteName").value.trim() || selected.label || "this location" };
    updateOfflineBar();
    $("offlineBar").scrollIntoView({ block: "nearest" });
    return;
  }
  queuedRun = null;
  updateOfflineBar();
  const wasFull = mapIsFull;
  if (mapIsFull) setMapFull(false, true);
  const loc = {
    name: $("siteName").value.trim() || selected.label || "Selected location",
    lat: selected.lat, lon: selected.lon, radius: Number($("radius").value)
  };

  run = { loc, R: { loc }, results: {}, done: false };
  reportData = null;
  $("runBtn").disabled = true;
  featureLayer.clearLayers();
  // Browser history: Back from a report returns to the search and map.
  const url = reportUrl(loc);
  if (options.fromHistory) { /* the address is already right */ }
  else if (options.fromLoad || wasFull) history.replaceState({ view: "report" }, "", url);
  else history.pushState({ view: "report" }, "", url);
  shownSearch = location.search;
  lastRunKey = reportKey(loc);
  updateStickyRun();

  renderSkeleton(loc);
  setExportEnabled(false);
  $("toolbar").classList.remove("hidden");
  $("reportNav").classList.remove("hidden");
  $("comparePanel").classList.add("hidden");
  $("reportPanel").scrollIntoView({ behavior: "smooth", block: "start" });

  TASKS.forEach(([key]) => startTask(run, key));
}

/* ---------- no signal ---------- */
let queuedRun = null;   // a check asked for while offline

function updateOfflineBar() {
  const bar = $("offlineBar");
  const offline = !navigator.onLine;
  bar.classList.toggle("hidden", !offline);
  if (!offline) return;
  bar.innerHTML = queuedRun
    ? `<span>You're offline. <strong>Your check of ${escapeHTML(queuedRun.name)} will start by itself</strong> when the signal returns.
        Saved properties still open.</span><button class="link-btn" type="button" id="cancelQueued">Cancel</button>`
    : `<span>You're offline. Saved properties still open; new checks need a signal.</span>`;
}
window.addEventListener("offline", updateOfflineBar);
window.addEventListener("online", () => {
  updateOfflineBar();
  if (queuedRun && selected) { const { options } = queuedRun; runChecks(options); }
});
document.addEventListener("click", e => {
  if (e.target.id === "cancelQueued") { queuedRun = null; updateOfflineBar(); }
});
updateOfflineBar();

let lastRunKey = null;
let shownSearch = location.search;   // the ?lat=… part of the address for what is on screen
const REPORT_PLACEHOLDER = $("report").innerHTML;

// Back to the search and map, as before the report was run.
function showSearchView() {
  run = null;
  reportData = null;
  lastRunKey = null;
  if (reportMap) { reportMap.remove(); reportMap = null; }
  featureLayer.clearLayers();
  $("report").innerHTML = REPORT_PLACEHOLDER;
  $("toolbar").classList.add("hidden");
  $("reportNav").classList.add("hidden");
  $("runBtn").disabled = false;
  shownSearch = location.search;
  updateStickyRun();
  window.scrollTo({ top: 0 });
}

window.addEventListener("popstate", () => {
  if (mapIsFull) { setMapFull(false, true); return; }      // Back closes the full-screen map first
  if (location.search === shownSearch) return;              // only the #section part changed
  if (!openReportFromAddress({ fromHistory: true })) showSearchView();
});

// A report address (?lat=..&lon=..&name=..&r=..): open its saved results, or run the checks.
// Returns false when the address has no location.
function openReportFromAddress(options) {
  const params = new URLSearchParams(location.search);
  const r = params.get("r");
  if (r && [...$("radius").options].some(o => o.value === r)) $("radius").value = r;
  if (!params.has("lat") || !params.has("lon")) return false;
  setLocation(params.get("lat"), params.get("lon"), params.get("name") || null);
  const snap = selected && findSnapshot({ lat: selected.lat, lon: selected.lon, radius: Number($("radius").value) });
  if (snap) showSnapshot(snap, options.fromHistory ? { fromHistory: true } : {}); else runChecks(options);
  return true;
}

// A topic whose data fails is tried once more by itself: after 20 seconds,
// or as soon as the signal returns if the device went offline.
// If it fails again, the topic shows a "Try again" button.
const AUTO_RETRY_MS = 20000;
const onlineAgain = () => navigator.onLine ? Promise.resolve()
  : new Promise(res => window.addEventListener("online", res, { once: true }));

function startTask(r, key, autoRetry = true) {
  delete r.R[key];
  TASK_FN[key](r.loc).then(
    value => { r.R[key] = { ok: true, value }; },
    async error => {
      if (autoRetry && r === run) {
        if (navigator.onLine) await new Promise(res => setTimeout(res, AUTO_RETRY_MS));
        else await onlineAgain();
        if (r === run) { r.autoRetried = [...(r.autoRetried || []), key]; startTask(r, key, false); }
        return "retrying";
      }
      r.R[key] = { ok: false, error: error.message || "unknown error" };
    }
  ).then(state => { if (state !== "retrying" && r === run) onTaskSettled(key); });
}

const depsReady = c => c.deps.every(k => run.R[k]);

// A topic result with everything the report needs. Each check gives only what differs from these.
function topicResult(c, fields) {
  return { meaning: "", actions: [], seller: [], conveyancer: [], source: { name: "", url: "" }, ...fields, id: c.id, group: c.group, title: c.title };
}

function buildCheck(c) {
  const place = okValue(run.R, "place");
  const country = place && place.country;
  if (country && COVERAGE[c.id] && !COVERAGE[c.id].includes(country)) return notCovered(c, country, place);
  try { return topicResult(c, { dataDate: "Checked live on " + today(), ...c.build(run.R) }); }
  catch (e) { return topicResult(c, { status: "error", found: "This check failed: " + e.message }); }
}

function onTaskSettled(key) {
  CHECKS.filter(c => c.deps.includes(key) && depsReady(c)).forEach(c => {
    const result = buildCheck(c);
    run.results[c.id] = result;
    const slot = $("slot-" + c.id);
    if (slot) { slot.innerHTML = renderCheck(result); prepareTables(slot, c.title); }
  });
  if (key === "place") renderMeta();
  if (["landfill", "landslides", "planningNearby"].includes(key)) replotFeatures();
  if (TASKS.every(([k]) => run.R[k])) finishRun();
  else renderSummary();
}

function finishRun() {
  run.done = true;
  $("runBtn").disabled = false;
  renderSummary();
  $("checklistBox").innerHTML = buildChecklist(orderedResults());
  restoreTicks();
  renderSources();
  renderNotes();
  reportData = buildReportData();
  if (!run.snapshot) { saveCurrentReport(); saveSnapshot(); }
  setExportEnabled(true);
}

/* ---------- saved results, so a saved property reopens instantly ---------- */
const snapKey = key => "plc-snap:" + key;

function saveSnapshot() {
  const R = run.R;
  const nearby = R.planningNearby && R.planningNearby.ok
    ? { ok: true, value: R.planningNearby.value.filter(e => ["control-of-major-accident-hazards-site", "contaminated-land"].includes(e.dataset)) }
    : null;
  store.set(snapKey(reportKey(run.loc)), {
    savedAt: new Date().toISOString(), loc: run.loc,
    results: orderedResults(),
    R: { place: R.place, landfill: R.landfill, landslides: R.landslides, planningNearby: nearby }
  });
}

// Show a saved report straight away, without asking the data services again.
function showSnapshot(snap, options = {}) {
  const loc = snap.loc;
  run = { loc, R: { loc, ...snap.R }, results: {}, done: false, snapshot: snap };
  snap.results.forEach(c => { run.results[c.id] = c; });
  reportData = null;
  featureLayer.clearLayers();
  const url = reportUrl(loc);
  if (!options.fromHistory) history.replaceState({ view: "report" }, "", url);
  shownSearch = location.search;
  lastRunKey = reportKey(loc);
  updateStickyRun();
  renderSkeleton(loc);
  CHECKS.forEach(c => {
    const slot = $("slot-" + c.id);
    const res = run.results[c.id];
    if (!slot) return;
    // Topics added to the app after this property was saved.
    const shown = res || topicResult(c, { status: "manual", gap: "saved",
      found: "Not included in these saved results. Press “Refresh with the latest data” to check it." });
    if (!res) run.results[c.id] = shown;
    slot.innerHTML = renderCheck(shown);
    prepareTables(slot, c.title);
  });
  replotFeatures();
  $("toolbar").classList.remove("hidden");
  $("reportNav").classList.remove("hidden");
  finishRun();
}

function findSnapshot(loc) {
  return store.get(snapKey(reportKey(loc)), null);
}

$("report").addEventListener("click", e => {
  if (e.target.closest("#refreshBtn") && run) runChecks({ fromHistory: true });
});

/* ---------- private notes ---------- */
const notesKey = () => "plc-notes:" + reportKey(run.loc);

function renderNotes() {
  const text = store.get(notesKey(), "");
  $("notesBox").innerHTML = `
    <section class="group notes" id="notes">
      <h2><label for="notesText" style="display:inline;font-size:inherit">Your notes</label>${infoButton("info-notes", "About notes")}</h2>
      ${infoBox("info-notes", "<p>Private notes for this property, for example viewing times or questions. Saved only on this device, and included when you print or download the report.</p>")}
      <textarea id="notesText" rows="4" placeholder="e.g. Viewing on Saturday at 10am. Ask about the damp patch in the back bedroom."></textarea>
      <div class="notes-print" aria-hidden="true"></div>
    </section>`;
  $("notesText").value = text;
  $("notesBox").querySelector(".notes-print").textContent = text;
}

let notesTimer = null;
document.addEventListener("input", e => {
  if (e.target.id !== "notesText" || !run) return;
  const text = e.target.value;
  $("notesBox").querySelector(".notes-print").textContent = text;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => { store.set(notesKey(), text); renderSaved(); }, 400);
});

// Where each result came from, and how current the data is.
function renderSources() {
  const rows = orderedResults().filter(c => c.source && c.source.name).map(c => `<tr>
      <td>${escapeHTML(c.title)}</td>
      <td>${c.source.url ? link(c.source.url, c.source.name) : escapeHTML(c.source.name)}</td>
      <td>${escapeHTML(c.dataDate || "Checked live on " + today())}</td></tr>`).join("");
  $("sourcesBox").innerHTML = `
    <details class="group sources-fold" id="sources">
      <summary><h2>Data sources and dates <span class="muted-count">(${plural(orderedResults().filter(c => c.source && c.source.name).length, "topic")})</span></h2></summary>
      <div class="table-wrap"><table><thead><tr><th>Topic</th><th>Source</th><th>Data date</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>`;
  prepareTables($("sourcesBox"), "Data sources");
}

function orderedResults() {
  return CHECKS.map(c => run.results[c.id]).filter(Boolean);
}

function setExportEnabled(on) {
  ["downloadHtml", "printReport", "printSummary"].forEach(id => { $(id).disabled = !on; });
}

// Phones: keep "Check this property" at the bottom of the screen until it is pressed,
// whenever the page's own button is scrolled out of view.
let runBtnVisible = true;
if ("IntersectionObserver" in window) {
  new IntersectionObserver(entries => { runBtnVisible = entries[0].isIntersecting; updateStickyRun(); })
    .observe($("runBtn"));
}
function updateStickyRun() {
  const box = $("stickyRun");
  if (!box) return;
  const pending = selected && reportKey({ lat: selected.lat, lon: selected.lon, radius: Number($("radius").value) }) !== lastRunKey;
  const show = !!pending && !runBtnVisible && !mapIsFull && window.innerWidth <= 800 && !$("confirm").classList.contains("hidden");
  box.classList.toggle("hidden", !show);
  document.body.classList.toggle("has-sticky", show);
}
$("stickyRunBtn").addEventListener("click", () => runChecks());
window.addEventListener("resize", updateStickyRun);

// "Try again" on a check that could not load: re-fetch only the data it is missing.
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-retry]");
  if (!btn || !run) return;
  const c = CHECKS.find(x => x.id === btn.dataset.retry);
  if (!c) return;
  let keys = c.deps.filter(k => !run.R[k] || !run.R[k].ok);
  if (!keys.length) keys = c.deps.slice();
  keys.forEach(k => {
    delete run.R[k];
    CHECKS.filter(x => x.deps.includes(k)).forEach(x => {
      delete run.results[x.id];
      const slot = $("slot-" + x.id);
      if (slot) slot.innerHTML = loadingCard(x);
    });
  });
  run.done = false;            // the report is being completed again
  setExportEnabled(false);
  renderSummary();
  keys.forEach(k => startTask(run, k, false));
});

function plotFeatures(layer, R) {
  const nearby = okValue(R, "planningNearby");
  [
    [okValue(R, "landfill"), MAP_COLOURS.landfill, "Old landfill site", s => s.site_name || "Unnamed"],
    [okValue(R, "landslides"), MAP_COLOURS.landslide, "Recorded landslide", s => s.name],
    [byDataset(nearby, "control-of-major-accident-hazards-site"), MAP_COLOURS.hazard, "Major hazard site", s => s.name || ""],
    [byDataset(nearby, "contaminated-land"), MAP_COLOURS.contaminated, "Contaminated land", s => s.name || ""]
  ].forEach(([sites, colour, label, name]) => (sites || []).forEach(s => s.lat != null &&
    addMapPoint(layer, s.lat, s.lon, colour, `<strong>${label}</strong><br>` + escapeHTML(name(s)))));
}

function replotFeatures() {
  featureLayer.clearLayers();
  plotFeatures(featureLayer, run.R);
  if (reportFeatureLayer) {
    reportFeatureLayer.clearLayers();
    plotFeatures(reportFeatureLayer, run.R);
  }
}

/* =========================================================
   REPORT
========================================================= */

function chip(status) {
  return `<span class="chip ${status}">${STATUS_LABEL[status] || "Checking…"}</span>`;
}

function infoButton(targetId, label) {
  return `<button class="info-btn" type="button" aria-expanded="false" aria-controls="${targetId}" aria-label="${escapeHTML(label)}">i</button>`;
}

function infoBox(targetId, html) {
  return `<div class="info-body" id="${targetId}" hidden>${html}</div>`;
}

function loadingCard(c) {
  return `<div class="check loading" aria-busy="true">
      <div><h3>${escapeHTML(c.title)}</h3><div class="skeleton"></div></div>
      <span class="chip loading">Checking…</span>
    </div>`;
}

// Tables: label each cell (shown as stacked cards on phones) and let keyboard users scroll them.
function prepareTables(container, title) {
  container.querySelectorAll(".table-wrap").forEach(wrap => {
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", (title || "Table") + " table");
    const table = wrap.querySelector("table");
    if (!table) return;
    table.classList.add("stack-table");
    const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(tr =>
      [...tr.children].forEach((td, i) => { if (heads[i]) td.setAttribute("data-label", heads[i]); }));
  });
}

function renderCheck(c) {
  const open = ["high", "medium", "error"].includes(c.status);
  const actions = c.actions && c.actions.length
    ? `<ul>${c.actions.map(a => `<li>${a}</li>`).join("")}</ul>`
    : "<p>Nothing more is needed for this topic.</p>";
  return `
    <details class="check ${c.status}" id="check-${c.id}" ${open ? "open" : ""}>
      <summary>
        <h3>${escapeHTML(c.title)}</h3>${chip(c.status)}
        <span class="found">${escapeHTML(c.found)}</span>
      </summary>
      <div class="check-body">
        ${c.status === "error" ? `<p><button class="primary small-btn" type="button" data-retry="${c.id}">Try again</button></p>` : ""}
        ${c.details ? `<h4>What we found</h4>${c.details}` : ""}
        <h4>What to do</h4>${actions}
        ${c.dataDate ? `<p class="data-date"><strong>Data:</strong> ${escapeHTML(c.dataDate)}</p>` : ""}
        <div class="info-row">${infoButton("about-" + c.id, "What this means and where the data comes from")}<span>What this means, and the data source</span></div>
        <div class="info-body" id="about-${c.id}" hidden>
          ${c.meaning || ""}
          <p class="source">Source: ${c.source.url ? link(c.source.url, c.source.name) : escapeHTML(c.source.name)}${c.dataDate ? " · " + escapeHTML(c.dataDate) : ""}</p>
        </div>
      </div>
    </details>`;
}

function renderSkeleton(loc) {
  $("report").innerHTML = `
    <div class="cover" id="reportTop">
      <h1>Property Location Report</h1>
      <p class="meta" id="reportMeta"></p>
      <div id="reportMap" aria-label="Map of the property and nearby features"></div>
      <h2 class="summary-title">Summary${infoButton("info-read", "How to read this report")}</h2>
      ${infoBox("info-read", `
        <ul class="legend-list">
          <li><span class="chip high">Look into this</span> Something that could affect value, insurance, health or safety. Investigate before you commit.</li>
          <li><span class="chip medium">Worth checking</span> Something nearby or at a moderate level. Ask questions or order a specialist search.</li>
          <li><span class="chip low">No issue found</span> Nothing found in the data checked. This is not a guarantee.</li>
          <li><span class="chip info">For information</span> Useful local facts, for example planning restrictions.</li>
        </ul>
        <p><strong>Please note:</strong> this is a free first look using public data. It does not replace a building survey or
          the searches your conveyancer orders. “No issue found” means nothing was found in the data we checked, not that there
          is no risk. Results are for the pin location. Tap a heading to open or close a topic, and the
          <strong>i</strong> buttons for explanations.</p>`)}
      <div id="summaryBox" aria-live="polite"></div>
    </div>

    <div class="details-start">
      ${GROUPS.map(g => `
        <section class="group" id="group-${g.id}">
          <h2>${escapeHTML(g.title)}${infoButton("info-group-" + g.id, "About " + g.title)}</h2>
          ${infoBox("info-group-" + g.id, "<p>" + escapeHTML(g.intro) + "</p>")}
          ${CHECKS.filter(c => c.group === g.id).map(c => `<div class="slot" id="slot-${c.id}">${loadingCard(c)}</div>`).join("")}
        </section>`).join("")}
    </div>

    <div id="notesBox"></div>

    <div id="checklistBox">
      <section class="group checklist" id="checklist">
        <h2>Your checklist</h2>
        <p class="help">Your checklist appears here when all the checks are finished.</p>
      </section>
    </div>

    <div id="sourcesBox"></div>

    <p class="help">Created with Property Location Check (version ${APP_VERSION}). Contains public sector information licensed under the Open Government
      Licence v3.0; map data © OpenStreetMap contributors, © Esri and © CARTO; Copernicus Atmosphere Monitoring Service.</p>`;

  renderMeta();
  drawReportMap(loc);
  renderSummary();
  watchSections();
}

function renderMeta() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  $("reportMeta").innerHTML = `
    <strong>${escapeHTML(loc.name)}</strong><br>
    ${p ? `Nearest postcode ${escapeHTML(p.postcode)} · ${escapeHTML(p.admin_district || "")}${p.admin_ward ? " · " + escapeHTML(p.admin_ward) + " ward" : ""}<br>` : ""}
    Location ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} · Nearby search: ${formatRadius(loc.radius)} · Created ${escapeHTML(today())}`;
}

// Saved results older than this are flagged, with a suggestion to refresh them.
const OLD_MONTHS = 3;
function isOld(savedAt) {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - OLD_MONTHS);
  return new Date(savedAt) < limit;
}

function renderSummary() {
  const results = orderedResults();
  const n = s => results.filter(c => c.status === s).length;
  const ready = results.length;
  const p = okValue(run.R, "place");
  const outsideEngland = p && p.country && p.country !== "England";
  const priority = results.filter(c => ["high", "medium"].includes(c.status))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const gaps = n("manual") + n("error");
  const notCoveredText = gaps ? ` <strong>${plural(gaps, "topic")}</strong> could not be checked here (see “Where we could not give an answer”).` : "";

  let verdict;
  if (!run.done) {
    verdict = `<p class="verdict">Checking official data… <strong>${ready} of ${CHECKS.length}</strong> topics ready.</p>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${CHECKS.length}" aria-valuenow="${ready}">
        <span style="width:${Math.round(ready / CHECKS.length * 100)}%"></span></div>`;
  } else if (n("high") || n("medium")) {
    verdict = `<p class="verdict">We found <strong>${plural(n("high"), "thing")} to look into</strong> and
      <strong>${n("medium")} worth checking</strong>. ${plural(n("low"), "check")} found no issue.${notCoveredText}</p>`;
  } else {
    verdict = `<p class="verdict"><strong>No issues found</strong> in the ${plural(n("low") + n("info"), "check")} we ran.${notCoveredText}
      Still go through the checklist at the end.</p>`;
  }

  const old = run.snapshot && isOld(run.snapshot.savedAt);
  const savedNote = run.snapshot ? `<div class="notice saved-note${old ? " old" : ""}">Saved results from
      <strong>${escapeHTML(new Date(run.snapshot.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</strong>.
      ${old ? `<span><strong>These results are over ${OLD_MONTHS} months old.</strong> Official data may have changed since; refresh before relying on them.</span>` : ""}
      <button class="primary small-btn" type="button" id="refreshBtn">Refresh with the latest data</button></div>` : "";
  $("summaryBox").innerHTML = `
    ${savedNote}
    ${verdict}
    <div class="counts">
      <div class="count high"><strong>${n("high")}</strong><span>Look into this</span></div>
      <div class="count medium"><strong>${n("medium")}</strong><span>Worth checking</span></div>
      <div class="count low"><strong>${n("low")}</strong><span>No issue found</span></div>
      <div class="count info"><strong>${n("info")}</strong><span>For information</span></div>
    </div>
    <ul class="topic-strip" aria-label="All topics at a glance">
      ${CHECKS.map(c => {
        const res = run.results[c.id];
        const st = res ? res.status : "loading";
        const [icon, short] = TOPIC_ICONS[c.id];
        const label = res ? STATUS_LABEL[st] : "Checking";
        return `<li><button type="button" class="topic ${st}" data-why="${c.id}" aria-controls="whyBox"
            aria-expanded="${run.whyId === c.id}" aria-label="${escapeHTML(c.title)}: ${label}. Show why">
            <span class="topic-icon" aria-hidden="true">${icon}</span><span class="topic-name">${short}</span></button></li>`;
      }).join("")}
    </ul>
    <p class="help strip-hint no-print">Tap a topic to see why. Colours match the boxes above.</p>
    ${whyBox()}
    ${priority.length ? `<h3>Start here</h3><ul class="priority">${priority.map(c => `
      <li>${chip(c.status)} <a href="#check-${c.id}" data-open="check-${c.id}">${escapeHTML(c.title)}</a>
          <span>${escapeHTML(c.found)}</span></li>`).join("")}</ul>` : ""}
    ${dataGapsBox(results)}
    ${outsideEngland ? `<div class="notice"><strong>This location is in ${escapeHTML(p.country)}.</strong>
      Some official data only covers England. Those topics are marked “Check yourself”, with a link to the right national service.</div>` : ""}`;
}

// Topics with no real answer: why, and who to ask instead. Hidden when every topic has an answer.
const GAP_REASON = {
  coverage: "Not covered here",
  nodata: "No data found",
  down: "Service not answering",
  saved: "Not in saved results"
};

function gapKind(c) {
  if (c.status === "error") return "down";
  return c.status === "manual" ? (c.gap || "nodata") : null;
}

function dataGapsBox(results) {
  const gaps = results.filter(gapKind);
  if (!gaps.length) return "";
  const askInstead = c => {
    if (gapKind(c) === "down") {
      return `<button class="primary small-btn" type="button" data-retry="${c.id}">Try again</button>` +
        (c.source && c.source.url ? ` or use ${link(c.source.url, c.source.name)}` : "") +
        `. Is it down for everyone? See ${link(new URL("status.html", location.href).href, "data service status")}.`;
    }
    if (gapKind(c) === "saved") return "Press “Refresh with the latest data” above.";
    if (c.actions && c.actions.length) return c.actions[0];
    return c.source && c.source.url ? `See ${link(c.source.url, c.source.name)}.` : "Ask your conveyancer to include this in their searches.";
  };
  return `<section class="gaps-box" aria-labelledby="gapsTitle">
    <h3 id="gapsTitle">Where we could not give an answer</h3>
    <p>${plural(gaps.length, "topic")} could not be checked here. Missing data does not mean there is no problem, so check ${gaps.length === 1 ? "it" : "them"} another way.</p>
    <ul>${gaps.map(c => `<li><span class="gap-reason">${GAP_REASON[gapKind(c)]}</span>
      <a href="#check-${c.id}" data-open="check-${c.id}">${escapeHTML(c.title)}</a>
      <span>${escapeHTML(c.found)}</span>
      <span class="gap-ask"><strong>Instead:</strong> ${askInstead(c)}</span></li>`).join("")}</ul>
  </section>`;
}

// The one-line reason for the topic tapped in the strip above.
function whyBox() {
  const c = run.whyId && CHECKS.find(x => x.id === run.whyId);
  if (!c) return `<div id="whyBox" hidden></div>`;
  const res = run.results[c.id];
  const st = res ? res.status : "loading";
  const text = res ? res.found : "Still checking the official data…";
  return `<div id="whyBox" class="why-box ${st}" aria-live="polite">
    <strong>${escapeHTML(c.title)}: ${res ? STATUS_LABEL[st] : "Checking"}</strong>
    <p>${escapeHTML(text || "")}</p>
    ${res ? `<a href="#check-${c.id}" data-open="check-${c.id}">Read the full section</a>` : ""}</div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-why]");
  if (!btn || !run) return;
  run.whyId = run.whyId === btn.dataset.why ? null : btn.dataset.why;
  renderSummary();
  const again = document.querySelector(`[data-why="${btn.dataset.why}"]`);
  if (again) again.focus();
});

function drawReportMap(loc) {
  if (reportMap) { reportMap.remove(); reportMap = null; }
  reportMap = L.map("reportMap", {
    zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false
  });
  // Set the view first: layers need a map view before they can be drawn.
  reportMap.fitBounds(L.latLng(loc.lat, loc.lon).toBounds(loc.radius * 2), { padding: [10, 10] });
  makeBasemapLayers(currentBasemap || BASEMAPS[0]).forEach(l => l.addTo(reportMap));   // same background as the main map
  L.circle([loc.lat, loc.lon], { radius: loc.radius, color: "#087f8c", weight: 2, fillOpacity: 0.05 }).addTo(reportMap);
  L.marker([loc.lat, loc.lon]).addTo(reportMap);
  reportFeatureLayer = L.layerGroup().addTo(reportMap);
}

/* ---------- checklist with ticks remembered on this device ---------- */

const plainText = html => String(html).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function buildChecklist(checks) {
  const uniq = arr => [...new Set(arr)];
  const seller = uniq([
    ...checks.flatMap(c => c.seller || []),
    "Is there, or has there ever been, Japanese knotweed on or near the property?",
    "Are there any disputes with neighbours, or shared access or drainage arrangements?"
  ]).map(escapeHTML);
  const conveyancer = uniq([
    "A local authority search (planning history, road schemes, building control).",
    "A drainage and water search.",
    ...checks.flatMap(c => c.conveyancer || [])
  ]).map(escapeHTML);
  const yourself = [
    `Check flooding from groundwater and reservoirs: ${link(LINKS.floodLongTerm, "GOV.UK long-term flood risk")}.`,
    `See the full noise maps for your street: ${link(LINKS.noise, "Defra noise maps")}.`,
    `Find the energy performance certificate (EPC): ${link(LINKS.epc, "GOV.UK")}.`,
    `Check mobile and broadband coverage: ${link(LINKS.ofcom, "Ofcom")}.`,
    "Search the council's planning website for applications nearby.",
    "Visit at different times of day, including rush hour and evening.",
    "Get a building survey (RICS Level 2 or 3), especially for older homes."
  ];
  lastChecklist = { seller: seller.map(plainText), conveyancer: conveyancer.map(plainText) };
  const list = items => `<ul>${items.map(i =>
    `<li><label class="tick"><input type="checkbox" data-tick="${escapeHTML(plainText(i))}"><span>${i}</span></label></li>`).join("")}</ul>`;
  return `
    <section class="group checklist" id="checklist">
      <h2>Your checklist${infoButton("info-checklist", "About the checklist")}</h2>
      ${infoBox("info-checklist", "<p>Everything to follow up, gathered from the checks above. Tick items as you go: your ticks are remembered on this device for this property.</p>")}
      <div class="send-box no-print">
        <p><strong>Send to my conveyancer:</strong> an email with the link to this report, the topics to look into and the questions below.</p>
        <div class="send-buttons">
          <button class="primary" id="emailConveyancer" type="button">Email to my conveyancer</button>
          <button class="secondary" id="copyConveyancer" type="button">Copy as text</button>
        </div>
        <p class="help" id="sendNote" role="status"></p>
      </div>
      <h3>Questions to ask the seller or estate agent</h3>${list(seller)}
      <h3>Searches and reports to ask your conveyancer for</h3>${list(conveyancer)}
      <h3>Things to check yourself</h3>${list(yourself)}
    </section>`;
}

let lastChecklist = { seller: [], conveyancer: [] };

/* ---------- send to my conveyancer ---------- */
// Plain text for an email or a message. Nothing passes through the app: the email opens in the person's
// own email app, or the text is copied for them to paste.
function conveyancerText() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  const where = loc.name + (p && p.postcode && !loc.name.includes(p.postcode) ? ` (near ${p.postcode})` : "");
  const flagged = orderedResults().filter(c => c.status === "high" || c.status === "medium");
  const lines = [
    "Hello,", "",
    `I am looking at buying ${where}. I ran a free check of official open data for the location. The full report is here:`,
    new URL(reportUrl(loc), location.href).href, ""
  ];
  if (flagged.length) {
    lines.push("Topics to look into:");
    flagged.forEach(c => lines.push(`- ${c.title}: ${STATUS_LABEL[c.status]}. ${plainText(c.found)}`));
  } else {
    lines.push("The check found nothing rated \"Look into this\" or \"Worth checking\".");
  }
  lines.push("", "Please could you include these searches:");
  lastChecklist.conveyancer.forEach(i => lines.push("- " + i));
  lines.push("", "Questions I plan to ask the seller or estate agent:");
  lastChecklist.seller.forEach(i => lines.push("- " + i));
  lines.push("", "This check is a first look from public data and does not replace the official searches.", "", "Thank you");
  return lines.join("\n");
}

function conveyancerSubject() {
  return "Property I am buying: " + run.loc.name;
}

document.addEventListener("click", async e => {
  if (!run) return;
  if (e.target.closest("#emailConveyancer")) {
    e.preventDefault();
    $("sendNote").textContent = "Opening your email app. Add your conveyancer's address and send. If the email looks cut off, use Copy as text.";
    location.href = "mailto:?subject=" + encodeURIComponent(conveyancerSubject()) + "&body=" + encodeURIComponent(conveyancerText());
  }
  if (e.target.closest("#copyConveyancer")) {
    const text = conveyancerSubject() + "\n\n" + conveyancerText();
    try { await navigator.clipboard.writeText(text); $("sendNote").textContent = "Copied. Paste it into an email or message to your conveyancer."; }
    catch (err) { prompt("Copy this text:", text); }
  }
});

const ticksKey = () => "plc-ticks:" + reportKey(run.loc);

function restoreTicks() {
  const ticked = new Set(store.get(ticksKey(), []));
  document.querySelectorAll("#checklist input[data-tick]").forEach(box => { box.checked = ticked.has(box.dataset.tick); });
}

document.addEventListener("change", e => {
  const box = e.target.closest("#checklist input[data-tick]");
  if (!box || !run) return;
  const ticked = new Set(store.get(ticksKey(), []));
  if (box.checked) ticked.add(box.dataset.tick); else ticked.delete(box.dataset.tick);
  store.set(ticksKey(), [...ticked]);
});

/* ---------- section bar, open/close all, back to top ---------- */

let sectionObserver = null;
function watchSections() {
  if (sectionObserver) sectionObserver.disconnect();
  if (!("IntersectionObserver" in window)) return;
  sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      document.querySelectorAll("#reportNav a").forEach(a => a.classList.toggle("active", a.dataset.nav === id));
      const active = document.querySelector(`#reportNav a[data-nav="${id}"]`);
      if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  ["reportTop", "group-flood", "group-ground", "group-living", "group-planning", "checklist"].forEach(id => {
    const el = $(id);
    if (el) sectionObserver.observe(el);
  });
}

$("openAll").addEventListener("click", () => document.querySelectorAll("#report details.check").forEach(d => { d.open = true; }));
$("closeAll").addEventListener("click", () => document.querySelectorAll("#report details.check").forEach(d => { d.open = false; }));

// Links within the report (section bar, topic icons, "Start here") scroll to their
// section without adding steps to the browser history, and open the topic they point to.
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !a.closest("#report, #reportNav")) return;
  const target = document.getElementById(a.getAttribute("href").slice(1));
  if (!target) return;
  e.preventDefault();
  if (a.dataset.open) { const d = $(a.dataset.open); if (d) d.open = true; }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("scroll", () => {
  $("toTop").classList.toggle("hidden", window.scrollY < 700);
}, { passive: true });
$("toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

/* =========================================================
   SAVED PROPERTIES AND COMPARE
========================================================= */

function buildReportData() {
  const loc = run.loc;
  return {
    title: "Property Location Report",
    generatedAt: new Date().toISOString(),
    location: loc,
    place: okValue(run.R, "place"),
    checks: orderedResults().map(c => ({ id: c.id, group: c.group, title: c.title, result: STATUS_LABEL[c.status], found: c.found, dataDate: c.dataDate })),
    rawData: Object.fromEntries(TASKS.map(([k]) => [k, run.R[k]]))
  };
}

function saveCurrentReport() {
  const loc = run.loc;
  const p = okValue(run.R, "place");
  const entry = {
    key: reportKey(loc), name: loc.name, lat: loc.lat, lon: loc.lon, radius: loc.radius,
    savedAt: new Date().toISOString(),
    postcode: p ? p.postcode : "", district: p ? p.admin_district : "",
    checks: orderedResults().map(c => ({ id: c.id, title: c.title, status: c.status, found: c.found }))
  };
  const all = store.get(SAVED_KEY, []);
  const old = all.find(s => s.key === entry.key);
  if (old) { entry.starred = !!old.starred; if (old.name && old.renamed) { entry.name = old.name; entry.renamed = true; } }
  const saved = [entry, ...all.filter(s => s.key !== entry.key)];
  store.set(SAVED_KEY, trimSaved(saved));
  askToKeepData();
  renderSaved();
}

// Keep every starred property; keep the most recent others up to MAX_SAVED in total.
function trimSaved(list) {
  const starred = list.filter(s => s.starred);
  const others = list.filter(s => !s.starred).slice(0, Math.max(0, MAX_SAVED - starred.length));
  const keep = new Set([...starred, ...others].map(s => s.key));
  list.filter(s => !keep.has(s.key)).forEach(s => store.remove(snapKey(s.key)));
  return list.filter(s => keep.has(s.key));
}

function countChips(checks) {
  const n = s => checks.filter(c => c.status === s).length;
  return ["high", "medium", "low"].filter(s => n(s)).map(s => `<span class="chip ${s}">${n(s)} ${STATUS_LABEL[s].toLowerCase()}</span>`).join("");
}

function renderSaved() {
  const raw = store.get(SAVED_KEY, []);
  const saved = Array.isArray(raw) ? [...raw].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)) : [];
  $("savedPanel").classList.toggle("hidden", !saved.length);
  $("backupNote").classList.toggle("hidden", !backupDue(saved.length));
  $("savedList").innerHTML = saved.map(s => `
    <li>
      <label class="cmp" title="Select to compare"><input type="checkbox" data-compare="${escapeHTML(s.key)}" aria-label="Compare ${escapeHTML(s.name)}"><span aria-hidden="true">Compare</span></label>
      <button class="star-btn" type="button" data-star="${escapeHTML(s.key)}" aria-pressed="${s.starred ? "true" : "false"}"
        title="${s.starred ? "Remove from shortlist" : "Add to shortlist"}" aria-label="Shortlist ${escapeHTML(s.name)}">${s.starred ? "★" : "☆"}</button>
      <div class="saved-main">
        <a href="${escapeHTML(reportUrl(s))}">${escapeHTML(s.name)}</a>${store.get("plc-notes:" + s.key, "") ? ' <span class="note-mark" title="Has notes">📝</span>' : ""}
        <small>${s.postcode ? escapeHTML(s.postcode) + " · " : ""}${s.district ? escapeHTML(s.district) + " · " : ""}checked ${escapeHTML(new Date(s.savedAt).toLocaleDateString("en-GB"))}${isOld(s.savedAt) ? ` <span class="old-mark">· over ${OLD_MONTHS} months ago</span>` : ""}</small>
        <div class="mini-counts">${countChips(s.checks)}</div>
      </div>
      <div class="saved-btns">
        <button class="link-btn" type="button" data-rename="${escapeHTML(s.key)}">Rename</button>
        <button class="link-btn" type="button" data-remove="${escapeHTML(s.key)}">Remove</button>
      </div>
    </li>`).join("");
  updateCompareButton();
}

// Suggest a backup once there are 5 or more saved properties and there has been
// no backup (or "Not now") in the last 30 days.
const BACKUP_MIN = 5, BACKUP_DAYS = 30;
function backupDue(count) {
  if (count < BACKUP_MIN) return false;
  const last = [store.get("plc-backup-at", null), store.get("plc-backup-later", null)]
    .filter(Boolean).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
  return !last.length || Date.now() - Math.max(...last) > BACKUP_DAYS * 86400000;
}
$("backupNow").addEventListener("click", () => $("exportBtn").click());
$("backupLater").addEventListener("click", () => { store.set("plc-backup-later", new Date().toISOString()); renderSaved(); });

function selectedForCompare() {
  return [...document.querySelectorAll("#savedList input[data-compare]:checked")].map(b => b.dataset.compare);
}

function updateCompareButton() {
  const chosen = selectedForCompare();
  $("compareBtn").disabled = chosen.length !== 2;
  document.querySelectorAll("#savedList input[data-compare]").forEach(b => { b.disabled = !b.checked && chosen.length >= 2; });
  $("compareHelp").textContent = chosen.length === 2 ? "Ready to compare." : `Tick two properties to compare them (${chosen.length} of 2 chosen).`;
}

$("savedList").addEventListener("change", updateCompareButton);
function renameSaved(key, newName) {
  const name = newName.trim().slice(0, 80);
  if (!name) return;
  const saved = store.get(SAVED_KEY, []);
  const item = saved.find(s => s.key === key);
  if (!item) return;
  item.name = name;
  item.renamed = true;
  store.set(SAVED_KEY, saved);
  // If this property's report is open, update it too.
  if (run && reportKey(run.loc) === key) {
    run.loc.name = name;
    renderMeta();
    if (reportData) reportData.location.name = name;
    history.replaceState(history.state, "", reportUrl(run.loc));
  }
}

$("savedList").addEventListener("click", e => {
  const ren = e.target.closest("[data-rename]");
  if (ren) {
    const li = ren.closest("li");
    const linkEl = li.querySelector(".saved-main a");
    const input = document.createElement("input");
    input.className = "rename-input";
    input.value = linkEl.textContent;
    input.setAttribute("aria-label", "New name for this property");
    linkEl.replaceWith(input);
    ren.textContent = "Save";
    input.focus();
    input.select();
    let finished = false;
    const finish = save => {
      if (finished) return;
      finished = true;
      if (save) renameSaved(ren.dataset.rename, input.value);
      renderSaved();
    };
    input.addEventListener("keydown", ev => {
      if (ev.key === "Enter") finish(true);
      if (ev.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    return;
  }
  const star = e.target.closest("[data-star]");
  if (star) {
    const saved = store.get(SAVED_KEY, []);
    const item = saved.find(s => s.key === star.dataset.star);
    if (item) { item.starred = !item.starred; store.set(SAVED_KEY, saved); renderSaved(); }
    return;
  }
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  store.set(SAVED_KEY, store.get(SAVED_KEY, []).filter(s => s.key !== btn.dataset.remove));
  store.remove(snapKey(btn.dataset.remove));
  renderSaved();
});

/* ---------- move the saved list to another device (a small file; no account) ---------- */
$("exportBtn").addEventListener("click", () => {
  const saved = store.get(SAVED_KEY, []);
  const pick = prefix => Object.fromEntries(saved.map(s => [s.key, store.get(prefix + s.key, null)]).filter(([, v]) => v != null && v !== ""));
  const data = {
    app: "property-location-check", format: 1, exportedAt: new Date().toISOString(),
    saved, snapshots: pick("plc-snap:"), notes: pick("plc-notes:"), ticks: pick("plc-ticks:")
  };
  downloadFile("property-check-saved-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(data), "application/json");
  store.set("plc-backup-at", new Date().toISOString());
  renderSaved();
  $("transferHelp").textContent = `Exported ${plural(saved.length, "property", "properties")}. Open the file on the other device with “Import list”.`;
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "property-location-check" || !Array.isArray(data.saved)) throw new Error("not a Property Location Check file");
    const mine = store.get(SAVED_KEY, []);
    let added = 0;
    data.saved.forEach(item => {
      if (!item || typeof item.key !== "string" || !Number.isFinite(Number(item.lat))) return;
      const i = mine.findIndex(s => s.key === item.key);
      if (i < 0) { mine.push(item); added++; }
      else if (new Date(item.savedAt) > new Date(mine[i].savedAt)) mine[i] = { ...item, starred: item.starred || mine[i].starred };
      const snap = data.snapshots && data.snapshots[item.key];
      const mySnap = store.get(snapKey(item.key), null);
      if (snap && (!mySnap || new Date(snap.savedAt) > new Date(mySnap.savedAt))) store.set(snapKey(item.key), snap);
      const note = data.notes && data.notes[item.key];
      if (note && !store.get("plc-notes:" + item.key, "")) store.set("plc-notes:" + item.key, String(note));
      const ticks = data.ticks && data.ticks[item.key];
      if (Array.isArray(ticks)) store.set("plc-ticks:" + item.key, [...new Set([...store.get("plc-ticks:" + item.key, []), ...ticks])]);
    });
    store.set(SAVED_KEY, trimSaved(mine.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))));
    renderSaved();
    $("transferHelp").textContent = `Imported: ${plural(added, "new property", "new properties")}; others were updated where the file was newer.`;
  } catch (err) {
    $("transferHelp").textContent = "That file could not be imported: " + err.message + ".";
  }
});

$("compareBtn").addEventListener("click", () => {
  const saved = store.get(SAVED_KEY, []);
  const [a, b] = selectedForCompare().map(k => saved.find(s => s.key === k));
  if (!a || !b) return;
  const cell = (s, id) => {
    const c = s.checks.find(x => x.id === id);
    return c ? `${chip(c.status)}<br><small>${escapeHTML(c.found)}</small>` : "<small>Not checked</small>";
  };
  const head = s => `<a href="${escapeHTML(reportUrl(s))}">${escapeHTML(s.name)}</a><br><small>${escapeHTML(s.postcode || "")} · checked ${escapeHTML(new Date(s.savedAt).toLocaleDateString("en-GB"))}</small>`;
  $("compareBody").innerHTML = `
    <div class="table-wrap"><table class="compare-table">
      <thead><tr><th>Topic</th><th>${head(a)}</th><th>${head(b)}</th></tr></thead>
      <tbody>
        <tr><td>Overall</td><td>${countChips(a.checks)}</td><td>${countChips(b.checks)}</td></tr>
        ${CHECKS.map(c => `<tr><td>${escapeHTML(c.title)}</td><td>${cell(a, c.id)}</td><td>${cell(b, c.id)}</td></tr>`).join("")}
      </tbody>
    </table></div>
    <p class="help">Saved results from the day each property was checked. Open a property to run its checks again with the latest data.</p>`;
  prepareTables($("compareBody"), "Comparison");
  $("comparePanel").classList.remove("hidden");
  $("comparePanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("closeCompare").addEventListener("click", () => $("comparePanel").classList.add("hidden"));

/* =========================================================
   SHARE, EXPORT AND PRINT
========================================================= */

$("shareBtn").addEventListener("click", async () => {
  const url = location.href;
  const title = "Property Location Report" + (run ? " – " + run.loc.name : "");
  if (navigator.share) {
    try { await navigator.share({ title, text: title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    $("shareText").textContent = "Link copied ✓";
  } catch (e) {
    prompt("Copy this link:", url);
  }
  setTimeout(() => { $("shareText").textContent = "Share"; }, 2500);
});

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileBase() {
  return (reportData.location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "property") + "-report";
}

$("downloadHtml").addEventListener("click", () => {
  if (!reportData) return;
  const copy = $("report").cloneNode(true);
  copy.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
  copy.querySelectorAll(".info-body").forEach(d => d.removeAttribute("hidden"));
  copy.querySelectorAll(".info-btn, .info-row, [data-retry], .saved-note button, #whyBox, .send-box").forEach(b => b.remove());
  copy.querySelectorAll("#notesText").forEach(t => t.remove());
  copy.querySelectorAll(".notes-print").forEach(d => { d.removeAttribute("aria-hidden"); d.classList.add("notes-download"); });
  copy.querySelectorAll("input[data-tick]").forEach(b => { if (b.checked) b.setAttribute("checked", ""); });
  const loc = reportData.location;
  const mapBox = copy.querySelector("#reportMap");
  if (mapBox) mapBox.outerHTML = `<p><a href="https://www.openstreetmap.org/?mlat=${loc.lat}&amp;mlon=${loc.lon}#map=16/${loc.lat}/${loc.lon}">View the location on a map</a></p>`;
  // The page styles from css/app.css (read from the loaded sheet, so this works offline too).
  const css = [...document.styleSheets].filter(sheet => (sheet.href || "").endsWith("/css/app.css"))
    .flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Property Location Report – ${escapeHTML(loc.name)}</title>
<style>${css}
body{max-width:960px;margin:24px auto;padding:0 18px}</style>
</head><body>${copy.innerHTML}<p class="help">Live version: <a href="${escapeHTML(location.href)}">${escapeHTML(location.href)}</a></p></body></html>`;
  downloadFile(fileBase() + ".html", html, "text/html");
});

// "i" buttons (and text links marked data-info): show or hide the explanation they point to.
document.addEventListener("click", e => {
  const btn = e.target.closest(".info-btn, [data-info]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const box = document.getElementById(btn.getAttribute("aria-controls"));
  if (!box) return;
  box.hidden = !box.hidden;
  btn.setAttribute("aria-expanded", String(!box.hidden));
});

// Open every section when printing, then restore.
let closedBeforePrint = [];
window.addEventListener("beforeprint", () => {
  closedBeforePrint = [...document.querySelectorAll("#report details:not([open])")];
  closedBeforePrint.forEach(d => { d.open = true; });
  if (reportMap) reportMap.invalidateSize();
});
window.addEventListener("afterprint", () => {
  closedBeforePrint.forEach(d => { d.open = false; });
  document.body.classList.remove("print-summary");
});

// "Save or print" menu: close it after a choice, on a click elsewhere, or with Escape.
const closeSaveMenu = () => { $("saveMenu").open = false; };
document.querySelectorAll(".save-menu-list button").forEach(b => b.addEventListener("click", closeSaveMenu));
document.addEventListener("click", e => { if ($("saveMenu").open && !e.target.closest("#saveMenu")) closeSaveMenu(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("saveMenu").open) { closeSaveMenu(); $("saveMenuBtn").focus(); }
});

$("printReport").addEventListener("click", () => window.print());

// Short printout: cover, summary, notes and checklist only.
$("printSummary").addEventListener("click", () => {
  document.body.classList.add("print-summary");
  window.print();
});

/* =========================================================
   COMFORT: larger text, install as an app
========================================================= */

$("appVersion").textContent = `Version ${APP_VERSION}, updated ${APP_UPDATED}`;

function setLargeText(on) {
  document.documentElement.classList.toggle("large-text", on);
  $("textSizeBtn").setAttribute("aria-pressed", String(on));
  $("textSizeBtn").title = on ? "Normal text size" : "Larger text";
  store.set("plc-large-text", on);
  if (reportMap) setTimeout(() => reportMap.invalidateSize(), 50);
}
$("textSizeBtn").addEventListener("click", () => setLargeText(!document.documentElement.classList.contains("large-text")));
setLargeText(store.get("plc-large-text", false));

let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $("installBtn").classList.add("hidden");
});
window.addEventListener("appinstalled", () => $("installBtn").classList.add("hidden"));

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* the page still works without it */ });
}

/* =========================================================
   START – supports shared links:
   ?lat=..&lon=..&name=..&r=..   or   ?postcode=S70%202TA
========================================================= */

window.addEventListener("load", async () => {
  initMap();
  renderSaved();
  const params = new URLSearchParams(location.search);
  if (openReportFromAddress({ fromLoad: true })) return;
  if (params.has("postcode")) {
    await lookupPostcode(params.get("postcode"));
    if (selected) runChecks({ fromLoad: true });
  } else {
    setControlOpen(searchControl, true);   // first visit: show where to type
  }
});
