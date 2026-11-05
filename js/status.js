"use strict";
// Property Location Check – the data service status page (status.html).
// A separate page with its own small script: it does not load or change the main app.
// It shows the result of the daily automatic check (tests/live-check.mjs), which the
// workflow publishes to the "status" branch (tests/publish-status.mjs).

const STATUS_URL = "https://raw.githubusercontent.com/andyseremet/reports-examles/status/status.json";
const LABEL = { ok: "Working", warn: "Warning", fail: "Not answering" };
const CHIP = { ok: "low", warn: "medium", fail: "high" };   // same colours as the report ratings
const box = document.getElementById("statusBox");

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const when = iso => new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
const dayName = date => new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// "answered in 344 ms" for a working service; otherwise the reason, in plain words.
function detail(s) {
  if (s.status === "ok") return /^\d+ ms$/.test(s.detail) ? `Answered in ${s.detail}` : esc(s.detail);
  if (s.status === "warn") return "Refused the test machine, but answered everyone else (a known limit on GitHub's shared machines).";
  return esc(s.detail || "Did not answer.");
}

// The 7 calendar days ending on the day of the last check, oldest first.
function sevenDays(checked) {
  const end = Date.parse(checked.slice(0, 10));
  return Array.from({ length: 7 }, (_, i) => new Date(end - (6 - i) * 864e5).toISOString().slice(0, 10));
}

function lastDays(days, history, name) {
  const states = days.map(date => { const h = history.find(x => x.date === date); return (h && h.services[name]) || "none"; });
  // Colour alone is not enough: screen readers get the same information as words.
  const said = ["ok", "warn", "fail", "none"].map(st => [st, states.filter(x => x === st).length]).filter(([, n]) => n)
    .map(([st, n]) => `${n} ${(LABEL[st] || "not checked").toLowerCase()}`).join(", ");
  return `<span class="status-days" role="img" aria-label="Last 7 days: ${esc(said)}">${states.map((st, i) =>
    `<span class="day-dot ${st}" title="${esc(dayName(days[i]))}: ${esc(LABEL[st] || "Not checked")}"></span>`).join("")}</span>`;
}

function render(data) {
  // Problems first (not answering, then warnings), otherwise in the usual order.
  const rank = { fail: 0, warn: 1 };
  const services = (data.services || []).map((s, i) => ({ ...s, i }))
    .sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || a.i - b.i);
  const count = st => services.filter(s => s.status === st).length;
  const history = data.history || [];
  const days = sevenDays(data.checked);
  const down = services.filter(s => s.status === "fail");
  box.innerHTML = `
    <p class="verdict">${down.length
      ? `<strong>${down.length} of ${services.length} services</strong> did not answer in the last check.`
      : `<strong>All ${services.length} services</strong> answered in the last check.`}</p>
    <p class="help">Last checked: <strong>${esc(when(data.checked))}</strong>.
      ${count("ok")} working${count("warn") ? `, ${count("warn")} with a warning` : ""}${count("fail") ? `, ${count("fail")} not answering` : ""}.</p>
    <div class="table-wrap"><table class="status-table">
      <thead><tr><th>Data service</th><th>Last check</th><th>Report topics it feeds</th><th>Last 7 days</th></tr></thead>
      <tbody>${services.map(s => `<tr>
        <td data-label="Data service"><strong>${esc(s.name)}</strong></td>
        <td data-label="Last check"><span class="chip ${CHIP[s.status] || "manual"}">${LABEL[s.status] || "Not checked"}</span><br><span class="help">${detail(s)}</span></td>
        <td data-label="Report topics it feeds">${(s.topics || []).map(esc).join("<br>")}</td>
        <td data-label="Last 7 days">${lastDays(days, history, s.name)}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="help">Dots, oldest first: <span class="day-dot ok"></span> working, <span class="day-dot warn"></span> warning,
      <span class="day-dot fail"></span> not answering, <span class="day-dot none"></span> not checked that day.
      A “Warning” means the service refused GitHub's shared test machine but answered everyone else.</p>`;
}

fetch(STATUS_URL, { cache: "no-cache" })
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(render)
  .catch(() => {
    box.innerHTML = `<p>The latest results could not be loaded right now. They are published after each morning's
      check; please try again later.</p>`;
  });
