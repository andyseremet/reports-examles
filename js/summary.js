"use strict";
// Property Location Check – the summary at the top of the report: the verdict, the topic grid, the box under it and key findings.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

// The verdict of a finished report, from n(rating) = how many topics have that rating. Missing data is never good
// news: nothing answered is never a bold "No issues found" (code review, 2.3.3).
function doneVerdict(n) {
  const unchecked = n("manual") + n("error"), checked = n("low") + n("info");
  const notChecked = unchecked ? `${plural(unchecked, "topic")} could not be checked here.` : "";
  if (n("high") || n("medium")) {
    // One clear sentence, then the rest in smaller words underneath.
    const found = [n("high") && `<strong>${plural(n("high"), "thing")} to look into</strong>`,
      n("medium") && `<strong>${n("medium")} worth checking</strong>`].filter(Boolean).join(" and ");
    return `<p class="verdict">We found ${found}.</p>
      <p class="verdict-sub">${plural(n("low"), "check")} found no issue. ${notChecked}</p>`;
  }
  if (!checked) return `<p class="verdict"><strong>Nothing could be checked right now.</strong></p>
      <p class="verdict-sub">${notChecked} Try again later, or use the official services linked in each topic.</p>`;
  if (unchecked) return `<p class="verdict">No issues found in the ${plural(checked, "check")} we ran, but
      <strong>${plural(unchecked, "topic")} could not be checked</strong>.</p>`;
  return `<p class="verdict"><strong>No issues found</strong> in the ${plural(checked, "check")} we ran.</p>`;
}

function renderSummary() {
  const results = orderedResults();
  const n = s => results.filter(c => c.status === s).length;
  const ready = results.length;
  const p = okValue(run.R, "place");
  const outsideEngland = p && p.country && p.country !== "England";
  const priority = results.filter(c => ["high", "medium"].includes(c.status))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  let verdict;
  if (!run.done) {
    const total = shownChecks().length;
    verdict = `<p class="verdict">Checking official data… <strong>${ready} of ${total}</strong> topics ready.</p>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${ready}">
        <span style="width:${Math.round(ready / total * 100)}%"></span></div>${slowNote()}`;
  } else verdict = doneVerdict(n);

  const old = run.snapshot && isOld(run.snapshot.savedAt);
  const savedNote = run.snapshot ? `<div class="notice saved-note${old ? " old" : ""}">Saved results from
      <strong>${escapeHTML(new Date(run.snapshot.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</strong>.
      ${old ? `<span><strong>These results are over ${OLD_MONTHS} months old.</strong> Official data may have changed since; refresh before relying on them.</span>` : ""}
      <button class="primary small-btn icon-label" type="button" id="refreshBtn" aria-label="Refresh with the latest data">${icon("refresh")}Refresh</button></div>` : "";
  $("summaryBox").innerHTML = `
    ${savedNote}
    ${verdict}
    <ul class="topic-strip" aria-label="All topics at a glance">
      ${shownChecks().map(c => {
        const res = run.results[c.id];
        const st = res ? res.status : "loading";
        const [paths, short] = TOPIC_ICONS[c.id];
        const label = res ? STATUS_LABEL[st] : "Checking";
        // The spoken name starts with the visible short name, so voice control users can say it.
        const name = ` ${c.title.toLowerCase()} `.includes(` ${short.toLowerCase()} `) ? c.title : `${short} (${c.title})`;
        return `<li><button type="button" class="topic ${st}" data-why="${c.id}" aria-controls="whyBox"
            aria-expanded="${run.whyId === c.id}" aria-label="${escapeHTML(name)}: ${label}. Show why">
<svg class="topic-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg><span class="topic-name">${short}</span></button></li>`;
      }).join("")}
    </ul>
    ${whyBox()}
    ${run.done && priority.length ? `<div class="key-findings"><h3>Key findings</h3><ol>${priority.slice(0, 3).map(c =>
      `<li>${chip(c.status)} <a href="#check-${c.id}" data-open="check-${c.id}"><strong>${escapeHTML(c.title)}</strong></a>: ${escapeHTML(c.found)}</li>`).join("")}</ol>${priority.length > 3
      ? `<p>And ${plural(priority.length - 3, "more topic")} to look into or check: see the <span class="print-only">table</span><span class="no-print">sections</span> below.</p>` : ""}</div>` : ""}
    ${glanceTable(results)}
    ${outsideEngland ? `<div class="notice"><strong>This location is in ${escapeHTML(p.country)}.</strong>
      ${p.country === "Wales"
        ? "Topics use Welsh data where England's stops at the border. Where Wales publishes nothing (for example old landfill sites), the topic says “Check yourself”."
        : p.country === "Scotland"
        ? "Topics use Scottish data where England's stops at the border. Where Scotland publishes nothing for part of a topic (for example old landfill sites), the topic says “Check yourself”."
        : p.country === "Northern Ireland"
        ? "Heritage, nature, noise, coast, air and crime use Northern Ireland data."
        : "Some official data only covers England."}${notCoveredNote()}</div>` : ""}`;
  updateToggleAll();
}

// Printed report, page 1: every topic in one table (rating symbol and label, and the one-line finding), in report order.
// On screen the topic grid does this job, so the table is shown on paper only (css/app.css, .print-only).
function glanceTable(results) {
  if (!results.length) return "";
  return `<div class="glance print-only"><h3>All topics at a glance</h3>
    <table class="glance-table"><thead><tr><th>Topic</th><th>Rating</th><th>What we found</th></tr></thead><tbody>${
      GROUPS.map(g => {
        const rows = results.filter(c => c.group === g.id);
        return rows.length ? `<tr class="glance-group"><th colspan="3" scope="colgroup">${escapeHTML(g.title)}</th></tr>` +
          rows.map(c => `<tr><td>${escapeHTML(c.title)}</td><td>${chip(c.status)}</td><td>${escapeHTML(c.found)}</td></tr>`).join("") : "";
      }).join("")
    }</tbody></table>
    <p class="glance-key">❗ Look into this: could affect value, insurance, health or safety. ⚠️ Worth checking: ask questions or
      order a search. ✓ No issue found in the data checked. ℹ️ For information. ? Check yourself: no data here.</p>
    <p class="glance-note">A free first look using public data. It does not replace a building survey or your conveyancer's
      searches. “No issue found” means nothing was found in the data we checked, not that there is no risk.</p></div>`;
}

// The one-line reason for the topic tapped in the strip above, with Try again when it could not load.
function whyBox() {
  const c = run.whyId && CHECKS.find(x => x.id === run.whyId);
  if (!c) return `<div id="whyBox" hidden></div>`;
  const res = run.results[c.id];
  const st = res ? res.status : "loading";
  const text = res ? res.found : "Still checking the official data…";
  return `<div id="whyBox" class="why-box ${st}" aria-live="polite">
    <strong>${escapeHTML(c.title)}: ${res ? STATUS_LABEL[st] : "Checking"}</strong>
    <p>${escapeHTML(text || "")}</p>
    ${res ? `<p class="why-actions">${canRetry(res) ? retryButton(c.id) : ""}<a href="#check-${c.id}" data-open="check-${c.id}">Read the full section</a></p>` : ""}</div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-why]");
  if (!btn || !run) return;
  run.whyId = run.whyId === btn.dataset.why ? null : btn.dataset.why;
  renderSummary();
  const again = document.querySelector(`[data-why="${btn.dataset.why}"]`);
  if (again) again.focus();
});
