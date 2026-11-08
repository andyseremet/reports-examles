// The results list, and how each test step is run, timed and recorded.
import { QUIET, ON_GITHUB, stepChosen } from "./settings.mjs";

// pass: true, false, or "warn". A warning is shown in the summary but does not fail the run.
export const results = [];
export const annotation = text => String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
export const record = (group, name, pass, info = "", ms) => {
  results.push({ group, name, pass: pass === "warn" ? true : pass, warn: pass === "warn", info: String(info).slice(0, 900), ...(ms !== undefined && { ms }) });
  const label = pass === "warn" ? "WARN" : pass ? "PASS" : "FAIL";
  if (!QUIET || label !== "PASS") console.log(`${label}  [${group}] ${name}${info ? "  – " + String(info).slice(0, 160) : ""}`);
  if (ON_GITHUB && label !== "PASS")
    console.log(`::${label === "FAIL" ? "error" : "warning"} title=${annotation(`[${group}] ${name}`).replace(/[,:]/g, " ")}::${annotation(String(info).slice(0, 300))}`);
};
// Runs one test step and records its result and how long it took (tests/digest.mjs lists the slowest).
// A step returns its details (a string), false for a plain failure, or { warn } for an allowed warning.
export const timedStep = group => async (name, fn) => {
  if (!stepChosen(name)) return;   // left out by STEP
  const t0 = Date.now(), ms = () => Date.now() - t0;
  try {
    const info = await fn();
    if (info && info.warn) record(group, name, "warn", info.warn, ms());
    else record(group, name, info !== false, info === false ? "" : info || "", ms());
  } catch (e) { record(group, name, false, e.message.split("\n")[0], ms()); }
};
