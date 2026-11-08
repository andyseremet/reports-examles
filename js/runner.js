// Property Location Check – the runner: runs the checks for one place, with no page drawing. It starts the data tasks,
// tries a failed one once more, shows a recent answer while waiting, stops waiting at 45 seconds, and turns the data
// into topic results. Whoever started the run (the main app: js/run.js) hears about each change through onUpdate.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { okValue, today } from "./core.js";
import { reportKey, store } from "./store.js";
import { TASKS } from "./tasks.js";
import { CHECKS, TASK_FN } from "./checks/index.js";
import { topicShown } from "./coverage.js";

/* =========================================================
   THE RUN – one place at a time
   run = { loc, R (data by task key), results (by topic id), checks, tasks, done, startedAt, previous, onUpdate }
========================================================= */

let run = null;                 // the report being built
// Sets the report being built (a saved report, or the daily check through js/page-names.js).
function setRun(value) { run = value; }

// Start a run for a place. Options:
// - checks: the topics to run (all by default); only the data tasks they need are asked.
// - previous: this place's last saved results (a topic whose service does not answer shows its earlier answer, dated).
// - onUpdate({ key, changed, done }): after each data task settles. changed lists { check, result } for the topics
//   rebuilt (result null: the topic is not shown in this country); done: every task has settled.
function startRun(loc, { checks = CHECKS, previous = null, onUpdate = null } = {}) {
  const needed = new Set(checks.flatMap(c => c.deps));
  const tasks = TASKS.map(([key]) => key).filter(key => needed.has(key));
  run = { loc, R: { loc }, results: {}, checks, tasks, done: false, startedAt: Date.now(), previous, onUpdate };
  const thisRun = run;
  // After 8 seconds: recent answers fill in, then an update with no task (unless they finished the report).
  setTimeout(() => { if (run === thisRun && !run.done) { showRecentWhileWaiting(thisRun); if (!run.done) notify(null, []); } }, SLOW_NOTE_MS);
  setTimeout(() => { if (run === thisRun && !run.done) stopWaiting(thisRun); }, REPORT_DEADLINE_MS);
  tasks.forEach(key => startTask(run, key));
  return run;
}

// The tasks and topics of a run (a run made elsewhere, such as a saved report or a test, may not list them).
const tasksOf = r => r.tasks || TASKS.map(([key]) => key);
const checksOf = r => r.checks || CHECKS;

const notify = (key, changed) => { if (run.onUpdate) run.onUpdate({ key, changed, done: run.done }); };

// After 8 seconds, a report still loading names the services it is waiting for: { service: [topic names] }.
const SLOW_NOTE_MS = 8000;
function waitingFor() {
  const waiting = {};
  TASKS.filter(([key]) => tasksOf(run).includes(key) && !run.R[key])
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
    settleTask(key);
  });
}
// After 45 seconds the report finishes: a topic still waiting shows "slow to answer" with Try again. Its request
// carries on, and an answer that arrives later fills the topic in (startTask).
const REPORT_DEADLINE_MS = 45000;
function stopWaiting(r) {
  const late = tasksOf(r).filter(key => !r.R[key]);
  late.forEach(key => { r.R[key] = { ok: false, error: "the data service is slow to answer", slow: true }; });
  late.forEach(key => { if (r === run) settleTask(key); });
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
      if (autoRetry && r === run && (!navigator.onLine || !error.retried)) {
        if (navigator.onLine) await new Promise(res => setTimeout(res, error.refused ? REFUSED_RETRY_MS : AUTO_RETRY_MS));
        else await onlineAgain();
        if (r === run) { r.autoRetried = [...(r.autoRetried || []), key]; startTask(r, key, false); }
        return "retrying";
      }
      // The service did not answer: use its answer from the last 7 days, if there is one (shown dated on the topic).
      const recent = recentAnswer(r.loc, key);
      r.R[key] = recent ? { ok: true, value: recent.value, cachedAt: recent.at }
        : { ok: false, error: error.message || "unknown error", ...(error.backup && { backup: error.backup }) };
    }
  ).then(state => { if (state !== "retrying" && r === run) settleTask(key); });
}

const depsReady = c => c.deps.every(k => run.R[k]);

// A topic result with everything the report needs. Each check gives only what differs from these.
function topicResult(c, fields) {
  return { meaning: "", actions: [], seller: [], conveyancer: [], source: { name: "", url: "" }, ...fields, id: c.id, group: c.group, title: c.title };
}

function buildCheck(c) {
  const place = okValue(run.R, "place");
  const country = place && place.country;
  if (!topicShown(c.id, country)) return null;   // not covered in this country: left out (js/coverage.js)
  let result;
  try { result = topicResult(c, { dataDate: "Checked live on " + today(), ...c.build(run.R) }); }
  catch (e) { result = topicResult(c, { status: "error", found: "This check failed: " + e.message }); }
  // A service failed: show this place's saved earlier answer, dated, if there is one. A check that still answers
  // in part (for example other mining when the coal service is down) marks itself with failedService.
  if (result.status === "error" || result.failedService) return savedInstead(c, result);
  // Built partly from recent answers (a service did not answer): say so, with the oldest answer's date.
  const cached = c.deps.map(k => run.R[k] && run.R[k].cachedAt).filter(Boolean).sort()[0];
  const waiting = c.deps.some(k => run.R[k] && run.R[k].waiting);
  return cached ? { ...result, fromSaved: cached, ...(waiting && { waiting: true }) } : result;
}

// A service that does not answer: if this place was checked before, show that earlier answer, clearly dated,
// with "Try again" (an answer that was itself saved earlier keeps its first date).
function savedInstead(c, failed) {
  const prev = run.previous && run.previous.results.find(r => r.id === c.id && r.status !== "error");
  if (!prev) return failed;
  const from = prev.fromSaved || run.previous.savedAt;
  return { ...prev, fromSaved: from };
}

// A data task settled: rebuild the topics that now have all their data, then tell whoever started the run.
function settleTask(key) {
  const changed = [];
  checksOf(run).filter(c => c.deps.includes(key) && depsReady(c)).forEach(c => {
    const result = buildCheck(c);
    if (result) run.results[c.id] = result; else delete run.results[c.id];   // not shown in this country
    changed.push({ check: c, result });
  });
  if (tasksOf(run).every(k => run.R[k])) run.done = true;
  notify(key, changed);
}

// "Try again" on a topic that could not load: forget only the data it is missing (all its data if none is missing).
// Returns the topics cleared, to show as loading; then restartTasks(keys) asks again. Null for an unknown topic.
function clearForRetry(id) {
  const c = checksOf(run).find(x => x.id === id);
  if (!c) return null;
  let keys = c.deps.filter(k => !run.R[k] || !run.R[k].ok);
  if (!keys.length) keys = c.deps.slice();
  const cleared = [];
  keys.forEach(k => {
    delete run.R[k];
    checksOf(run).filter(x => x.deps.includes(k)).forEach(x => { delete run.results[x.id]; cleared.push(x); });
  });
  run.done = false;            // the report is being completed again
  return { keys, cleared };
}
const restartTasks = keys => keys.forEach(k => startTask(run, k, false));

// The run's results in report order.
function orderedResults() {
  return CHECKS.map(c => run.results[c.id]).filter(Boolean);
}

export { clearForRetry, forgetAnswers, orderedResults, recentAnswer, rememberAnswer, restartTasks, run, savedInstead,
  setRun, SLOW_NOTE_MS, startRun, startTask, topicResult, waitingFor };
