// Syntax check for the app code, without running it.
// - index.html: its modules (<script type="module" src="js/...">), and the kit (js/kit.js, kit/v<N>/js/kit.js).
//   Each must read as a module, and every name it imports must be exported by the file it names (Node's own module
//   linker, so no extra library).
// - status.html: its plain scripts, checked together in page order (they share one global scope).
// - sw.js.
// Run: node tests/syntax-check.mjs   (exit 1 and the error on failure)
import fs from "fs";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";

// Node's module linker needs a flag: run this file again with it.
const FLAG = "--experimental-vm-modules";
if (!process.execArgv.includes(FLAG)) {
  try {
    execFileSync(process.execPath, [FLAG, "--no-warnings", ...process.execArgv, process.argv[1]], { stdio: "inherit" });
  } catch (e) { process.exit(e.status || 1); }
  process.exit(0);
}

const root = new URL("..", import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, "utf8");
const scripts = (page, type) => [...read(page).matchAll(new RegExp(`<script ${type}src="(js/[^"]+)"`, "g"))].map(m => m[1]);

// What a topic or a file needs besides its own code, each with the line to add or remove (docs/CODE.md, "Adding a
// topic"). Checked before the modules are linked, so a missing piece is named plainly.
function wiringProblems() {
  const problems = [];
  // Every file the app loads, followed through the imports from the start file.
  const app = ["js/main.js"], importer = {};
  for (let i = 0; i < app.length; i++) {
    if (!fs.existsSync(root + app[i])) { problems.push(`${app[i]} does not exist, but ${importer[app[i]]} imports it: remove that import (or restore the file)`); continue; }
    for (const m of read(app[i]).matchAll(/^import (?:[^;]*? from )?"(\.[^"]+)";/gm)) {
      const dep = path.posix.join(path.posix.dirname(app[i]), m[1]);
      if (!app.includes(dep)) { app.push(dep); importer[dep] = app[i]; }
    }
  }
  const sw = read("sw.js");
  for (const f of app) if (fs.existsSync(root + f) && !sw.includes(`"./${f}"`)) problems.push(`add "./${f}", to SHELL in sw.js (so the app works offline)`);
  for (const m of sw.matchAll(/"\.\/((?:js|data)\/[^"]+)"/g)) if (!fs.existsSync(root + m[1])) problems.push(`remove "./${m[1]}" from SHELL in sw.js (the file no longer exists)`);
  // Each topic file: named after its topic, in the topic list, and its data service in the daily check.
  const list = read("js/topics/index.js"), services = read("tests/live/services.mjs");
  for (const f of fs.readdirSync(root + "js/topics").filter(f => f.endsWith(".js") && !["helpers.js", "index.js"].includes(f))) {
    const id = f.slice(0, -3), text = read("js/topics/" + f);
    const object = text.match(new RegExp(`const ${id}Topic = \\{[\\s\\S]*?\\bid: "([^"]+)"[\\s\\S]*?\\btitle: "([^"]+)"`));
    if (!object || object[1] !== id) { problems.push(`js/topics/${f}: its topic object must be "const ${id}Topic = {" with id: "${id}" (the file name is the topic's name)`); continue; }
    const imported = new RegExp(`^import \\{[^}]*\\b${id}Topic\\b[^}]*\\} from "\\./${id}\\.js";`, "m").test(list);
    const listed = new RegExp(`const CHECKS = \\[[^\\]]*\\b${id}Topic\\b`).test(list);
    if (!imported || !listed) problems.push(`js/topics/${f} is not in the topic list: in js/topics/index.js, add  import { ${id}Topic } from "./${id}.js";  and put ${id}Topic in CHECKS where it goes in the report (or delete the file if you are removing the topic)`);
    if (!services.includes(object[2].split(":")[0])) problems.push(`the topic "${object[2]}" (js/topics/${f}) is not named in SERVICE_TOPICS in tests/live/services.mjs: add its data service there and in SERVICES, and a row in data/data-services.csv`);
  }
  // Names the daily check reads from the page must still exist.
  const bridge = read("js/page-names.js");
  const from = Object.fromEntries([...bridge.matchAll(/^import \* as (\w+) from "\.\/([^"]+)";/gm)].map(m => [m[1], "js/" + m[2]]));
  for (const m of bridge.matchAll(/reach\((\w+), \[([^\]]*)\]\);/g)) {
    const file = from[m[1]];
    if (!file || !fs.existsSync(root + file)) { problems.push(`js/page-names.js reads from ${file || m[1]}, which does not exist: remove that line`); continue; }
    const offered = ((read(file).match(/\nexport \{([^}]*)\};\s*$/) || [])[1] || "").split(",").map(s => s.trim());
    for (const name of (m[2].match(/"[^"]+"/g) || []).map(s => s.slice(1, -1)))
      if (!offered.includes(name)) problems.push(`js/page-names.js lists "${name}" from ${file}, which no longer offers it: remove it there, and from any test that reads it`);
  }
  return problems;
}

let total = 0;
try {
  const wiring = wiringProblems();
  if (wiring.length) throw new Error("Not wired up yet:\n  - " + wiring.join("\n  - "));
  // Modules: read each file once, then link from every page tag (a missing export fails the link).
  const modules = new Map();
  const load = file => {
    if (!modules.has(file)) {
      if (!fs.existsSync(root + file)) throw new Error(`${file} is imported but does not exist`);
      try { modules.set(file, new vm.SourceTextModule(read(file), { identifier: file })); }
      catch (e) { throw new Error(`in ${file}: ${e.message}`); }
    }
    return modules.get(file);
  };
  const entries = scripts("index.html", 'type="module" ');
  if (!entries.length) throw new Error("No js/ modules found in index.html");
  // The kit other apps load (docs/KIT.md): the latest one, and each fixed copy in kit/v<N>/.
  entries.push("js/kit.js", ...(fs.existsSync(root + "kit") ? fs.readdirSync(root + "kit") : [])
    .filter(d => /^v\d+$/.test(d)).map(d => `kit/${d}/js/kit.js`));
  // One stand-in module for the page imports every tag, so the whole set links once.
  const page = new vm.SourceTextModule(entries.map(f => `import "./${f}";`).join("\n"), { identifier: "index.html" });
  await page.link((spec, from) => {
    if (!spec.startsWith(".")) throw new Error(`${from.identifier} imports "${spec}": app files import only other app files`);
    return load(path.posix.join(path.posix.dirname(from.identifier), spec));
  });
  total += modules.size;

  // The kit must load without a browser page too (docs/KIT.md: code can list the topics anywhere).
  for (const kit of entries.filter(f => f.endsWith("js/kit.js"))) {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e",
      `const k = await import(${JSON.stringify("file://" + root + kit)}); console.log(k.TOPICS.length);`], { stdio: "pipe" }).toString().trim();
    if (!(Number(out) > 0)) throw new Error(`${kit} loaded without a browser but listed no topics`);
  }

  // Plain scripts (status page).
  const plain = scripts("status.html", "");
  if (!plain.length) throw new Error("No js/ scripts found in status.html");
  try { new Function(plain.map(read).join("\n;\n")); }
  catch (e) { throw new Error(`status.html scripts (${plain.join(", ")}): ${e.message}`); }
  total += plain.length;

  execFileSync(process.execPath, ["--check", root + "sw.js"], { stdio: "pipe" });
} catch (e) {
  console.error((e.stderr ? e.stderr.toString() : e.message).trim());
  process.exit(1);
}
console.log(`Syntax OK: ${total} app files (modules on index.html, scripts on status.html), and sw.js`);
