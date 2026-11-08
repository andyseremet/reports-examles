// Property Location Check – the runner: runs the checks for one place, with no page drawing. It starts the data tasks,
// tries a failed one once more, shows a recent answer while waiting, stops waiting at 45 seconds, and turns the data
// into topic results. Whoever started the run (the main app: js/run.js, or other apps through js/kit.js) hears about
// each change through onUpdate.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { okValue, today } from "./core.js";
import { reportKey, store } from "./store.js";
import { CHECKS } from "./topics/index.js";
import { TASK_FN, TASKS } from "./tasks.js";
import { topicShown } from "./coverage.js";

/* =========================================================
   THE RUN – the main app's report, and runs from other apps (js/kit.js) beside it
   a run = { loc, R (data by task key), results (by topic id), checks, tasks, done, startedAt, previous, onUpdate,
   stopped (true once replaced: its late answers are ignored) }
========================================================= */

let run = null;                 // the main app's report being built
// Sets the report being built (a saved report, or the daily check through js/page-names.js). The run it replaces stops.
function setRun(value) {
  if (run && run !== value) run.stopped = true;
  if (value) value.stopped = false;
  run = value;
}
const isLive = r => !r.stopped;

// Start a run for a place. Options:
// - checks: the topics to run (all by default); only the data tasks they need are asked.
// - previous: this place's last saved results (a topic whose service does not answer shows its earlier answer, dated).
// - onUpdate({ key, changed, done }): after each data task settles. changed lists { check, result } for the topics
//   rebuilt (result null: the topic is not shown in this country); done: every task has settled.
// - main: true (the default) makes it the main app's report, replacing the one before; false runs it beside it.
function startRun(loc, { checks = CHECKS, previous = null, onUpdate = null, main = true } = {}) {
  const needed = new Set(checks.flatMap(c => c.deps));
  const tasks = TASKS.map(([key]) => key).filter(key => needed.has(key));
  const r = { loc, R: { loc }, results: {}, checks, tasks, done: false, startedAt: Date.now(), previous, onUpdate };
  if (main) setRun(r);
  // After 8 seconds: recent answers fill in, then an update with no task (unless they finished the report).
  setTimeout(() => { if (isLive(r) && !r.done) { showRecentWhileWaiting(r); if (!r.done) notify(r, null, []); } }, SLOW_NOTE_MS);
  setTimeout(() => { if (isLive(r) && !r.done) stopWaiting(r); }, REPORT_DEADLINE_MS);
  tasks.forEach(key => startTask(r, key));
  return r;
}

// The tasks and topics of a run (a run made elsewhere, such as a saved report or a test, may not list them).
const tasksOf = r => r.tasks || TASKS.map(([key]) => key);
const checksOf = r => r.checks || CHECKS;

const notify = (r, key, changed) => { if (r.onUpdate) r.onUpdate({ key, changed, done: r.done }); };

// After 8 seconds, a report still loading names the services it is waiting for: { service: [topic names] }.
const SLOW_NOTE_MS = 8000;
function waitingFor(r = run) {
  const waiting = {};
  TASKS.filter(([key]) => tasksOf(r).includes(key) && !r.R[key])
    .forEach(([, topic, , service]) => (waiting[service] ||= []).push(topic));
  return waiting;
}

// Faster reports in outages (2.3.1, quiz of 8 November 2026). After 8 seconds, a topic still waiting shows this place's
// answer from the last 7 days, if there is one, clearly dated ("waiting"), until the live answer replaces it.
function showRecentWhileWaiting(r) {
  tasksOf(r).forEach(key => {
    if (r.R[key]) return;
    const recent = recentAnswer(r.loc, key);
    if (!recent) return;
    r.R[key] = { ok: true, value: recent.value, cachedAt: recent.at, waiting: true };
    settleTask(r, key);
  });
}
// After 45 seconds the report finishes: a topic still waiting shows "slow to answer" with Try again. Its request
// carries on, and an answer that arrives later fills the topic in (startTask).
const REPORT_DEADLINE_MS = 45000;
function stopWaiting(r) {
  const late = tasksOf(r).filter(key => !r.R[key]);
  late.forEach(key => { r.R[key] = { ok: false, error: "the data service is slow to answer", slow: true }; });
  late.forEach(key => { if (isLive(r)) settleTask(r, key); });
}

// A topic whose data fails is tried once more by itself: after 8 seconds (20 if the service refused us, which
// often lasts minutes, so it is not asked again too soon), or as soon as the signal returns if the device went offline.
// Not when its request was already tried again (fetchJSON marks the error "retried"; 2.3.1): one layer of retries
// is enough, and two made a report wait a minute or more in an outage. If it fails again, the topic shows "Try again".
const AUTO_RETRY_MS = 8000, REFUSED_RETRY_MS = 20000;
const onlineAgain = () => navigator.onLine ? Promise.resolve()
  : new Promise(res => globalThis.addEventListener("online", res, { once: true }));

