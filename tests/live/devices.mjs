// 2. The page in a browser on desktop, phone and tablet: one report each and the main features.
import { devices } from "playwright";
import { readFileSync } from "node:fs";
import { BASE, OUT, UA, EA_MAP_SERVER, EA_TOPICS, EA_REFUSAL_NOTE } from "./settings.mjs";
import { results, record, timedStep } from "./results.mjs";
import { steadyContext } from "./recording.mjs";
import { box, wms, SERVICES, SERVICE_TOPICS } from "./services.mjs";

export const DEVICES = [
  { name: "Desktop", options: { viewport: { width: 1366, height: 900 } } },
  { name: "Phone (iPhone 13)", options: { ...devices["iPhone 13"] } },
  { name: "Tablet (iPad Pro 11, landscape)", options: { ...devices["iPad Pro 11 landscape"] } }
];
export const FIXED = [["S70 2TA", "Barnsley"], ["CF11 7HW", "Cardiff"], ["YO1 7HH", "York"]];

export async function randomEnglishPostcode() {
  for (let i = 0; i < 8; i++) {
    try {
      const r = (await (await fetch("https://api.postcodes.io/random/postcodes", { headers: { "User-Agent": UA } })).json()).result;
      if (r && r.country === "England") return [r.postcode, r.admin_district];
    } catch (e) { /* try again */ }
  }
  return ["CM8 1AY", "Braintree"];
}

export const reportDone = page => page.waitForFunction(() => typeof run !== "undefined" && run && run.done, null, { timeout: 240000 });

// Screenshots for people reading a run's results: JPEG at the page's own size (lighter than full-resolution PNG).
export const SHOT = { type: "jpeg", quality: 70, scale: "css" };
// Map pictures (background tiles): the desktop loads the real ones, and checks them; the phone and tablet get a
// blank picture at once, so their map steps still see every tile load without waiting for the map providers.
export const TILE = /^https:\/\/([a-z]\.)?(tile\.openstreetmap\.org|basemaps\.cartocdn\.com)\/|^https:\/\/server\.arcgisonline\.com\/.*\/tile\//;
export const BLANK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");

