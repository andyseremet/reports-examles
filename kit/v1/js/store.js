// Property Location Check – saving in the browser (localStorage) and the key for a place. No page drawing, so the
// runner (js/runner.js) and other small apps can use it.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

// What to do when something could not be saved (the main app shows a bar: js/saved.js).
let storageProblem = () => {};
function onStorageProblem(fn) { storageProblem = fn; }

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  // quiet: for optional data (recent answers), a full or blocked storage fails silently instead of showing the bar.
  set(key, value, { quiet = false } = {}) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { if (!quiet) storageProblem(); return false; }   // storage full or blocked
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage blocked: nothing to remove */ }
  }
};

// One place and search distance, as a short key ("53.55260,-1.47900,1000").
function reportKey(loc) {
  return `${Number(loc.lat).toFixed(5)},${Number(loc.lon).toFixed(5)},${loc.radius}`;
}

export { onStorageProblem, reportKey, store };
