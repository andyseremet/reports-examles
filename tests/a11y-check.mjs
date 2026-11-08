// Accessibility re-check, run by hand after visual changes (not in the daily check).
//   npm install --no-save axe-core   (Playwright as for the full test; see CLAUDE.md)
//   python3 -m http.server 8080 &   then   node tests/a11y-check.mjs   (about 3 minutes)
// Scans WCAG 2.2 AA with axe-core on the start page, a full report, status.html and glossary.html, in 4 combinations that
// cover every width (1280 px, 320 px, phone), both colour schemes and both text sizes, plus the riskiest pairs. In the report it also scans after using controls (Open problems, the no-issue fold, the gaps box, a Key findings link,
// a tick, Move to another device, Compare three, Remove), and checks for sideways scrolling before and after each.
// Environment Agency map requests are answered empty so the report finishes fast. Exit code 1 on any problem.
import { chromium, devices } from "playwright";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8080/";
const AXE = readFileSync(createRequire(process.cwd() + "/").resolve("axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDE = { viewport: { width: 1280, height: 900 } }, NARROW = { viewport: { width: 320, height: 700 } };
// [width, browser options, colour scheme, larger text]. 320 px with larger text is the tightest layout.
const COMBOS = [["1280 px", WIDE, "light", false], ["1280 px", WIDE, "dark", false],
  ["320 px", NARROW, "light", true], ["phone", devices["iPhone 13"], "dark", true]];

// Controls used one after another on the report; each is followed by a scan and a sideways-scroll check.
const ACTIONS = [
  // With no problem topics (for example while a data service is down), "Open problems" is greyed out: skip that press.
  ["Close all, then Open problems", async p => { for (let i = 0; i < 2; i++) if (await p.isEnabled("#toggleAll")) await p.click("#toggleAll"); }],
  ["no-issue fold opened", async p => { const f = p.locator(".clear-fold:not([hidden]) > summary").first(); if (await f.count()) await f.click(); }],
  ["gaps box toggled", async p => { if (await p.locator("#gapsBox > summary").count()) await p.click("#gapsBox > summary"); }],
  ["sources open", p => p.evaluate(() => { const d = document.getElementById("sources"); if (d) d.open = true; })],
  ["Key findings link", async p => { const a = p.locator(".key-findings a[data-open]").first(); if (await a.count()) await a.click(); }],
  ["More in a topic", async p => { const b = p.locator("details.check[open] .more-btn").first(); if (await b.count()) await b.click(); }],
  ["Next steps opened", async p => { for (const s of await p.locator(".step-fold > summary").all()) await s.click(); }],
  ["tick", async p => { const b = p.locator("#viewing input[data-tick]").first(); if (await b.count()) await b.check(); }],
  ["tab bar: Next steps, then Problems", async p => { if (await p.isVisible("#tabBar")) {
    await p.click('#tabBar a[data-tab="nextSteps"]'); if (await p.isEnabled("#tabProblems")) await p.click("#tabProblems"); } }],
  ["Change (search map shown)", p => p.click("#changePlace")],
  ["Saved (saved list shown)", p => p.click("#showSaved")],
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
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === "running"), null, { timeout: 3000 }).catch(() => {});
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))) report(where, "sideways scrolling");
  await page.addScriptTag({ content: AXE });
  const found = await page.evaluate(async tags => (await axe.run(document, { runOnly: tags })).violations
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].html.slice(0, 90)}`), TAGS);
  found.forEach(f => report(where, f));
}

const browser = await chromium.launch();
for (const [size, opts, scheme, big] of COMBOS) {
  const label = `${size}, ${scheme}${big ? ", A+" : ""}`;
  const context = await browser.newContext({ ...opts, colorScheme: scheme });
  const page = await context.newPage();
  await page.route("https://environment.data.gov.uk/spatialdata/**", r => r.fulfill({ json: { features: [] } }));
  await page.addInitScript(on => { if (on) localStorage.setItem("plc-large-text", "true"); }, big);
  await page.goto(BASE);
  await check(page, `${label} – start page`);
  await page.goto(BASE + "?postcode=SW1A%201AA");
  await page.waitForSelector("#checklistBox input", { state: "attached", timeout: 60000 });   // the checklist is built (it starts folded)
  await check(page, `${label} – report`);
  for (const [name, act] of ACTIONS) { await act(page); await check(page, `${label} – after ${name}`); }
  await page.goto(BASE + "status.html");
  await check(page, `${label} – status page`);
  await page.goto(BASE + "glossary.html");
  await check(page, `${label} – glossary page`);
  await context.close();
}
await browser.close();
console.log(problems ? `\n${problems} problem(s) found.` : "\nNo problems found.");
process.exit(problems ? 1 : 0);
