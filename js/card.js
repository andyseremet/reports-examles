// Property Location Check – a plain topic card for other apps (js/kit.js): one topic's result as simple HTML with no
// styles of its own, so the app that shows it styles it (owner, 8 November 2026). The main app draws its own cards
// (js/report.js). Classes start with "plc-"; data-topic and data-status let a host style each topic and rating.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, link, savedDate, STATUS_LABEL } from "./core.js";
import { nationalService } from "./coverage.js";

// A card while the topic is being checked.
function plainLoadingCard(c) {
  return `<article class="plc-card" data-topic="${escapeHTML(c.id)}" data-status="loading" aria-busy="true">
  <h3 class="plc-title">${escapeHTML(c.title)}</h3>
  <p class="plc-status">Checking…</p>
</article>`;
}

// A topic not covered in the place's country (result null): where to check instead.
function plainNotCoveredCard(c, country) {
  const service = country && nationalService(c.id, country);
  return `<article class="plc-card" data-topic="${escapeHTML(c.id)}" data-status="not-covered">
  <h3 class="plc-title">${escapeHTML(c.title)}</h3>
  <p class="plc-found">Our data for this topic does not cover ${country ? escapeHTML(country) : "this place"}.${service
    ? ` Check it with ${link(service[1], service[0])}.` : ""}</p>
</article>`;
}

// A table too wide for a small screen scrolls sideways in its box: keyboard users can reach it, and it has a name.
const focusableTables = (html, title) =>
  html.replace(/<div class="table-wrap">/g, `<div class="table-wrap" tabindex="0" role="region" aria-label="${escapeHTML(title)} table">`);

// One topic's result (from the runner: js/runner.js) as a card. The found line is plain text; details, meaning and
// actions are HTML the topic built (values escaped, links through link() and term()).
function renderCard(c, result, { country = null } = {}) {
  if (!result) return plainNotCoveredCard(c, country);
  const r = result;
  const saved = r.fromSaved ? `<p class="plc-saved">${r.waiting ? "The data service is slow to answer" : "The data service is not answering right now"},
    so this is the saved result from ${escapeHTML(savedDate(r.fromSaved))}. It may be out of date.</p>` : "";
  const actions = r.actions && r.actions.length ? `<ul class="plc-actions">${r.actions.map(a => `<li>${a}</li>`).join("")}</ul>` : "";
  const source = r.source && r.source.name
    ? `<p class="plc-source">Source: ${r.source.url ? link(r.source.url, r.source.name) : escapeHTML(r.source.name)}${r.dataDate ? `. ${escapeHTML(r.dataDate)}` : ""}.</p>` : "";
  return `<article class="plc-card" data-topic="${escapeHTML(c.id)}" data-status="${escapeHTML(r.status)}">
  <h3 class="plc-title">${escapeHTML(c.title)}</h3>
  <p class="plc-status">${escapeHTML(STATUS_LABEL[r.status] || r.status)}</p>
  <p class="plc-found">${escapeHTML(r.found || "")}</p>
  ${saved}${r.status === "error" ? `<p><button class="plc-retry" type="button">Try again</button></p>` : ""}
  ${actions ? `<h4>What to do</h4>${actions}` : ""}
  ${r.details ? `<div class="plc-details"><h4>What we found</h4>${focusableTables(r.details, c.title)}</div>` : ""}
  ${r.meaning ? `<div class="plc-meaning"><h4>What this means</h4>${r.meaning}</div>` : ""}
  ${source}
</article>`;
}

export { plainLoadingCard, renderCard };
