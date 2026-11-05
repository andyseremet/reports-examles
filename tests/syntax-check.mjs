// Syntax check for the app code: reads the <script src="js/..."> list from index.html, checks the files
// together in that order (they share one global scope, so a name declared twice is caught too), then sw.js.
// Run: node tests/syntax-check.mjs   (exit 1 and the error on failure)
import fs from "fs";
import { execFileSync } from "child_process";

const root = new URL("..", import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, "utf8");
const files = [...read("index.html").matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
if (!files.length) { console.error("No js/ scripts found in index.html"); process.exit(1); }
try {
  new Function(files.map(read).join("\n;\n"));
  execFileSync(process.execPath, ["--check", root + "sw.js"], { stdio: "pipe" });
} catch (e) {
  console.error((e.stderr ? e.stderr.toString() : e.message).trim());
  // Name the file with the problem: check each one on its own too.
  for (const f of files) { try { new Function(read(f)); } catch (err) { console.error(`  in ${f}: ${err.message}`); } }
  process.exit(1);
}
console.log(`Syntax OK: ${files.length} app files and sw.js`);
