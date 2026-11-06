// Accessibility re-check, run by hand after visual changes (not in the daily check).
//   npm install --no-save axe-core   (Playwright as for the full test; see CLAUDE.md)
//   python3 -m http.server 8080 &   then   node tests/a11y-check.mjs   (about 10 minutes)
// Scans WCAG 2.2 AA with axe-core on the start page, a full report and status.html, at 1280 px, 320 px and phone,
// light and dark, normal and A+ text. In the report it also scans after using controls (Open problems, the no-issue fold, the gaps box, a Start here link,
// a tick, Move to another device, Compare three, Remove), and checks for sideways scrolling before and after each.
// Environment Agency map requests are answered empty so the report finishes fast. Exit code 1 on any problem.
import { chromium, devices } from "playwright";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8080/";
const AXE = readFileSync(createRequire(process.cwd() + "/").resolve("axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SIZES = [["1280 px", { viewport: { width: 1280, height: 900 } }], ["320 px", { viewport: { width: 320, height: 700 } }],
  ["phone", devices["iPhone 13"]]];

// Controls used one after another on the report; each is followed by a scan and a sideways-scroll check.
const ACTIONS = [
  ["Close all, then Open problems", async p => { await p.click("#toggleAll"); await p.click("#toggleAll"); }],
  ["no-issue fold opened", async p => { const f = p.locator(".clear-fold:not([hidden]) > summary").first(); if (await f.count()) await f.click(); }],
  ["gaps box toggled", async p => { if (await p.locator("#gapsBox > summary").count()) await p.click("#gapsBox > summary"); }],
  ["sources open", p => p.evaluate(() => { const d = document.getElementById("sources"); if (d) d.open = true; })],
  ["Start here link", async p => { const a = p.locator(".priority a[data-open]").first(); if (await a.count()) await a.click(); }],
  ["tick", async p => { const b = p.locator("#viewing input[data-tick]").first(); if (await b.count()) await b.check(); }],
  ["Move to another device", p => p.click("#moveDevice summary")],
  ["Compare three", async p => {
    await p.evaluate(() => { const l = store.get(SAVED_KEY, []), s = l[0]; if (!s) return;
      store.set(SAVED_KEY, [...l, ...[1, 2].map(n => ({ ...s, key: "a11y-" + n, name: "Copy " + n,
        checks: s.checks.map((c, i) => i === n - 1 ? { ...c, status: "high" } : c) }))]); renderSaved(); });
    for (const b of await p.locator("#savedList input[data-compare]").all()) if (await b.isEnabled()) await b.check();
    if (await p.isEnabled("#compareBtn")) { await p.click("#compareBtn"); await p.check("#diffOnly"); }
  }],
  ["Remove (Undo bar)", async p => { const b = p.locator("#savedList [data-remove]").first(); if (await b.count()) await b.click(); }],
];

let problems = 0;
const report = (where, msg) => { problems++; console.log(`FAIL  ${where}: ${msg}`); };

async function check(page, where) {
  // Scan from the top of the page: controls that happen to sit under the sticky bars would otherwise
  // count as too small (target-size), and the result would depend on where the last action scrolled to.
  await page.waitForTimeout(900);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))) report(where, "sideways scrolling");
  await page.addScriptTag({ content: AXE });
  const found = await page.evaluate(async tags => (await axe.run(document, { runOnly: tags })).violations
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 90)}`), TAGS);
  found.forEach(f => report(where, f));
}

const browser = await chromium.launch();
for (const [size, opts] of SIZES) for (const scheme of ["light", "dark"]) for (const big of [false, true]) {
  const label = `${size}, ${scheme}${big ? ", A+" : ""}`;
  const context = await browser.newContext({ ...opts, colorScheme: scheme });
  const page = await context.newPage();
  await page.route("https://environment.data.gov.uk/spatialdata/**", r => r.fulfill({ json: { features: [] } }));
  await page.addInitScript(on => { if (on) localStorage.setItem("plc-large-text", "true"); }, big);
  await page.goto(BASE);
  await check(page, `${label} – start page`);
  await page.goto(BASE + "?postcode=SW1A%201AA");
  await page.waitForSelector("#checklistBox input", { timeout: 60000 });
  await check(page, `${label} – report`);
  for (const [name, act] of ACTIONS) { await act(page); await check(page, `${label} – after ${name}`); }
  await page.goto(BASE + "status.html");
  await check(page, `${label} – status page`);
  await context.close();
}
await browser.close();
console.log(problems ? `\n${problems} problem(s) found.` : "\nNo problems found.");
process.exit(problems ? 1 : 0);
