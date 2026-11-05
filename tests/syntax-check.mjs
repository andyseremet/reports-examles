// Syntax check for the app code: for each page (index.html, status.html), reads its <script src="js/..."> list
// and checks those files together in that order (they share one global scope, so a name declared twice is
// caught too), then sw.js.
// Run: node tests/syntax-check.mjs   (exit 1 and the error on failure)
import fs from "fs";
import { execFileSync } from "child_process";

const root = new URL("..", import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, "utf8");
const PAGES = ["index.html", "status.html"];
let total = 0, current = [];
try {
  for (const page of PAGES) {
    current = [...read(page).matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
    if (!current.length) throw new Error(`No js/ scripts found in ${page}`);
    new Function(current.map(read).join("\n;\n"));
    total += current.length;
  }
  execFileSync(process.execPath, ["--check", root + "sw.js"], { stdio: "pipe" });
} catch (e) {
  console.error((e.stderr ? e.stderr.toString() : e.message).trim());
  // Name the file with the problem: check each one on its own too.
  for (const f of current) { try { new Function(read(f)); } catch (err) { console.error(`  in ${f}: ${err.message}`); } }
  process.exit(1);
}
console.log(`Syntax OK: ${total} script files on ${PAGES.length} pages, and sw.js`);
