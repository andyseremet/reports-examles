// Property Location Check – offline support.
// The page itself and the map library are kept so the app opens without a
// connection. Live data (flood, radon, noise, maps) always comes from the
// network and is never stored here; only fixed data that never changes (Census 2021
// figures) is kept once it has been used.
const CACHE = "plc-v37";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/core.js",
  "./js/data.js",
  "./js/checks/flood.js",
  "./js/checks/ground.js",
  "./js/checks/living.js",
  "./js/checks/planning.js",
  "./js/checks/index.js",
  "./js/app.js",
  "./glossary.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/rail-stations.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"
];
const FIXED_DATA = ["./data/census2021-msoa-residents.json"];   // kept once used, not downloaded up front

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  // The page: try the network first so updates appear straight away. Only the app's own page is saved as
  // the offline copy; other pages (such as status.html) are not, so they never replace it.
  if (request.mode === "navigate") {
    const path = new URL(request.url).pathname;
    const isApp = path.endsWith("/") || path.endsWith("/index.html");
    event.respondWith(
      fetch(request)
        .then(response => {
          if (isApp && response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put("./index.html", copy)); }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // The app's own code and styles: like the page, try the network first so a new version never mixes
  // new and old files; use the saved copy only when offline.
  const url = new URL(request.url);
  const isAppCode = url.origin === self.location.origin && /\/(css|js)\//.test(url.pathname);
  if (isAppCode) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  // Icons, the manifest and the map library: use the saved copy if there is one.
  const isShell = SHELL.some(path => new URL(path, self.location).href === url.href);
  if (isShell) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
    return;
  }

  // Fixed data saved with the app (Census 2021 figures never change): keep a copy the
  // first time it is used, so later reports read it from this device.
  if (FIXED_DATA.some(path => new URL(path, self.location).href === url.href)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
  // Everything else (live data, map tiles) goes straight to the network.
});
