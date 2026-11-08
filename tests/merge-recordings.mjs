// Builds the recorded answers that pull request checks replay (see RECORD/REPLAY in tests/live-check.mjs).
// Run by the daily live check, after tests/live-check.mjs:
//   node tests/merge-recordings.mjs <today's test-results/recordings.json> <previous recordings.json or "none"> <output file>
// Today's answers replace older ones. An answer not asked today is kept for up to 14 days, so a service that is down
// on the day of the check keeps its last working answer instead of losing it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const KEEP_DAYS = 14;
const [todayFile, previousFile, outFile] = process.argv.slice(2);
if (!todayFile || !outFile) { console.error("usage: merge-recordings.mjs today.json previous.json|none out.json"); process.exit(1); }

const today = JSON.parse(readFileSync(todayFile, "utf8"));
let previous = { answers: {} };
if (previousFile && previousFile !== "none" && existsSync(previousFile)) {
  try { previous = JSON.parse(readFileSync(previousFile, "utf8")); } catch (e) { console.warn("previous recordings unreadable, starting afresh"); }
}

const oldest = Date.parse(today.recorded) - KEEP_DAYS * 864e5;
const kept = Object.fromEntries(Object.entries(previous.answers || {}).filter(([, a]) => Date.parse(a.at) >= oldest));
const answers = { ...kept, ...today.answers };
writeFileSync(outFile, JSON.stringify({ ...today, answers }) + "\n");
const carried = Object.keys(answers).length - Object.keys(today.answers).length;
console.log(`recordings for ${today.recorded.slice(0, 10)}: ${Object.keys(today.answers).length} answers today, ${carried} kept from earlier days`);
