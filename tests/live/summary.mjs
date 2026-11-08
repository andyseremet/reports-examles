// Writing the summary (summary.md, results.json, status.json, issues.json and GitHub's run summary).
import { writeFileSync, appendFileSync } from "node:fs";
import { BASE, OUT, CHECK_DATA_SERVICES, ONLY_SERVICES, PARTIAL } from "./settings.mjs";
import { results } from "./results.mjs";
import { SERVICES, SERVICE_TOPICS } from "./services.mjs";
import { DEVICES } from "./devices.mjs";

// Sorts and writes the results; answers how many checks failed.
export function writeSummary(reports) {
  // Parts that ran at the same time recorded their results mixed: list them in the usual order (stable within a part).
  const partRank = r => r.group === "Data services" ? 0 : r.group.startsWith("Country data") ? 1
    : (i => i >= 0 ? 2 + i : 8)(DEVICES.findIndex(d => r.group.startsWith(d.name + " – "))) + (r.group === "Test run" ? 1 : 0);
  results.sort((a, b) => partRank(a) - partRank(b));
  const failed = results.filter(r => !r.pass);
  const warned = results.filter(r => r.warn);
  // One line that tells an outside outage from a fault in the app (the pass rules are the same either way).
  // A data service that did not answer is an outage; every other failure (including the two list checks in that group)
  // is a fault in the app or the test.
  const SERVICE_NAMES = new Set(SERVICES.map(([name]) => name));
  const isOutage = r => r.group === "Data services" && SERVICE_NAMES.has(r.name);
  const serviceFails = failed.filter(isOutage), appFails = failed.filter(r => !isOutage(r));
  const servicesDown = serviceFails.length ? `${serviceFails.length} data service(s) did not answer: ${serviceFails.map(r => r.name).join("; ")}` : "";
  const appStepsRan = results.some(r => r.group !== "Data services" && r.group !== "Test run");
  const headline = !failed.length ? "Every check passed."
    : !appFails.length ? (appStepsRan ? `Every app step passed; ${servicesDown}.` : `${servicesDown[0].toUpperCase()}${servicesDown.slice(1)}.`)
    : `${appFails.length} app step(s) failed${servicesDown ? `, and ${servicesDown}` : ""}.` +
      (appFails.some(r => /could not be reached|HTTP 5\d\d|net::ERR_/.test(r.info))
        ? " Some app steps name a data service that did not answer, so they may be an outage too: see the details." : "");
  const lines = [
    `# Property Location Check – automatic test`,
    ``,
    `Tested: ${BASE}  `,
    `Date: ${new Date().toUTCString()}  `,
    `Result: **${failed.length ? `${failed.length} problem(s) found` : "all checks passed"}** (${results.length - failed.length} of ${results.length} passed` +
      (warned.length ? `, ${warned.length} with a warning` : "") + `)  `,
    `In short: ${headline}`,
    ``
  ];
  if (failed.length) {
    lines.push(`## Problems`, ``, `| Area | Check | Details |`, `|---|---|---|`);
    failed.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
    lines.push(``);
  }
  if (warned.length) {
    lines.push(`## Warnings (do not fail the check)`, ``, `| Area | Check | Details |`, `|---|---|---|`);
    warned.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
    lines.push(``);
  }
  lines.push(`## All checks`, ``, `| Result | Area | Check | Details |`, `|---|---|---|---|`);
  results.forEach(r => lines.push(`| ${r.warn ? "⚠️" : r.pass ? "✅" : "❌"} | ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`));
  lines.push(``, `## Report results`, ``);
  Object.entries(reports).forEach(([name, topics]) => {
    lines.push(`**${name}**`, ``);
    (topics || []).forEach(t => lines.push(`- ${t.id}: ${t.status} – ${t.found}`));
    lines.push(``);
  });

  const summary = lines.join("\n");
  writeFileSync(`${OUT}/summary.md`, summary);
  // For the two GitHub issues the daily and manual runs keep (the workflow adds the run link, with every check):
  // "Live check failed" for app steps, "Data services down" for outside services that did not answer. Each closes
  // after a run in which its own part passed.
  const table = rows => [`| Area | Check | Details |`, `|---|---|---|`, ...rows.map(r => `| ${r.group} | ${r.name} | ${r.info.replace(/\|/g, "/")} |`)];
  const tested = [`Tested: ${BASE}  `, `Date: ${new Date().toUTCString()}`, ``];
  const serviceWarnings = warned.filter(r => r.group === "Data services");
  writeFileSync(`${OUT}/issues.json`, JSON.stringify({
    app: {
      checked: !PARTIAL, failed: appFails.length > 0,
      body: [`**In short:** ${headline}`, ``, ...tested, `## App steps that failed`, ``, ...table(appFails)].join("\n")
    },
    services: {
      checked: CHECK_DATA_SERVICES && !PARTIAL && !ONLY_SERVICES.length, failed: serviceFails.length > 0,
      body: [`**In short:** ${servicesDown ? servicesDown[0].toUpperCase() + servicesDown.slice(1) : "every data service answered"}.`, ``, ...tested,
        `## Data services that did not answer`, ``, ...table(serviceFails),
        ...(serviceWarnings.length ? [``, `## Warnings (do not fail the check)`, ``, ...table(serviceWarnings)] : []),
        ``, `Buyers see the same on the [data service status page](https://andyseremet.github.io/reports-examles/status.html) after the run publishes.`].join("\n")
    }
  }, null, 2));
  writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, date: new Date().toISOString(), results, reports }, null, 2));
  // For the data service status page: one row per outside service (published by the daily run only).
  writeFileSync(`${OUT}/status.json`, JSON.stringify({
    checked: new Date().toISOString(), base: BASE,
    services: SERVICES.map(([name]) => {
      const r = results.find(x => x.group === "Data services" && x.name === name);
      return { name, status: !r ? "fail" : r.warn ? "warn" : r.pass ? "ok" : "fail", detail: r ? r.info.slice(0, 200) : "not checked", topics: SERVICE_TOPICS[name] || [] };
    })
  }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed` + (warned.length ? ` (${warned.length} with a warning).` : "."));
  if (failed.length) console.log(`In short: ${headline}`);
  return failed.length;
}
