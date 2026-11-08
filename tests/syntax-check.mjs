// Syntax check for the app code, without running it.
// - index.html: its modules (<script type="module" src="js/...">), and the kit (js/kit.js, kit/v<N>/js/kit.js).
//   Each must read as a module, and every name it imports must be exported by the file it names (Node's own module
//   linker, so no extra library).
// - Then what a topic or a file still needs, each with the line to add or remove (docs/CODE.md, "Adding a topic"),
//   read from what the linker actually loaded: every file the app loads is in SHELL (sw.js); every topic file is in
//   the topic list, named after its id, with its data in TASK_ORDER and its data service in the daily check
//   (SERVICE_TOPICS, SERVICES, data/data-services.csv); every name js/page-names.js reads still exists.
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
// The text of `const NAME = <open> … <close>` in a file (a list or object written in the code).
const block = (text, start, close) => { const i = text.indexOf(start); return i < 0 ? "" : text.slice(i, text.indexOf(close, i)); };

// Modules: each file read once; link() fails on a file that is missing or does not read, or a missing export.
const modules = new Map();
function load(file, from) {
  if (!modules.has(file)) {
    if (!fs.existsSync(root + file)) throw new Error(from === "index.html"
      ? `${file} is listed in index.html but does not exist: remove its line there (or restore the file)`
      : `${file} does not exist, but ${from} imports it: remove that import (or restore the file)`);
    try { modules.set(file, new vm.SourceTextModule(read(file), { identifier: file })); }
    catch (e) { throw new Error(`in ${file}: ${e.message}`); }
  }
  return modules.get(file);
}
// One stand-in module imports every entry, so the whole set links at once.
async function linkAll(entries, id) {
  const page = new vm.SourceTextModule(entries.map(f => `import "./${f}";`).join("\n"), { identifier: id });
  await page.link((spec, from) => {
    if (!spec.startsWith(".")) throw new Error(`${from.identifier} imports "${spec}": app files import only other app files`);
    return load(path.posix.join(path.posix.dirname(from.identifier), spec), from.identifier);
  });
}
const offers = file => Reflect.ownKeys(modules.get(file).namespace).filter(k => typeof k === "string");   // its exports

