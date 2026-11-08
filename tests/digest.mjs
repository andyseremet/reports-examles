// A few lines about a live check run: the failures and warnings, the slowest steps and the total.
// Run: node tests/digest.mjs [test-results/results.json] [how many slow steps, default 5]
import { readFileSync } from "fs";

const [file = "test-results/results.json", top = 5] = process.argv.slice(2);
const { results } = JSON.parse(readFileSync(file, "utf8"));
const line = r => `[${r.group}] ${r.name}${r.info ? " – " + r.info.slice(0, 160) : ""}`;

results.filter(r => !r.pass || r.warn).forEach(r => console.log(`${r.pass ? "WARN" : "FAIL"}  ${line(r)}`));
const timed = results.filter(r => r.ms !== undefined).sort((a, b) => b.ms - a.ms);
const total = timed.reduce((sum, r) => sum + r.ms, 0);
console.log(`Slowest steps (of ${timed.length}, ${Math.round(total / 1000)} s in all):`);
timed.slice(0, Number(top)).forEach(r => console.log(`  ${(r.ms / 1000).toFixed(1)} s  [${r.group}] ${r.name}`));
console.log(`${results.filter(r => r.pass).length} of ${results.length} checks passed.`);
