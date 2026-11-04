// Temporary diagnostic: measure the Environment Agency map server's burst limit.
// 1. How long does a block last? Trip it, then probe every 3 s until it answers.
// 2. Which pace is safe? Send 24 requests at several paces, waiting for any
//    block to clear between tests, and note the first refused request.

const LAT = 53.5526, LON = -1.4797, d = 0.0005;
const bbox = [LAT - d, LON - d, LAT + d, LON + d].join(",");
const URL1 = "https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms?" + new URLSearchParams({
  service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers: "rofsw", query_layers: "rofsw", styles: "",
  crs: "EPSG:4326", bbox, width: 11, height: 11, i: 5, j: 5, info_format: "application/json", feature_count: 10
});
const HEADERS = { "User-Agent": "Mozilla/5.0 Chrome/131.0.0.0", Origin: "https://andyseremet.github.io", Referer: "https://andyseremet.github.io/" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
const status = async () => { try { return (await fetch(URL1, { headers: HEADERS, signal: AbortSignal.timeout(20000) })).status; } catch (e) { return "ERR"; } };

async function waitClear(label) {
  for (let i = 0; i < 40; i++) {
    const s = await status();
    if (s === 200) { console.log(`${at()} ${label}: clear after ${i * 3} s of probing`); return; }
    await sleep(3000);
  }
  console.log(`${at()} ${label}: still blocked after 120 s`);
}

// 1. Trip it with a burst of 12, then time the block.
console.log(`${at()} burst of 12:`, (await Promise.all(Array.from({ length: 12 }, status))).join(" "));
await waitClear("block length");

// 2. Paces: [concurrent, gap between starts in ms]
for (const [conc, gap] of [[1, 0], [2, 500], [2, 250], [3, 0], [1, 1000]]) {
  await sleep(5000);
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < 24) {
      const i = next++;
      await sleep(gap);
      results[i] = await status();
    }
  };
  const started = Date.now();
  await Promise.all(Array.from({ length: conc }, worker));
  const first403 = results.findIndex(s => s !== 200);
  console.log(`${at()} pace ${conc} at a time, ${gap} ms gap: ${((Date.now() - started) / 1000).toFixed(1)} s for 24; ` +
    (first403 < 0 ? "all 200" : `first refused at request ${first403 + 1}: ${results.join(" ")}`));
  if (first403 >= 0) await waitClear("recovery");
}
