// Property Location Check – comfort (larger text, install as an app) and start-up.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { $, APP_UPDATED, APP_VERSION, MISSING, on } from "./core.js";
import { store } from "./store.js";
import { initMap, selected } from "./map.js";
import { lookupPostcode } from "./search.js";
import { renderSaved } from "./saved.js";
import { openReportFromAddress, runChecks } from "./run.js";
import { reportMap } from "./report.js";

/* =========================================================
   COMFORT: larger text, install as an app
========================================================= */

if ($("appVersion")) $("appVersion").textContent = `Version ${APP_VERSION}, updated ${APP_UPDATED}`;
else console.error(MISSING + "appVersion (the version line)");

function setLargeText(on) {
  document.documentElement.classList.toggle("large-text", on);
  $("textSizeBtn").setAttribute("aria-pressed", String(on));
  $("textSizeBtn").title = on ? "Normal text size" : "Larger text";
  store.set("plc-large-text", on);
  if (reportMap) setTimeout(() => reportMap.invalidateSize(), 50);
}
on("textSizeBtn", "click", () => setLargeText(!document.documentElement.classList.contains("large-text")));
setLargeText(store.get("plc-large-text", false));

let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  $("installBtn").classList.remove("hidden");
});
on("installBtn", "click", async () => {
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
  }
});