export async function testDevice(browser, device, [postcode, place]) {
  const group = `${device.name} – ${postcode}, ${place}`;
  const context = await browser.newContext({ ...device.options, acceptDownloads: true });
  await steadyContext(context);
  if (device.name !== "Desktop") await context.route(TILE, r => r.fulfill({ contentType: "image/png", body: BLANK_PNG }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  // Record data requests that fail, with the reply, to explain any topic that could not load.
  const failedRequests = [];
  const shortUrl = u => { const x = new URL(u); return x.host + x.pathname.replace(/\/(wms|query|items)$/, "/$1"); };
  page.on("response", res => {
    if (res.status() >= 400 && !/tile|png|jpg/.test(res.url()))
      failedRequests.push(`${shortUrl(res.url())} → HTTP ${res.status()}${res.headers()["retry-after"] ? " (retry-after " + res.headers()["retry-after"] + ")" : ""}`);
  });
  page.on("requestfailed", req => {
    if (!/tile|png|jpg/.test(req.url())) failedRequests.push(`${shortUrl(req.url())} → ${req.failure() ? req.failure().errorText : "failed"}`);
  });
  const step = timedStep(group);
  // Steps that do not depend on the screen size run once, on the desktop; layout steps run on every device.
  const desktopStep = device.name === "Desktop" ? step : async () => {};
  // Wait until the condition holds, at most a few seconds. Answers whether it did.
  const until = (fn, arg, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  // Wait until a smooth scroll has finished: the page stays still for 15 frames (a scroll that starts a little
  // late is still caught), at most 3 seconds. Never throws, so a page that is navigating cannot stop the run.
  const scrolled = () => page.evaluate(() => new Promise(done => {
    let y = scrollY, still = 0;
    const end = Date.now() + 3000;
    const frame = () => { still = scrollY === y ? still + 1 : 0; y = scrollY; still >= 15 || Date.now() > end ? done() : requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  })).catch(() => {});
  const file = name => `${OUT}/${device.name.replace(/\W+/g, "-")}-${name}.jpg`;

  let guideAtStart = false;
  await step("Page opens with the search ready", async () => {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForSelector("#map.leaflet-container");
    guideAtStart = await page.$eval("#guide", g => !g.classList.contains("hidden") && g.querySelectorAll("li").length === 3);
    // The search box shows above the map, outside it (1.36.0), and the map's own search button stays hidden.
    const r = await page.evaluate(() => {
      const box = document.getElementById("searchBox"), m = document.getElementById("map");
      const b = box.getBoundingClientRect(), mb = m.getBoundingClientRect();
      return { visible: b.height > 0 && getComputedStyle(box).visibility !== "hidden", above: b.bottom <= mb.top + 1,
        outside: !m.contains(box), mapBtn: getComputedStyle(document.querySelector(".search-ctl")).display };
    });
    return r.visible && r.above && r.outside && r.mapBtn === "none" ? "search box above the map" : false;
  });

  await step("Search finds the postcode", async () => {
    await page.fill("#q", postcode);
    await page.waitForSelector("#suggestions:not(.hidden) li", { timeout: 15000 });
    await page.click("#suggestions li");
    await page.waitForSelector("#confirm:not(.hidden)");
    const text = await page.$eval("#confirmText", x => x.textContent);
    return text.includes(postcode) ? text : false;
  });

  await step("Full-screen map covers the screen and closes", async () => {
    await page.$eval("#map", x => x.scrollIntoView({ block: "center" }));
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await until(() => mapIsFull);
    const r = await page.evaluate(() => { const b = document.getElementById("map").getBoundingClientRect(); return [b.left, b.top, b.width, b.height, innerWidth, innerHeight].map(Math.round); });
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("pressing the full-screen button moved the pin");
    const searchInMap = await page.evaluate(() => document.getElementById("map").contains(document.getElementById("searchBox"))
      && getComputedStyle(document.querySelector(".search-ctl")).display !== "none");
    if (!searchInMap) throw new Error("the full-screen map has no search button");
    await page.screenshot({ path: file("fullscreen"), ...SHOT });
    await page.click(".leaflet-top.leaflet-right .map-ctrl:nth-child(2) .map-btn");
    await until(() => !mapIsFull);
    const closed = !(await page.evaluate(() => mapIsFull)) && await page.evaluate(() => !document.getElementById("map").contains(document.getElementById("searchBox")));
    if (!(await page.$eval("#confirmText", x => x.textContent)).includes(postcode)) throw new Error("closing full screen moved the pin");
    return r[0] === 0 && r[1] === 0 && Math.abs(r[2] - r[4]) <= 1 && Math.abs(r[3] - r[5]) <= 1 && closed ? `map ${r[2]}×${r[3]}` : false;
  });

  await desktopStep("Offline: says so and waits to run the check", async () => {
    await page.context().setOffline(true);
    try {
      await page.click("#runBtn");
      await page.waitForSelector("#offlineBar:not(.hidden)", { timeout: 5000 });
      const text = await page.$eval("#offlineBar", x => x.textContent.replace(/\s+/g, " ").trim());
      const started = await page.evaluate(() => !!run);
      await page.click("#cancelQueued");
      if (started) throw new Error("a report started with no signal");
      if (!/will start by itself/.test(text)) throw new Error(`unexpected message: ${text}`);
    } finally { await page.context().setOffline(false); }
    const gone = await until(() => document.getElementById("offlineBar").classList.contains("hidden"));
    const started = await page.evaluate(() => !!run);
    if (started) throw new Error("the cancelled check still started");
    return gone ? "message shown, check waited and was cancelled" : false;
  });

  let topics = [];
  await step("Report runs with every topic", async () => {
    const started = Date.now();
    await page.click("#runBtn");
    await reportDone(page);
    const readTopics = () => page.evaluate(() => orderedResults().map(c => ({ id: c.id, status: c.status, found: c.found })));
    topics = await readTopics();
    const total = await page.evaluate(() => shownChecks().length);
    let failed = topics.filter(t => t.status === "error");
    // A government service that is slow for a moment shows "Try again" on that topic.
    // Press it once, as a person would (this also tests the button). A topic that
    // fails a second time still fails the test.
    const retried = failed.map(t => t.id);
    for (const id of retried) {
      await page.waitForTimeout(20000);
      // Retrying one topic reloads the data it shares with others, so another topic's button may already be gone
      // (reloaded or answered). Either way the topic is read again below and must not have failed.
      const btn = page.locator(`#check-${id} [data-retry="${id}"]`);
      if (!(await btn.count())) { await reportDone(page); continue; }
      // Topic cards start closed: open the card first, as a person would, to reach its Try again button.
      if (!(await page.$eval(`#check-${id}`, d => d.open))) await page.click(`#check-${id} > summary`);
      await btn.click();
      await page.waitForTimeout(500);
      await reportDone(page);
    }
    if (retried.length) { topics = await readTopics(); failed = topics.filter(t => t.status === "error"); }
    const secs = Math.round((Date.now() - started) / 1000);
    if (topics.length !== total || failed.length) {
      const why = [...new Set(failedRequests)].slice(0, 6).join("; ");
      const refusedByEA = topics.length === total && failed.every(t => EA_TOPICS.includes(t.id)) &&
        failedRequests.some(r => r.includes(EA_MAP_SERVER) && r.includes("HTTP 403"));
      if (refusedByEA) return { warn: `${failed.map(t => t.id).join(", ")} could not load: ${EA_REFUSAL_NOTE}. Other ${total - failed.length} topics ok` };
      throw new Error(`${failed.length} topic(s) failed` + (retried.length ? " even after Try again" : "") + ": " +
        failed.map(t => `${t.id} (${t.found})`).join("; ") + (why ? ` | failed requests: ${why}` : ""));
    }
    const auto = await page.evaluate(() => run.autoRetried || []);
    return `${total} topics in ${secs} s` + (auto.length ? ` (retried by itself: ${auto.join(", ")})` : "")
      + (retried.length ? ` (needed Try again: ${retried.join(", ")})` : "");
  });
  await desktopStep("3-step guide on the first visit, hidden after the first report", async () => {
    const hiddenNow = await page.$eval("#guide", g => g.classList.contains("hidden"));
    return guideAtStart && hiddenNow ? "shown, then hidden" : false;
  });
  await page.$eval("#reportTop", x => x.scrollIntoView()).catch(() => {});
  await scrolled();
  await until(() => document.querySelector("#reportMap .leaflet-tile-loaded"));
  await page.screenshot({ path: file("report"), ...SHOT });

  await step("Topic icons and section bar", async () => {
    const icons = await page.$$eval(".topic-strip li", l => l.length);
    await page.click('#reportNav a[data-nav="group-living"]');
    await scrolled();
    const active = await page.$eval("#reportNav a.active", x => x.textContent).catch(() => null);
    return icons >= 13 && active === "Living" ? `${icons} icons, section bar ok` : false;
  });

  await step("Finding your way: topic grid, folded no-issue topics, Open problems and Details", async () => {
    const r0 = await page.evaluate(() => {
      const results = orderedResults();
      const grid = document.querySelectorAll(".topic-strip [data-why]").length;
      const low = results.filter(c => c.status === "low").map(c => c.id).sort();
      const folded = [...document.querySelectorAll(".clear-fold .fold-body .slot")].map(el => el.id.slice(5)).sort();
      const symbols = [...document.querySelectorAll("#report .chip:is(.high,.medium,.low,.info,.manual,.error)")].filter(c => !c.querySelector(".chip-symbol")).length;
      return { total: results.length, grid, openAtStart: document.querySelectorAll("#report details.check[open]").length,
        button: document.getElementById("toggleAll").textContent, low, folded, symbols, countBoxes: document.querySelectorAll("a.count").length };
    });
    // The topic grid shows every topic once; the count boxes are gone; every chip has its symbol.
    if (r0.grid !== r0.total) throw new Error(`the topic grid shows ${r0.grid} topics, expected ${r0.total}`);
    // Every topic card starts closed, problems too (owner, 8 November 2026).
    if (r0.openAtStart || r0.button !== "Open problems") throw new Error(`${r0.openAtStart} topic card(s) open at the start; the button says "${r0.button}"`);
    if (r0.countBoxes) throw new Error("the old count boxes are still shown");
    if (r0.symbols) throw new Error(`${r0.symbols} rating chip(s) without a symbol`);
    // Every "No issue found" topic, and only those, sits in its section's folded row.
    if (r0.low.join() !== r0.folded.join()) throw new Error(`folded [${r0.folded}] but no-issue topics are [${r0.low}]`);
    // A link to a topic (here from the "why" box under the grid) opens it, opens its fold if it is folded,
    // focuses it and leaves it below the section bar.
    const first = page.locator(".topic-strip .topic").first();
    await first.click();
    const link = page.locator("#whyBox a[data-open]");
    const id = await link.getAttribute("data-open");
    await page.evaluate(i => { const d = document.getElementById(i); d.open = false; const f = d.closest(".clear-fold"); if (f) f.open = false; }, id);
    await link.click();
    await scrolled();
    const r = await page.evaluate(i => {
      const d = document.getElementById(i), bar = document.getElementById("reportNav").getBoundingClientRect().bottom;
      const f = d.closest(".clear-fold");
      return { open: d.open, foldOpen: !f || f.open, below: d.getBoundingClientRect().top >= bar - 1, focus: d.contains(document.activeElement),
        label: getComputedStyle(d.querySelector(".more-text"), "::before").content };
    }, id);
    if (!r.open || !r.focus || !r.foldOpen) throw new Error(`the link did not open and focus ${id}`);
    if (!r.below) throw new Error(`${id} is hidden under the section bar`);
    if (r.label !== '"Hide"') throw new Error(`an open topic says ${r.label}, not "Hide"`);
    // "Close all" closes every topic and fold; "Open problems" then opens only Look into this and Worth checking.
    const state = () => page.evaluate(() => {
      const open = [...document.querySelectorAll("#report details.check, #report details.clear-fold")].filter(d => d.open);
      return { text: document.getElementById("toggleAll").textContent, disabled: document.getElementById("toggleAll").disabled,
        open: open.map(d => d.id || "fold").sort().join(),
        problems: [...document.querySelectorAll("#report details.check.high, #report details.check.medium")].map(d => d.id).sort().join() };
    });
    if ((await state()).text !== "Close all") throw new Error("with a topic open, the button does not say Close all");
    await page.click("#toggleAll");
    const s1 = await state();
    if (s1.open || s1.text !== "Open problems") throw new Error(`after Close all: "${s1.text}", still open: ${s1.open}`);
    if (s1.problems) {
      await page.click("#toggleAll");
      const s2 = await state();
      if (s2.open !== s1.problems || s2.text !== "Close all") throw new Error(`Open problems opened [${s2.open}], expected [${s1.problems}]`);
    } else if (!s1.disabled) throw new Error("Open problems is not disabled when there are no problems");
    // The button stays on screen, even on a phone.
    const onScreen = await page.$eval("#toggleAll", b => { const x = b.getBoundingClientRect(); return x.left >= 0 && x.right <= innerWidth; });
    if (!onScreen) throw new Error("the Open problems button is off the screen");
    return `${r0.folded.length} no-issue topics folded; ${id.replace("check-", "")} opened; ${s1.problems ? s1.problems.split(",").length : 0} problems opened`;
  });

  await step("Shorter report: map always shown at 4:3, More in each topic, long lists show 3 first", async () => {
    // The map inside the report is always shown and drawn (owner, 7 November 2026: a hidden map could print blank),
    // 4:3 and centred, with its map pictures loaded.
    const m = await page.evaluate(() => { const el = document.getElementById("reportMap"), r = el.getBoundingClientRect();
      return { hidden: el.hidden || r.height === 0, drawn: el.classList.contains("leaflet-container"), ratio: r.width / r.height,
        tiles: el.querySelectorAll(".leaflet-tile-loaded").length, button: !!document.getElementById("showReportMap") }; });
    if (m.hidden || !m.drawn || m.button) throw new Error(`report map: hidden ${m.hidden}, drawn ${m.drawn}, Show map button ${m.button}`);
    if (Math.abs(m.ratio - 4 / 3) > 0.03) throw new Error(`report map is ${m.ratio.toFixed(2)}:1, expected 4:3`);
    if (!m.tiles) throw new Error("no map pictures loaded in the report map");
    // Inside a topic, "What we found" and "What this means" stay folded until "More" (sources and dates are in the table at the end).
    const more = page.locator("details.check[open] .more-btn").first();
    if (await more.count()) {
      const box = await more.getAttribute("aria-controls");
      const hiddenBefore = await page.$eval("#" + box, x => x.hidden);
      await more.click();
      const shown = await page.$eval("#" + box, x => !x.hidden && /What we found|What this means/.test(x.textContent));
      await more.click();
      if (!hiddenBefore || !shown) throw new Error(`"More" in ${box} did not fold and unfold what was found and what it means`);
    }
    // A list of more than 4 sites or sales shows the first 3, and "Show all N" shows the rest.
    const lists = await page.evaluate(() => [...document.querySelectorAll("#report .site-list")].map(l => {
      const rows = [...l.querySelectorAll(":scope > li, tbody > tr")];
      return { id: l.id, total: rows.length, shown: rows.filter(r => !r.hidden).length };
    }));
    const wrong = lists.filter(l => l.shown !== (l.total > 4 ? 3 : l.total));
    if (wrong.length) throw new Error(wrong.map(l => `a list shows ${l.shown} of ${l.total}`).join("; "));
    const long = lists.find(l => l.total > 4);
    if (long) {
      const all = await page.evaluate(id => {
        const btn = document.querySelector(`.show-all[aria-controls="${id}"]`);
        const d = btn.closest("details"); if (d) d.open = true;
        const f = btn.closest(".clear-fold"); if (f) f.open = true;
        const label = btn.textContent;
        btn.click();
        const shown = [...document.getElementById(id).querySelectorAll(":scope > li, tbody > tr")].filter(r => !r.hidden).length;
        btn.click();
        return { label, shown };
      }, long.id);
      if (all.label !== `Show all ${long.total}` || all.shown !== long.total) throw new Error(`"${all.label}" showed ${all.shown} of ${long.total}`);
    }
    return `map ok; ${lists.length} list(s), ${lists.filter(l => l.total > 4).length} shortened`;
  });

  await step("Phone tab bar: Summary, Problems, All topics, Next steps", async () => {
    const phone = await page.evaluate(() => innerWidth <= 600);
    const shown = await page.$eval("#tabBar", x => getComputedStyle(x).display !== "none");
    if (!phone) { if (shown) throw new Error("the phone tab bar shows on a wider screen"); return "not shown (wider screen)"; }
    if (!shown) throw new Error("the tab bar is not shown on a phone");
    const labels = await page.$$eval("#tabBar a, #tabBar button", x => x.map(b => b.textContent.replace(/\s+/g, " ").trim()));
    if (labels.length !== 4 || !/Problems \(\d+\)/.test(labels[1])) throw new Error(`the tab bar says: ${labels.join(" | ")}`);
    // A jump lands below the top bars and above the tab bar; Back to top sits above the tab bar.
    const landed = async () => page.evaluate(() => {
      const bar = document.getElementById("tabBar").getBoundingClientRect().top, top = document.getElementById("reportNav").getBoundingClientRect().bottom;
      const t = document.getElementById("nextSteps").getBoundingClientRect(), up = document.getElementById("toTop").getBoundingClientRect();
      return { below: t.top >= top - 1, above: t.top < bar, toTop: up.height === 0 || up.bottom <= bar + 1 };
    });
    await page.click('#tabBar a[data-tab="nextSteps"]');
    await scrolled();
    const r = await landed();
    if (!r.below || !r.above) throw new Error("Next steps did not land between the top bars and the tab bar");
    if (!r.toTop) throw new Error("the Back to top button covers the tab bar");
    // "Problems" opens the topics to look into and goes to the first; with none, it is greyed out.
    const n = await page.evaluate(() => problemTopics().length);
    if (!n) { if (!(await page.isDisabled("#tabProblems"))) throw new Error("Problems is not greyed out with no problems"); return "no problems here"; }
    await page.click("#tabProblems");
    await scrolled();
    const p = await page.evaluate(() => { const d = document.activeElement.closest("details.check");
      return { id: d && d.id, open: d && d.open, problem: d && (d.classList.contains("high") || d.classList.contains("medium")),
        visible: d && d.getBoundingClientRect().top >= document.getElementById("reportNav").getBoundingClientRect().bottom - 1 }; });
    if (!p.problem || !p.open || !p.visible) throw new Error(`Problems went to ${p.id || "nothing"} (open ${p.open}, in view ${p.visible})`);
    return `${labels.join(" · ")}; Problems went to ${p.id.replace("check-", "")}`;
  });

  await desktopStep("Tapping a topic shows why", async () => {
    await page.click('.topic-strip [data-why="radon"]');
    const text = await page.$eval("#whyBox", x => x.hidden ? "" : x.textContent.replace(/\s+/g, " ").trim());
    const expanded = await page.$eval('.topic-strip [data-why="radon"]', x => x.getAttribute("aria-expanded"));
    await page.click('.topic-strip [data-why="radon"]');   // tap again to close
    const closed = await page.$eval("#whyBox", x => x.hidden);
    return text.startsWith("Radon") && text.length > 25 && expanded === "true" && closed ? text.slice(0, 70) + "…" : false;
  });

  await step("Each topic says how current its data is (in the sources table at the end)", async () => {
    const r = await page.evaluate(() => {
      const rows = new Map([...document.querySelectorAll("#sources tbody tr")].map(tr => [tr.cells[0].textContent.trim(), tr.cells[2].textContent.trim()]));
      const missing = orderedResults().filter(c => !["manual", "error"].includes(c.status))
        .filter(c => !c.dataDate || c.dataDate.length < 12 || rows.get(c.title) !== c.dataDate).map(c => c.id);
      const inCards = document.querySelectorAll("details.check .data-date, details.check .source").length;
      return { missing, inCards, crime: rows.get((orderedResults().find(c => c.id === "crime") || {}).title) };
    });
    if (r.missing.length) throw new Error("no data date in the sources table for: " + r.missing.join(", "));
    if (r.inCards) throw new Error(`${r.inCards} date or source line(s) still inside topics`);
    return r.crime || "ok";
  });

  await desktopStep("Crime where the police publish no data", async () => {
    // Central Manchester: Greater Manchester Police has published no data since March 2025. Whatever the
    // police data says on the day, the report must not show a near-empty count as a real, low crime level.
    const r = await page.evaluate(async () => {
      const loc = { name: "Manchester test", lat: 53.4835, lon: -2.2312, radius: 1000 };
      const [crime, area] = await Promise.all([getCrime(loc), getCrimeArea(loc)]);
      const c = checkCrime({ loc, crime: { ok: true, value: crime }, crimeArea: { ok: true, value: area } });
      return { status: c.status, found: c.found, total: crime.total };
    });
    if (r.total <= 5 && r.status !== "manual") throw new Error(`only ${r.total} crimes, but rated "${r.status}": ${r.found}`);
    return `${r.total} crimes within a mile → ${r.status === "manual" ? "Check yourself" : "shown"}: ${r.found.slice(0, 70)}…`;
  });

  await desktopStep("Coastal erosion on an eroding coast", async () => {
    // Happisburgh, Norfolk: the village edge is inside the area the coast is expected to reach by 2105.
    const r = await page.evaluate(async () => {
      const loc = { name: "Happisburgh test", lat: 52.8245, lon: 1.5325, radius: 1000 };
      try {
        const c = checkCoastal({ loc, coastal: { ok: true, value: await getCoastalErosion(loc) } });
        return { status: c.status, found: c.found };
      } catch (e) { return { error: e.message }; }
    });
    if (r.error && /\b403\b/.test(r.error)) return { warn: `HTTP 403: ${EA_REFUSAL_NOTE}` };
    if (r.error) throw new Error(r.error);
    if (!["high", "medium"].includes(r.status)) throw new Error(`rated "${r.status}": ${r.found}`);
    return r.found.slice(0, 90) + "…";
  });

  await desktopStep("Data service status page", async () => {
    // Open status.html with a sample of today's results (the published file may not exist yet on a pull
    // request), and check it lists every service with a status, its topics and the 7-day dots.
    const sample = {
      checked: new Date().toISOString(),
      services: SERVICES.map(([name], i) => ({ name, status: i === 2 ? "fail" : "ok", detail: i === 2 ? "HTTP 503" : "120 ms", topics: SERVICE_TOPICS[name] || [] })),
      history: [{ date: new Date().toISOString().slice(0, 10), services: {} }]
    };
    const statusPage = await page.context().newPage();
    const errors = [];
    statusPage.on("pageerror", e => errors.push(e.message));
    await statusPage.route("https://raw.githubusercontent.com/**", r => r.fulfill({ json: sample }));
    await statusPage.goto(new URL("status.html", BASE).href);
    await statusPage.waitForSelector(".status-table tbody tr", { timeout: 15000 });
    const r = await statusPage.evaluate(() => ({
      rows: document.querySelectorAll(".status-table tbody tr").length,
      down: document.querySelectorAll(".status-table .chip.high").length,
      verdict: document.querySelector(".verdict")?.textContent || "",
      back: !!document.querySelector('a[href="./"]')
    }));
    await statusPage.close();
    if (errors.length) throw new Error("page errors: " + errors.join("; "));
    if (r.rows !== SERVICES.length) throw new Error(`${r.rows} rows for ${SERVICES.length} services`);
    if (r.down !== 1 || !/1 of \d+ services/.test(r.verdict)) throw new Error("the service that did not answer is not shown as such: " + r.verdict);
    if (!r.back) throw new Error("no link back to the app");
    return `${r.rows} services listed; ${r.verdict.trim()}`;
  });

  await desktopStep("What the words mean: every linked word has its meaning, linked from the report's words and the footer", async () => {
    const ids = await page.evaluate(() => [...new Set(Object.values(GLOSSARY))]);
    const links = await page.evaluate(() => ({
      footer: !!document.querySelector('footer a[href="glossary.html"]'),
      report: !!document.querySelector('#report a.term[href*="glossary.html#"]'),
      term: term("radon", "x").includes("glossary.html#radon")
    }));
    const g = await page.context().newPage();
    await g.goto(new URL("glossary.html", BASE).href);
    const r = await g.evaluate(ids => ({
      missing: ids.filter(id => !document.querySelector(`.glossary dt[id="${id}"] + dd`)),
      entries: document.querySelectorAll(".glossary dt").length,
      back: !!document.querySelector('a[href="./"]')
    }), ids);
    await g.close();
    if (r.missing.length) throw new Error("no meaning on the page for: " + r.missing.join(", "));
    if (!links.footer || !links.report || !links.term || !r.back) throw new Error("missing link: " + JSON.stringify({ ...links, back: r.back }));
    return `${r.entries} words explained`;
  });

  await desktopStep("Slow report names the service it is waiting for", async () => {
    // Every outside service answers at once with no data, except "flooding from heavy rain", which is held
    // back. After 8 seconds the summary must name the Environment Agency and that topic. Nothing is sent
    // to the outside services in this step.
    const slowPage = await page.context().newPage();
    const errors = [];
    slowPage.on("pageerror", e => errors.push(e.message));
    await slowPage.route(u => !u.href.startsWith(BASE), async r => {
      if (r.request().url().includes("risk-of-flooding-from-surface-water")) await new Promise(x => setTimeout(x, 15000));
      await r.fulfill({ json: { features: [] } }).catch(() => {});
    });
    try {
      // Move the page's clock on instead of waiting the 8 seconds (Playwright's clock; time still runs normally
      // otherwise, so 5 seconds on the page's clock is at least 5 seconds after the check started).
      await slowPage.clock.install();
      await slowPage.goto(new URL("?lat=52.0&lon=-1.5&name=Slow%20test", BASE).href);
      await slowPage.clock.fastForward(5000);
      if (await slowPage.locator(".slow-note").count()) throw new Error("the note showed before 8 seconds");
      await slowPage.clock.fastForward(4000);
      await slowPage.waitForSelector(".slow-note", { timeout: 6000 });
      const text = (await slowPage.locator(".slow-note").innerText()).replace(/\s+/g, " ");
      if (errors.length) throw new Error("page errors: " + errors.join("; "));
      if (!/Environment Agency: Flooding from heavy rain/.test(text)) throw new Error("unexpected note: " + text);
      return text.slice(0, 90) + "…";
    } finally { await slowPage.close(); }
  });

  await desktopStep("A topic that could not load: Try again in the box under the grid", async () => {
    // Every outside service answers at once with no data, except "flooding from heavy rain", which fails until
    // Try again is pressed. Its card stays closed, so the box under the grid must offer Try again. Nothing is
    // sent to the outside services in this step.
    const failPage = await page.context().newPage();
    let down = true;
    await failPage.route(u => !u.href.startsWith(BASE), r => down && r.request().url().includes("risk-of-flooding-from-surface-water")
      ? r.fulfill({ status: 503, body: "" }).catch(() => {}) : r.fulfill({ json: { features: [] } }).catch(() => {}));
    try {
      // The request is tried again after 2 and 6 seconds (fetchJSON), and then not again as a whole topic (2.3.1):
      // move the page's clock on instead of waiting (Playwright's clock; time still runs normally otherwise).
      await failPage.clock.install();
      await failPage.goto(new URL("?lat=52.31&lon=-1.73&name=Try%20again%20test", BASE).href);
      const tile = failPage.locator('.topic-strip [data-why="surfacewater"]');
      const failedTile = '.topic-strip [data-why="surfacewater"].error';
      for (let i = 0; i < 20 && !(await failPage.$(failedTile)); i++) {
        await failPage.clock.fastForward(2000);
        await failPage.waitForSelector(failedTile, { timeout: 500 }).catch(() => {});
      }
      await failPage.waitForSelector(failedTile, { timeout: 5000 });
      if ((await failPage.evaluate(() => run.autoRetried || [])).includes("surfaceWater")) throw new Error("the topic was tried again as a whole after its request had been");
      await tile.click();
      const btn = failPage.locator('#whyBox [data-retry="surfacewater"]');
      if (!(await btn.isVisible())) throw new Error(`no Try again in the box under the grid: "${(await failPage.locator("#whyBox").innerText()).replace(/\s+/g, " ")}"`);
      if (await failPage.$eval("#check-surfacewater", d => d.open)) throw new Error("the topic card opened by itself");
      down = false;
      await btn.click();
      const ok = await failPage.waitForFunction(() => { const t = document.querySelector('.topic-strip [data-why="surfacewater"]');
        return t && !/\b(error|loading)\b/.test(t.className); }, null, { timeout: 20000 }).then(() => true, () => false);
      if (!ok) throw new Error("the topic did not load again after Try again");
      return `shown and pressed; now "${(await failPage.locator("#whyBox strong").innerText())}"`;
    } finally { await failPage.close(); }
  });

  await desktopStep("Slow services: a saved answer meanwhile, the report finishes at 45 seconds, late answers fill in", async () => {
    // Faster reports in outages (2.3.1). Every outside service answers at once with no data, except radon (British
    // Geological Survey) and "flooding from heavy rain" (Environment Agency), held until released. Radon has a saved
    // answer for this place from earlier today: after 8 seconds it shows, dated, until the live answer replaces it.
    // Heavy rain has none: after 45 seconds the report finishes and it says "slow to answer", then fills in when its
    // answer arrives. Nothing is sent to the outside services in this step.
    const p = await page.context().newPage();
    const gate = () => { let open; const shut = new Promise(r => { open = r; }); return { shut, open }; };
    const radonGate = gate(), rainGate = gate();
    await p.route(u => !u.href.startsWith(BASE), async r => {
      const url = r.request().url();
      if (url.startsWith("https://map.bgs.ac.uk/") && url.includes("/radon/")) await radonGate.shut;
      if (url.includes("risk-of-flooding-from-surface-water")) await rainGate.shut;
      await r.fulfill({ json: { features: [] } }).catch(() => {});   // a request the page gave up on is gone
    });
    // textContent, not innerText: a "No issue found" topic sits in a folded group, where innerText is empty.
    const card = id => p.evaluate(id => { const d = document.getElementById("check-" + id); return d ? d.textContent.replace(/\s+/g, " ") : ""; }, id);
    const tile = id => p.evaluate(id => (document.querySelector(`.topic-strip [data-why="${id}"]`) || {}).className || "", id);
    try {
      await p.clock.install();
      await p.goto(BASE);
      await p.evaluate(() => rememberAnswer({ lat: 52.41, lon: -1.52, radius: Number(document.getElementById("radius").value) },
        "radon", { CLASS_MAX: 1, Description: "Less than 1%", VERSION: "test" }));
      await p.goto(new URL("?lat=52.41&lon=-1.52&name=Slow%20services%20test", BASE).href);
      await p.waitForSelector("#slot-radon", { state: "attached" });
      await p.clock.fastForward(9000);
      await p.waitForFunction(() => /Saved result from/.test((document.getElementById("check-radon") || {}).textContent || ""), null, { timeout: 5000 })
        .catch(() => {});
      const saved = await card("radon");
      if (!/Saved result from/.test(saved) || !/slow to answer/.test(saved) || !/changes by itself/.test(saved)) throw new Error(`radon after 8 s: "${saved.slice(0, 160)}"`);
      radonGate.open();
      const live = await p.waitForFunction(() => { const d = document.getElementById("check-radon"); return d && !/Saved result from/.test(d.textContent); }, null, { timeout: 10000 })
        .then(() => true, () => false);
      if (!live) throw new Error("the live radon answer did not replace the saved one");
      if (await p.evaluate(() => run.done)) throw new Error("the report finished while heavy rain was still waiting");
      await p.clock.fastForward(37000);   // 46 seconds after the start
      const finished = await p.waitForFunction(() => run.done, null, { timeout: 5000 }).then(() => true, () => false);
      if (!finished) throw new Error("the report did not finish at 45 seconds");
      const slow = await card("surfacewater");
      if (!/error/.test(await tile("surfacewater")) || !/slow to answer/.test(slow)) throw new Error(`heavy rain at 45 s: "${slow.slice(0, 160)}"`);
      rainGate.open();
      const filled = await p.waitForFunction(() => { const t = document.querySelector('.topic-strip [data-why="surfacewater"]');
        return t && !/\b(error|loading)\b/.test(t.className); }, null, { timeout: 10000 }).then(() => true, () => false);
      if (!filled) throw new Error("the late heavy rain answer did not fill in the topic");
      return `radon: saved answer at 8 s, then live; heavy rain: "slow to answer" at 45 s, then filled in`;
    } finally { radonGate.open(); rainGate.open(); await p.close(); }
  });

  await desktopStep("Topics not covered in a country are left out and named in the country note (Scotland)", async () => {
    // postcodes.io answers "Scotland"; every other outside service answers at once with no data. Past floods and sale
    // prices cover only England and Wales (COVERAGE), so the finished report has no such topic, tile or card, and the
    // country note names them with a link to the national service.
    const scotPage = await page.context().newPage();
    await scotPage.route(u => !u.href.startsWith(BASE), r => r.request().url().startsWith("https://api.postcodes.io/postcodes?")
      ? r.fulfill({ json: { status: 200, result: [{ postcode: "EH1 1YZ", country: "Scotland", admin_district: "City of Edinburgh", latitude: 55.9533, longitude: -3.1883 }] } }).catch(() => {})
      : r.fulfill({ json: { features: [] } }).catch(() => {}));
    try {
      await scotPage.goto(new URL("?lat=55.9533&lon=-3.1883&name=Scotland%20test", BASE).href);
      if (!(await scotPage.waitForFunction(() => typeof run !== "undefined" && run && run.done, null, { timeout: 60000 }).then(() => true, () => false))) throw new Error("the report did not finish");
      const r = await scotPage.evaluate(() => ({ country: okValue(run.R, "place")?.country, all: CHECKS.length, results: orderedResults().length,
        tiles: document.querySelectorAll(".topic-strip [data-why]").length,
        left: ["pastfloods", "soldprices"].filter(id => document.querySelector(`[data-why="${id}"]`) || document.getElementById("slot-" + id) || run.results[id]),
        note: (document.querySelector("#summaryBox .notice") || {}).textContent || "", links: document.querySelectorAll("#summaryBox .notice a").length }));
      if (r.country !== "Scotland") throw new Error(`the place is in ${r.country}`);
      if (r.left.length || r.results !== r.all - 2 || r.tiles !== r.all - 2) throw new Error(`not covered topics still shown: ${JSON.stringify(r)}`);
      if (!/left out: past floods and prices/.test(r.note) || !r.links) throw new Error(`the country note does not name them: "${r.note.replace(/\s+/g, " ")}"`);
      return `${r.results} of ${r.all} topics shown; note names past floods and prices`;
    } finally { await scotPage.close(); }
  });

  await desktopStep("Next steps: notes, viewing and checklist folded, each with a count", async () => {
    const r = await page.evaluate(() => [...document.querySelectorAll("#nextSteps details.step-fold")]
      .map(d => ({ id: d.id, open: d.open, count: d.querySelector(":scope > summary .step-count").textContent })));
    const ids = r.map(x => x.id).join(",");
    if (ids !== "notes,viewing,checklist") throw new Error(`the parts are "${ids}", not notes, viewing, checklist`);
    const open = r.filter(x => x.open).map(x => x.id);
    if (open.length) throw new Error(`${open.join(", ")} open before being asked for`);
    const bad = r.filter(x => !(x.id === "notes" ? /^(Empty|Written)$/ : /^\d+ of \d+ done$/).test(x.count));
    if (bad.length) throw new Error(bad.map(x => `${x.id} says "${x.count}"`).join("; "));
    return r.map(x => `${x.id}: ${x.count}`).join(" · ");
  });

  await desktopStep("Send to my conveyancer", async () => {
    await page.click("#checklist > summary");
    const text = await page.evaluate(() => conveyancerText());
    if (!text.includes("?lat=") || !text.includes("Please could you include these searches")) throw new Error("the email text is incomplete");
    await page.click("#emailConveyancer");
    await until(() => document.getElementById("sendNote").textContent);
    const note = await page.$eval("#sendNote", x => x.textContent);
    if (!note.startsWith("Opening your email app")) throw new Error("the email button did not respond");
    return `email text ${text.length} characters`;
  });

  await step("Viewing checklist: short, serious topics first, ticks remembered", async () => {
    await page.click("#viewing > summary");
    await scrolled();
    const r = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#viewing input[data-tick]")].map(b => b.dataset.tick);
      const flagged = orderedResults().filter(c => ["high", "medium"].includes(c.status))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      const firstLook = flagged.map(c => (VIEWING_LOOK[c.id] || [])[0]).find(Boolean);
      const box = document.getElementById("viewing").getBoundingClientRect();
      // Every tip is a plain sentence (2.0.5 had put a topic icon's drawing in place of the radon tip).
      const badTips = Object.entries(VIEWING_LOOK).filter(([, tips]) => tips.some(t => /</.test(t) || !/[.?]$/.test(t))).map(([id]) => id);
      return { items, firstLook, badTips, onScreen: document.getElementById("viewing").open && box.top < innerHeight && box.bottom > 0 };
    });
    if (r.badTips.length) throw new Error(`viewing tips that are not plain sentences: ${r.badTips.join(", ")}`);
    if (!r.onScreen) throw new Error("At the viewing did not open in view");
    if (r.items.length < 5 || r.items.length > 12) throw new Error(`${r.items.length} items (expected 5 to 12)`);
    if (r.firstLook && r.items[0] !== r.firstLook) throw new Error(`first item is "${r.items[0]}", not the most serious topic's`);
    const first = page.locator("#viewing input[data-tick]").first();
    const countText = () => page.$eval("#viewing .tick-count", x => x.textContent);
    const before = await countText();
    await first.check();
    const after = await countText();
    await page.evaluate(() => restoreTicks());
    const kept = await first.isChecked();
    const afterRestore = await countText();
    await first.uncheck();
    if (!kept) throw new Error("a tick was not remembered");
    // Each list's heading counts its ticks: "0 of 7 done" becomes "1 of 7 done", also after reopening.
    const m = before.match(/^(\d+) of (\d+) done$/);
    if (!m) throw new Error(`the list heading says "${before}", not "N of M done"`);
    const want = `${Number(m[1]) + 1} of ${m[2]} done`;
    if (after !== want || afterRestore !== want) throw new Error(`after a tick the count says "${after}" / "${afterRestore}", not "${want}"`);
    return `${r.items.length} items; first: ${r.items[0].slice(0, 60)}…`;
  });

  await desktopStep("Back returns to the search, Forward reopens the report", async () => {
    await page.goBack();
    const backOk = await until(() => location.search === "" && document.getElementById("reportNav").classList.contains("hidden"));
    await page.goForward();
    await reportDone(page);
    return backOk ? "ok" : false;
  });

  await desktopStep("Saved property reopens instantly with notes", async () => {
    await page.click("#notes > summary");
    await page.fill("#notesText", "Automatic test note");
    await until(() => document.getElementById("notesFlash").textContent.includes("Saved"));
    const flash = await page.$eval("#notesFlash", x => x.textContent);
    if (!flash.includes("Saved")) throw new Error(`no "Saved" message after typing a note (got "${flash}")`);
    const written = await page.$eval("#notes .step-count", x => x.textContent);
    if (written !== "Written") throw new Error(`the Your notes fold says "${written}", not "Written"`);
    await page.reload();
    await reportDone(page);
    const instant = await page.$("#refreshBtn") !== null;
    const note = await page.$eval("#notesText", x => x.value);
    return instant && note === "Automatic test note" ? "ok" : false;
  });

  await step("Print summary and download", async () => {
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => { document.body.classList.add("print-summary"); dispatchEvent(new Event("beforeprint")); });
    // The printed map changes size and zoom: wait until its new tiles have loaded (the PDF is kept for people to look at).
    await until(() => { const m = document.getElementById("reportMap"), tiles = [...m.querySelectorAll("img.leaflet-tile")];
      return m.getBoundingClientRect().width === 360 && tiles.length && tiles.every(t => t.complete && t.classList.contains("leaflet-tile-loaded")); });
    try {   // the page is always put back on screen, even if a check below fails (later steps need it)
    // On paper: page 1 has the at-a-glance table (one row per topic); every page gets the place, date and page number;
    // app instructions, the tappable grid and the "saved results" note are left out.
    const paper = await page.evaluate(() => {
      const shown = sel => [...document.querySelectorAll(sel)].some(el => el.getClientRects().length > 0);
      const map = document.getElementById("reportMap").getBoundingClientRect();
      return { rows: document.querySelectorAll(".glance-table tbody tr:not(.glance-group)").length, topics: orderedResults().length,
        map: [Math.round(map.width), Math.round(map.height)], caption: shown("#mapCaption") && /^Figure 1\./.test(document.getElementById("mapCaption").textContent),
        cover: shown(".cover-details"), liveLink: shown(".live-link") && document.querySelector(".live-link").textContent.includes(location.href),
        keyFindings: document.querySelectorAll(".key-findings li").length, problems: orderedResults().filter(c => ["high", "medium"].includes(c.status)).length,
        keyShown: shown(".key-findings"), qr: shown(".cover-qr svg"),
        table: shown(".glance-table"), footer: (document.getElementById("printFooter") || {}).textContent || "",
        grid: shown(".topic-strip"), howTo: shown("#info-read"), saved: shown(".saved-note"), more: shown(".info-row"),
        icons: shown(".summary-head .icon-btn"), keep: shown(".keep-row"), checklists: shown(".next-steps"), notesPage: shown(".notes-page") };
    });
    if (!paper.table || paper.rows !== paper.topics) throw new Error(`the at-a-glance table shows ${paper.rows} of ${paper.topics} topics (visible: ${paper.table})`);
    if (paper.map[0] < 300 || Math.abs(paper.map[0] / paper.map[1] - 4 / 3) > 0.03 || !paper.caption) throw new Error(`printed map ${paper.map.join("×")} px, caption shown: ${paper.caption} (expected 4:3 with "Figure 1." caption)`);
    if (!paper.cover || !paper.liveLink || !paper.qr) throw new Error(`printed cover: details table ${paper.cover}, live report link ${paper.liveLink}, QR code ${paper.qr}`);
    const wantKey = Math.min(3, paper.problems);
    if (paper.keyFindings !== wantKey || (wantKey && !paper.keyShown)) throw new Error(`Key findings lists ${paper.keyFindings}, expected ${wantKey} (shown: ${paper.keyShown})`);
    if (!/counter\(page\)/.test(paper.footer) || !/counter\(pages\)/.test(paper.footer)) throw new Error("no page numbers in the printed footer");
    const onPaper = Object.entries({ grid: paper.grid, "how to read": paper.howTo, "saved note": paper.saved, "More button": paper.more, "share and print icons": paper.icons, "Keep this report buttons": paper.keep }).filter(([, v]) => v).map(([k]) => k);
    if (onPaper.length) throw new Error("printed but should not be: " + onPaper.join(", "));
    // The short printout is 2 pages: the cover, key findings and the topic table; checklists and the notes page are left out.
    if (paper.checklists || paper.notesPage) throw new Error("the short printout includes the checklists or the notes page");
    const pdf = await page.pdf({ path: `${OUT}/${device.name.replace(/\W+/g, "-")}-summary.pdf`, format: "A4" });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (pages < 1 || pages > 2) throw new Error(`the short printout is ${pages} pages (expected 2 at most)`);
    // The full printout adds a one-line contents under the summary and a lined notes page at the end.
    await page.evaluate(() => document.body.classList.remove("print-summary"));   // beforeprint already ran: only the mode changes
    const full = await page.evaluate(() => ({
      contents: [...document.querySelectorAll(".print-contents")].some(el => el.getClientRects().length > 0) && /Next steps/.test(document.querySelector(".print-contents").textContent),
      lines: document.querySelectorAll(".notes-page .note-line").length,
      notesShown: document.querySelector(".notes-page").getClientRects().length > 0 }));
    if (!full.contents || !full.notesShown || full.lines < 20) throw new Error(`full printout: contents line ${full.contents}, notes page ${full.notesShown} with ${full.lines} lines`);
    } finally {
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => { document.body.classList.remove("print-summary"); dispatchEvent(new Event("afterprint")); });
    }
    // Share and Print sit on the Summary heading's line as icons with spoken names; Download and Print full report
    // sit under the summary.
    const head = await page.evaluate(() => {
      const h = document.querySelector(".summary-title").getBoundingClientRect(), mid = r => r.top + r.height / 2;
      return ["shareBtn", "printSummary"].map(id => { const b = document.getElementById(id), r = b.getBoundingClientRect();
        return { id, label: b.getAttribute("aria-label") || "", inLine: r.width > 0 && Math.abs(mid(r) - mid(h)) < h.height, enabled: !b.disabled }; });
    });
    const off = head.filter(b => !b.inLine || !b.label || !b.enabled).map(b => b.id);
    if (off.length) throw new Error(`not usable on the Summary line: ${off.join(", ")}`);
    if (!(await page.isVisible(".keep-row #downloadHtml")) || !(await page.isVisible(".keep-row #printReport"))) throw new Error("Download report and Print full report are not under the summary");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadHtml")]);
    const saved = `${OUT}/${device.name.replace(/\W+/g, "-")}-report.html`;
    await download.saveAs(saved);
    // The download keeps the licence credits (on screen they are in the page footer's "Data credits and licences").
    if (!/Created with Property Location Check[^<]*Open Government/.test(readFileSync(saved, "utf8").replace(/\s+/g, " ")))
      throw new Error("the downloaded report has no credits line");
    return download.suggestedFilename();
  });

  await step("One-line bar: the search and saved list shrink above the report", async () => {
    const hidden = id => page.evaluate(i => getComputedStyle(document.getElementById(i)).display === "none", id);
    const bar = await page.evaluate(() => ({ shown: !document.getElementById("placeBar").classList.contains("hidden"),
      name: document.getElementById("placeName").textContent, saved: document.getElementById("showSaved").textContent.trim() }));
    if (!bar.shown || !bar.name) throw new Error("the one-line bar is not shown above the report");
    if (!(await hidden("searchPanel")) || !(await hidden("savedPanel"))) throw new Error("the search or saved list is still shown in full");
    if (!/^Saved \(\d+\)$/.test(bar.saved)) throw new Error(`the saved button says "${bar.saved}"`);
    await page.click("#changePlace");
    const mapShown = !(await hidden("searchPanel")) && await page.$eval("#map", m => m.getBoundingClientRect().height > 100);
    await page.click("#changePlace");
    if (!mapShown || !(await hidden("searchPanel"))) throw new Error("Change did not show and hide the search map");
    await page.click("#showSaved");
    if (await hidden("savedPanel")) throw new Error("Saved did not show the saved list");
    return `${bar.name} · ${bar.saved}`;
  });

  await step("Saved properties are readable", async () => {
    // The name and details should use most of the row, not a thin column beside the buttons.
    const share = await page.evaluate(() => {
      const list = document.getElementById("savedList"), main = list && list.querySelector(".saved-main");
      return list && main && list.offsetWidth ? main.getBoundingClientRect().width / list.getBoundingClientRect().width : 0;
    });
    if (!share) throw new Error("the saved properties list did not show");
    if (share < 0.55) throw new Error(`names and details are squeezed into ${Math.round(share * 100)}% of the row`);
    return `text uses ${Math.round(share * 100)}% of the row`;
  });

  await desktopStep("Export and Import fold into Move to another device", async () => {
    const r = await page.evaluate(() => {
      const d = document.getElementById("moveDevice");
      return { closed: d && !d.open, inside: d && d.contains(document.getElementById("exportBtn")) && d.contains(document.getElementById("importBtn")) };
    });
    if (!r.inside) throw new Error("Export and Import are not in the Move to another device panel");
    if (!r.closed) throw new Error("the panel is open before it is used");
    await page.click("#moveDevice summary");
    const shown = await page.isVisible("#exportBtn") && await page.isVisible("#importBtn");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    await page.click("#moveDevice summary");
    if (!shown) throw new Error("Export and Import did not show when the panel opened");
    return download.suggestedFilename();
  });

  await step("Remove a saved property, then Undo puts it back", async () => {
    const before = await page.$$eval("#savedList li", x => x.length);
    const key = await page.$eval("#savedList [data-remove]", b => b.dataset.remove);
    await page.click("#savedList [data-remove]");
    const r = await page.evaluate(k => ({
      rows: document.querySelectorAll("#savedList li").length,
      bar: !document.getElementById("undoBar").classList.contains("hidden"),
      focus: document.activeElement && document.activeElement.id,
      snap: localStorage.getItem("plc-snap:" + k) !== null
    }), key);
    if (r.rows !== before - 1 || r.snap) throw new Error("Remove did not remove the property");
    if (!r.bar || r.focus !== "undoBtn") throw new Error("no Undo button offered, or it did not get focus");
    await page.click("#undoBtn");
    const back = await page.evaluate(k => ({
      rows: document.querySelectorAll("#savedList li").length,
      snap: localStorage.getItem("plc-snap:" + k) !== null,
      bar: !document.getElementById("undoBar").classList.contains("hidden")
    }), key);
    if (back.rows !== before || !back.snap || back.bar) throw new Error("Undo did not put the property and its saved report back");
    return "ok";
  });

  await step("Compare up to three saved properties, and show only differences", async () => {
    // Add two copies of the saved property (one with a different first rating), compare all three, then put the list back.
    const keep = await page.evaluate(() => {
      const list = store.get(SAVED_KEY, []), orig = JSON.stringify(list), s = list[0];
      const copy = (n, change) => ({ ...JSON.parse(JSON.stringify(s)), key: "test-cmp-" + n, name: "Test copy " + n, starred: false,
        checks: s.checks.map((c, i) => i === 0 && change ? { ...c, status: c.status === "high" ? "low" : "high" } : c) });
      store.set(SAVED_KEY, [...list, copy(1, false), copy(2, true)]);
      renderSaved();
      return orig;
    });
    try {
      await page.check(`#savedList input[data-compare="test-cmp-1"]`);
      await page.check(`#savedList input[data-compare="test-cmp-2"]`);
      if (await page.isDisabled("#compareBtn")) throw new Error("Compare is not ready with two properties ticked");
      await page.check("#savedList input[data-compare]:not(:checked)");
      const off = await page.$$eval("#savedList input[data-compare]:not(:checked)", x => x.every(b => b.disabled));
      if (!off) throw new Error("a fourth property could still be ticked");
      await page.click("#compareBtn");
      const r = await page.evaluate(() => ({
        cols: document.querySelectorAll("#compareTable thead th").length,
        title: document.getElementById("compareTitle").textContent,
        rows: document.querySelectorAll("#compareTable tbody tr").length
      }));
      if (r.cols !== 4 || !r.title.includes("three")) throw new Error(`expected three properties side by side (got ${r.cols - 1}, "${r.title}")`);
      await page.check("#diffOnly");
      const shown = await page.$$eval("#compareTable tbody tr", x => x.filter(tr => tr.offsetHeight > 0).length);
      const help = await page.$eval("#diffHelp", x => x.textContent);
      if (shown < 2 || shown >= r.rows) throw new Error(`"Show only topics that differ" showed ${shown} of ${r.rows} rows`);
      if (!/^Showing/.test(help)) throw new Error(`no message about the topics shown (got "${help}")`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error("the comparison scrolls sideways");
      return `${r.rows} rows, ${shown} shown with differences only`;
    } finally {
      await page.evaluate(orig => { document.getElementById("comparePanel").classList.add("hidden"); localStorage.setItem(SAVED_KEY, orig); renderSaved(); }, keep);
    }
  });

  await step("No sideways scrolling", async () =>
    (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) ? "ok" : false);

  record(group, "No page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
  await context.close();
  return topics;
}