// What the app and its topics still need (see the header). appFiles: every file index.html loads, as linked.
function wiringProblems(appFiles) {
  const problems = [];
  // Offline: every file the app loads is in SHELL, and every file SHELL names exists.
  const shell = [...block(read("sw.js"), "const SHELL = [", "];").matchAll(/"([^"]+)"/g)].map(m => m[1]);
  for (const f of appFiles) if (!shell.includes("./" + f)) problems.push(`add "./${f}", to SHELL in sw.js (so the app works offline)`);
  for (const s of shell) if (s.startsWith("./") && s !== "./" && !fs.existsSync(root + s.slice(2))) problems.push(`remove "${s}" from SHELL in sw.js (the file no longer exists)`);
  // Topics: named after their id, in the topic list, their data in TASK_ORDER, their data service in the daily check.
  const list = read("js/topics/index.js"), listMod = modules.get("js/topics/index.js");
  const taskOrder = block(read("js/tasks.js"), "const TASK_ORDER = [", "];");
  const services = read("tests/live/services.mjs"), csv = read("data/data-services.csv");
  const serviceTopics = [...block(services, "export const SERVICE_TOPICS = {", "\n};").matchAll(/^  "([^"]+)": \[(.*)\],?$/gm)]
    .map(m => ({ name: m[1], topics: [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]) }));
  for (const f of fs.readdirSync(root + "js/topics").filter(f => f.endsWith(".js") && !["helpers.js", "index.js"].includes(f))) {
    const id = f.slice(0, -3), text = read("js/topics/" + f);
    const object = block(text, `const ${id}Topic = {`, "\n};");
    const objId = (object.match(/\bid: "([^"]+)"/) || [])[1], title = (object.match(/\btitle: "([^"]+)"/) || [])[1];
    if (!object || objId !== id || !title) { problems.push(`js/topics/${f}: its topic object must be "const ${id}Topic = {" with id: "${id}" and a title (the file name is the topic's name)`); continue; }
    if (!listMod || !listMod.dependencySpecifiers.includes(`./${id}.js`) || !new RegExp(`const CHECKS = \\[[^\\]]*\\b${id}Topic\\b`).test(list))
      problems.push(`js/topics/${f} is not in the topic list: in js/topics/index.js, add  import { ${id}Topic } from "./${id}.js";  and put ${id}Topic in CHECKS where it goes in the report (or delete the file if you are removing the topic)`);
    const dataKeys = [...(block(object, "data: {", "\n  }").matchAll(/^    (\w+): \[/gm))].map(m => m[1]);
    for (const key of dataKeys) if (!taskOrder.includes(`"${key}"`))
      problems.push(`add "${key}" (js/topics/${f}) to TASK_ORDER in js/tasks.js, where it should start (the Environment Agency map server answers only a few requests at a time, so its most important data goes first)`);
    // A SERVICE_TOPICS entry names the topic by its title, or by the part before a colon, optionally followed by
    // ", for homes in …" or " (…)": for example "Past use of the land" or "Noise, for homes in Wales".
    const short = title.split(":")[0];
    const names = t => t === title || t === short || [", ", " ("].some(sep => t.startsWith(short + sep));
    const found = serviceTopics.filter(s => s.topics.some(names));
    if (!found.length) { problems.push(`the topic "${title}" (js/topics/${f}) is not named in SERVICE_TOPICS in tests/live/services.mjs: add its data service there and in SERVICES, and a row in data/data-services.csv`); continue; }
    for (const s of found) {
      const row = services.split("\n").find(l => l.startsWith(`  [${JSON.stringify(s.name)},`));
      if (!row) problems.push(`"${s.name}" (SERVICE_TOPICS, for ${title}) has no row in SERVICES in tests/live/services.mjs: add one`);
      else if (!/alwaysChecked/.test(row) && !/saved with the app/.test(s.name) && !csv.includes(`"${s.name}"`))
        problems.push(`"${s.name}" (for ${title}) has no row in data/data-services.csv: add one, with its address as in SERVICES`);
    }
  }
  // Names the daily check reads from the page (js/page-names.js) must still be offered by their files.
  const bridge = read("js/page-names.js");
  const from = Object.fromEntries([...bridge.matchAll(/^import \* as (\w+) from "\.\/([^"]+)";/gm)].map(m => [m[1], "js/" + m[2]]));
  const needs = [...bridge.matchAll(/reach\((\w+), \[([^\]]*)\]\);/g)].flatMap(m => (m[2].match(/"[^"]+"/g) || []).map(n => [m[1], n.slice(1, -1)]));
  const run = bridge.match(/get: \(\) => (\w+)\.run, set: value => (\w+)\.setRun\(value\)/);
  if (!run) problems.push(`js/page-names.js must define "run" as  get: () => <file>.run, set: value => <file>.setRun(value)  (some test steps set it)`);
  else needs.push([run[1], "run"], [run[2], "setRun"]);
  for (const [alias, name] of needs) {
    const file = from[alias];
    if (!file || !modules.has(file)) problems.push(`js/page-names.js reads "${name}" from ${file || alias}, which the app does not load: remove it there, and from any test that reads it`);
    else if (!offers(file).includes(name)) problems.push(["run", "setRun"].includes(name)
      ? `js/page-names.js sets "run" through ${file}'s "${name}", which it no longer offers: update that line to the new name (some test steps set run)`
      : `js/page-names.js lists "${name}" from ${file}, which no longer offers it: remove it there, and from any test that reads it`);
  }
  return problems;
}

let total = 0;
try {
  const entries = scripts("index.html", 'type="module" ');
  if (!entries.length) throw new Error("No js/ modules found in index.html");
  await linkAll(entries, "index.html");
  const appFiles = [...modules.keys()];
  // The kit other apps load (docs/KIT.md): the latest one, and each fixed copy in kit/v<N>/.
  const kits = ["js/kit.js", ...(fs.existsSync(root + "kit") ? fs.readdirSync(root + "kit") : [])
    .filter(d => /^v\d+$/.test(d)).map(d => `kit/${d}/js/kit.js`)];
  await linkAll(kits, "the kit");
  total += modules.size;

  const wiring = wiringProblems(appFiles);
  if (wiring.length) throw new Error("Not wired up yet:\n  - " + wiring.join("\n  - "));

  // The kit must load without a browser page too (docs/KIT.md: code can list the topics anywhere).
  for (const kit of kits) {
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
console.log(`Syntax OK: ${total} app files (modules on index.html and the kit, scripts on status.html), and sw.js`);
