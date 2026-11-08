// Make a fixed copy of the kit for other apps (docs/KIT.md): kit/v<N>/ with js/kit.js and every file it imports, the
// fixed data files, and a glossary page that forwards to the site's glossary. Other apps load kit/v<N>/js/kit.js, so
// later changes to the app cannot break them. Files are copied as they are (no build step).
// Run: node tests/freeze-kit.mjs v1   (refuses to overwrite a version that exists: a fixed copy stays fixed; a fix
// for an outside service that changed its address is made by hand in that copy, and noted in docs/KIT.md)
import fs from "fs";
import path from "path";

const root = new URL("..", import.meta.url).pathname;
const version = process.argv[2] || "";
if (!/^v\d+$/.test(version)) { console.error("Give a version folder name, for example: node tests/freeze-kit.mjs v1"); process.exit(2); }
const out = path.join(root, "kit", version);
if (fs.existsSync(out)) { console.error(`kit/${version} exists already: a fixed copy is never overwritten.`); process.exit(1); }

// js/kit.js and every app file it imports, followed through their imports.
const files = ["js/kit.js"];
for (let i = 0; i < files.length; i++) {
  const text = fs.readFileSync(path.join(root, files[i]), "utf8");
  for (const m of text.matchAll(/^import [^;]*? from "(\.[^"]+)";/gm)) {
    const dep = path.posix.join(path.posix.dirname(files[i]), m[1]);
    if (!files.includes(dep)) files.push(dep);
  }
}
const data = fs.readdirSync(path.join(root, "data")).filter(f => f.endsWith(".json")).map(f => "data/" + f);
for (const f of [...files, ...data]) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
// Glossary links (term() in js/core.js) point next to the copy: forward them to the site's glossary.
fs.writeFileSync(path.join(out, "glossary.html"), `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>What the words mean – Property Location Check</title>
<meta http-equiv="refresh" content="0; url=../../glossary.html">
<script>location.replace("../../glossary.html" + location.hash);</script>
</head>
<body><p><a href="../../glossary.html">What the words mean</a></p></body>
</html>
`);
console.log(`kit/${version}: ${files.length} code files, ${data.length} data files and the glossary link.`);
