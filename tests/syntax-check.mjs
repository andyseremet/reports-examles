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

let total = 0;
try {
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
