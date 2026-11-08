"use strict";
// Property Location Check – share, download and print.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* =========================================================
   SHARE, EXPORT AND PRINT
========================================================= */

// The share, print and download buttons are drawn with the report, so one listener serves them all.
async function shareReport() {
  const url = location.href;
  const title = "Property Location Report" + (run ? " – " + run.loc.name : "");
  if (navigator.share) {
    try { await navigator.share({ title, text: title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    $("shareNote").textContent = "Link copied";
    setTimeout(() => { if ($("shareNote")) $("shareNote").textContent = ""; }, 2500);
  } catch (e) {
    prompt("Copy this link:", url);
  }
}

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

function downloadReport() {
  if (!reportData) return;
  const copy = $("report").cloneNode(true);
  copy.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
  copy.querySelectorAll(".info-body, .list-extra").forEach(d => d.removeAttribute("hidden"));
  copy.querySelectorAll(".info-btn, .info-row, [data-retry], .saved-note button, #whyBox, .send-box, .icon-btn, .share-note, .keep-row").forEach(b => b.remove());
  copy.querySelectorAll("#notesText").forEach(t => t.remove());
  copy.querySelectorAll(".notes-print").forEach(d => { d.removeAttribute("aria-hidden"); d.classList.add("notes-download"); });
  copy.querySelectorAll(".report-credits").forEach(p => p.classList.remove("print-only"));   // the download keeps its credits line
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
body{max-width:960px;margin:24px auto;padding:0 18px}
@media print {${pageFooterCss()}}</style>
</head><body>${copy.innerHTML}<p class="help">Live version: <a href="${escapeHTML(location.href)}">${escapeHTML(location.href)}</a></p></body></html>`;
  downloadFile(fileBase() + ".html", html, "text/html");
}

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
  document.body.classList.add("printing");      // the map takes its printed 4:3 size (css/app.css) before it is refitted
  fitReportMap();
  if (run) {
    const style = document.createElement("style");
    style.id = "printFooter";
    style.textContent = pageFooterCss();
    document.head.appendChild(style);
  }
});
window.addEventListener("afterprint", () => {
  const footer = $("printFooter"); if (footer) footer.remove();
  document.body.classList.remove("printing");
  if (reportMap) { reportMap.invalidateSize(); fitReportMap(); }
  closedBeforePrint.forEach(d => { d.open = false; });
  document.body.classList.remove("print-summary");
});

// Every printed page: the place and date (left), a short disclaimer (centre) and "Page 2 of 6" (right). Page margin
// boxes print in Chrome and Edge; other browsers print the report without them.
function pageFooterCss() {
  const cssText = t => JSON.stringify(String(t).replace(/[\n\r]+/g, " "));
  const box = "font:9px Arial,sans-serif;color:#555";
  return `@page {
    @bottom-left { content: ${cssText(run.loc.name + " · " + today())}; ${box} }
    @bottom-center { content: "A first look from public data, not a survey"; ${box} }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} }
  }`;
}

const REPORT_ACTIONS = {
  shareBtn: shareReport,
  downloadHtml: downloadReport,
  printReport: () => window.print(),
  // Short printout (2 pages): the cover, key findings and the topic table. The checklists stay in the full report.
  printSummary: () => { document.body.classList.add("print-summary"); window.print(); }
};
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#report button[id]");
  if (b && !b.disabled && REPORT_ACTIONS[b.id]) REPORT_ACTIONS[b.id]();
});
