// Temporary diagnostic: why do Environment Agency map-server requests fail
// from the live page? Sends the page's exact requests directly and records the
// real HTTP status and CORS header, with different page addresses (Origin and
// Referer) and in bursts like the page makes.

const LAT = 53.5526, LON = -1.4797, d = 0.0005;
const bbox = [LAT - d, LON - d, LAT + d, LON + d].join(",");
const wms = (svc, layers) => `https://environment.data.gov.uk/spatialdata/${svc}/wms?` + new URLSearchParams({
  service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers, query_layers: layers, styles: "",
  crs: "EPSG:4326", bbox, width: 11, height: 11, i: 5, j: 5, info_format: "application/json", feature_count: 10
});
const bands = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
const PAGE_REQUESTS = [
  wms("nafra2-risk-of-flooding-from-surface-water", "rofsw"),
  wms("road-noise-all-metrics-england-round-4", ["Lday", "Leve", "Lnight", "Lden"].map(m => `Road_Noise_${m}_England_Round_4_All`).join(",")),
  ...["Lday", "Leve", "Lnight", "Lden"].map(m => wms("rail-noise-england-round-4-all", bands.map(b => `Rail_Noise_${m}_England_Round_4_All_${b}Hz`).join(",")))
];
const CHROME_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function one(url, origin) {
  const headers = { "User-Agent": CHROME_UA, Accept: "application/json" };
  if (origin) { headers.Origin = origin; headers.Referer = origin + "/"; }
  const started = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    return `${res.status} cors=${res.headers.get("access-control-allow-origin") || "none"} ${Date.now() - started}ms` +
      (res.ok ? "" : ` body="${body.replace(/\s+/g, " ").slice(0, 120)}" server=${res.headers.get("server") || ""}`);
  } catch (e) {
    return `ERROR ${e.message}`;
  }
}

for (const origin of ["https://andyseremet.github.io", "http://localhost:8080", null]) {
  for (let round = 1; round <= 3; round++) {
    const results = await Promise.all(PAGE_REQUESTS.map(u => one(u, origin)));
    console.log(`origin=${origin || "(none)"} burst ${round}: ` + results.map((r, i) => `[${i}] ${r}`).join(" | "));
  }
  await new Promise(r => setTimeout(r, 2000));
}