/* ---------- recent answers: each service's answer for a place, kept 7 days, used only if that service fails ---------- */
// Optional: if the device runs out of space, the oldest places are dropped quietly (no "storage full" message).
const RECENT_DAYS = 7, RECENT_PLACES = 10, RECENT_MAX_CHARS = 200000, RECENT_INDEX = "plc-recent-index";
const recentKey = key => "plc-recent:" + key;
function rememberAnswer(loc, task, value) {
  const k = recentKey(reportKey(loc));
  try {   // optional: an answer that cannot be saved never stops the topic from showing
    if (JSON.stringify(value === undefined ? null : value).length > RECENT_MAX_CHARS) return;
    const all = store.get(k, {});
    all[task] = { at: new Date().toISOString(), value };
    const index = [k, ...store.get(RECENT_INDEX, []).filter(x => x !== k)];
    index.slice(RECENT_PLACES).forEach(x => store.remove(x));
    store.set(RECENT_INDEX, index.slice(0, RECENT_PLACES), { quiet: true });
    store.set(k, all, { quiet: true });
  } catch (e) { /* not saved: the cache is optional */ }
}
function recentAnswer(loc, task) {
  const a = store.get(recentKey(reportKey(loc)), {})[task];
  return a && Date.now() - new Date(a.at).getTime() < RECENT_DAYS * 864e5 ? a : null;
}
const forgetAnswers = key => store.remove(recentKey(key));

function startTask(r, key, autoRetry = true) {
  // A saved answer shown while waiting stays until the retry settles (code review, 2.3.3).
  if (!r.R[key] || !r.R[key].waiting) delete r.R[key];
  TASK_FN[key](r.loc).then(
    value => { r.R[key] = { ok: true, value }; rememberAnswer(r.loc, key, value); },
    async error => {
      if (autoRetry && isLive(r) && (!navigator.onLine || !error.retried)) {
        if (navigator.onLine) await new Promise(res => setTimeout(res, error.refused ? REFUSED_RETRY_MS : AUTO_RETRY_MS));
        else await onlineAgain();
        if (isLive(r)) { r.autoRetried = [...(r.autoRetried || []), key]; startTask(r, key, false); }
        return "retrying";
      }
      // The service did not answer: use its answer from the last 7 days, if there is one (shown dated on the topic).
      const recent = recentAnswer(r.loc, key);
      r.R[key] = recent ? { ok: true, value: recent.value, cachedAt: recent.at }
        : { ok: false, error: error.message || "unknown error", ...(error.backup && { backup: error.backup }) };
    }
  ).then(state => { if (state !== "retrying" && isLive(r)) settleTask(r, key); });
}

const depsReady = (r, c) => c.deps.every(k => r.R[k]);

// A topic result with everything the report needs. Each check gives only what differs from these.
function topicResult(c, fields) {
  return { meaning: "", actions: [], seller: [], conveyancer: [], source: { name: "", url: "" }, ...fields, id: c.id, group: c.group, title: c.title };
}

function buildCheck(r, c) {
  const place = okValue(r.R, "place");
  const country = place && place.country;
  if (!topicShown(c.id, country)) return null;   // not covered in this country: left out (js/coverage.js)
  let result;
  try { result = topicResult(c, { dataDate: "Checked live on " + today(), ...c.build(r.R) }); }
  catch (e) { result = topicResult(c, { status: "error", found: "This check failed: " + e.message }); }
  // A service failed: show this place's saved earlier answer, dated, if there is one. A check that still answers
  // in part (for example other mining when the coal service is down) marks itself with failedService.
  if (result.status === "error" || result.failedService) return savedInstead(c, result, r);
  // Built partly from recent answers (a service did not answer): say so, with the oldest answer's date.
  const cached = c.deps.map(k => r.R[k] && r.R[k].cachedAt).filter(Boolean).sort()[0];
  const waiting = c.deps.some(k => r.R[k] && r.R[k].waiting);
  return cached ? { ...result, fromSaved: cached, ...(waiting && { waiting: true }) } : result;
}

// A service that does not answer: if this place was checked before, show that earlier answer, clearly dated,
// with "Try again" (an answer that was itself saved earlier keeps its first date).
function savedInstead(c, failed, r = run) {
  const prev = r.previous && r.previous.results.find(x => x.id === c.id && x.status !== "error");
  if (!prev) return failed;
  const from = prev.fromSaved || r.previous.savedAt;
  return { ...prev, fromSaved: from };
}

// A data task settled: rebuild the topics that now have all their data, then tell whoever started the run.
function settleTask(r, key) {
  const changed = [];
  checksOf(r).filter(c => c.deps.includes(key) && depsReady(r, c)).forEach(c => {
    const result = buildCheck(r, c);
    if (result) r.results[c.id] = result; else delete r.results[c.id];   // not shown in this country
    changed.push({ check: c, result });
  });
  if (tasksOf(r).every(k => r.R[k])) r.done = true;
  notify(r, key, changed);
}

// "Try again" on a topic that could not load: forget only the data it is missing (all its data if none is missing).
// Returns the topics cleared, to show as loading; then restartTasks(keys) asks again. Null for an unknown topic.
function clearForRetry(id, r = run) {
  const c = checksOf(r).find(x => x.id === id);
  if (!c) return null;
  let keys = c.deps.filter(k => !r.R[k] || !r.R[k].ok);
  if (!keys.length) keys = c.deps.slice();
  const cleared = [];
  keys.forEach(k => {
    delete r.R[k];
    checksOf(r).filter(x => x.deps.includes(k)).forEach(x => { delete r.results[x.id]; cleared.push(x); });
  });
  r.done = false;            // the report is being completed again
  return { keys, cleared };
}
const restartTasks = (keys, r = run) => keys.forEach(k => startTask(r, k, false));

// A run's results in report order (the main report's by default).
function orderedResults(r = run) {
  return CHECKS.map(c => r.results[c.id]).filter(Boolean);
}

export { clearForRetry, forgetAnswers, orderedResults, recentAnswer, rememberAnswer, restartTasks, run, savedInstead,
  setRun, SLOW_NOTE_MS, startRun, startTask, topicResult, waitingFor };
