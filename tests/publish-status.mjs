// Builds the file read by the data service status page (status.html).
// Run by the daily live check, after tests/live-check.mjs:
//   node tests/publish-status.mjs <today's test-results/status.json> <previous status.json or "none"> <output file>
// Keeps today's full results, plus one result per service per day for the last 7 calendar days
// (a day with no check is simply missing).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [todayFile, previousFile, outFile] = process.argv.slice(2);
if (!todayFile || !outFile) { console.error("usage: publish-status.mjs today.json previous.json|none out.json"); process.exit(1); }

const today = JSON.parse(readFileSync(todayFile, "utf8"));
let previous = { history: [] };
if (previousFile && previousFile !== "none" && existsSync(previousFile)) {
  try { previous = JSON.parse(readFileSync(previousFile, "utf8")); } catch (e) { console.warn("previous status unreadable, starting a new history"); }
}

const day = today.checked.slice(0, 10);
const entry = { date: day, services: Object.fromEntries(today.services.map(s => [s.name, s.status])) };
const oldest = new Date(Date.parse(day) - 6 * 864e5).toISOString().slice(0, 10);
const history = [...(previous.history || []).filter(h => h.date !== day && h.date >= oldest), entry]
  .sort((a, b) => a.date.localeCompare(b.date));

writeFileSync(outFile, JSON.stringify({ ...today, history }, null, 2) + "\n");
console.log(`status for ${day}: ${today.services.filter(s => s.status === "ok").length} of ${today.services.length} working; ${history.length} day(s) of history`);
