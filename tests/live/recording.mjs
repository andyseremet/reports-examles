// Recording and replaying the report pages' outside answers, and the pause for the Environment Agency map server.
import { readFileSync } from "node:fs";
import { BASE, UA, QUIET, RECORD, REPLAY, EA_MAP_SERVER, PAUSE_BEFORE_REPORT_MS } from "./settings.mjs";

export const recorded = {};
export let replayData = null, replayed = 0;
export const askedLive = new Set();
export const recKey = req => {
  const dated = s => String(s || "").replace(/\d{4}-\d{2}-\d{2}/g, "DATE");   // a date in a query (sale prices since…) changes daily
  return `${req.method()} ${dated(req.url())}${req.postData() ? " " + dated(req.postData()) : ""}`;
};
export const isOutsideData = req => {
  if (!["fetch", "xhr"].includes(req.resourceType())) return false;
  if (req.serviceWorker()) return false;   // sw.js saving the map library for offline use: app files, not data
  const host = new URL(req.url()).host;
  return host !== new URL(BASE).host && host !== "raw.githubusercontent.com";
};
export const TEXT_TYPE = /json|text|xml|javascript/;
export async function loadReplay() {
  if (!REPLAY) return;
  try {
    replayData = /^https?:/.test(REPLAY) ? await (await fetch(REPLAY, { headers: { "User-Agent": UA } })).json()
      : JSON.parse(readFileSync(REPLAY, "utf8"));
    if (!replayData || !replayData.answers) throw new Error("no answers in the file");
  } catch (e) {
    replayData = null;
    console.log(`No recorded answers (${e.message}): every outside service is asked live.`);
  }
}
// Called for every browser context the test opens.
// It also notes when a page sends a request to the Environment Agency map server (the pause between reports counts
// from the last one). A test step's own stub (page.route) answers first, so a stubbed request is never counted.
export async function steadyContext(context) {
  const goneLive = new WeakSet();
  await context.route(() => true, route => {
    const req = route.request();
    if (!isOutsideData(req)) return route.fallback();
    if (replayData) {
      const hit = replayData.answers[recKey(req)];
      if (hit) {
        replayed++;
        return route.fulfill({ status: hit.status, contentType: hit.type, headers: { "access-control-allow-origin": "*" },
          body: hit.text !== undefined ? hit.text : Buffer.from(hit.base64, "base64") });
      }
      askedLive.add(new URL(req.url()).host);
    }
    if (req.url().includes(EA_MAP_SERVER)) noteEARequest();
    goneLive.add(req);
    return route.fallback();
  });
  if (RECORD) context.on("requestfinished", async req => {
    if (!goneLive.has(req)) return;
    try {
      const res = await req.response();
      if (!res || res.status() >= 400) return;          // only working answers are kept
      const type = res.headers()["content-type"] || "application/octet-stream";
      const body = await res.body();
      recorded[recKey(req)] = { at: new Date().toISOString(), status: res.status(), type,
        ...(TEXT_TYPE.test(type) ? { text: body.toString("utf8") } : { base64: body.toString("base64") }) };
    } catch (e) { /* the page was closed before the answer was read */ }
  });
}
export let lastEARequest = 0;
export const noteEARequest = () => { lastEARequest = Date.now(); };
export const quietForEA = async () => {
  const wait = lastEARequest + PAUSE_BEFORE_REPORT_MS - Date.now();
  if (wait <= 0) return;
  if (!QUIET) console.log(`(waiting ${Math.ceil(wait / 1000)} s: a minute after the last Environment Agency map request)`);
  await new Promise(r => setTimeout(r, wait));
};
