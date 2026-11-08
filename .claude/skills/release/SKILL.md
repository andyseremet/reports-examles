---
name: release
description: Finish a release of Property Location Check. Raises APP_VERSION and the offline cache name together, updates README.md and ROADMAP.md, runs the syntax check and the full local test, then commits and pushes. Use when a change to index.html, css/, js/, sw.js or data/ is ready, or when the owner types /release.
argument-hint: "[new version, e.g. 1.14.0]"
---

# Release

Follow these steps in order. Stop and tell the owner if any step fails; never skip, remove or loosen a test.

## 1. Work out the new version

- Current values: `grep -n 'const APP_VERSION' js/core.js` and `grep -n 'const CACHE' sw.js`.
- Use the version given as an argument. With none, raise the middle number for a new topic or feature
  (1.13.0 → 1.14.0) and the last number for a fix only (1.13.0 → 1.13.1). Say which one you chose and why.
- The cache name always goes up by one (`plc-v11` → `plc-v12`), whatever the version.

## 2. Change the version in both places

- `js/core.js`: `const APP_VERSION = "<new>";` (and `APP_UPDATED`, today's date)
- `sw.js`: `const CACHE = "plc-v<N+1>";`

## 3. Update the documents in the same commit

- `ROADMAP.md`:
  - header: "Current version" and "Last updated" (today's date, written like "4 November 2026");
  - Part 1 heading: `(version <new>)`;
  - move the shipped items from Part 2 into the right Part 1 section, and remove their Part 2 section.
- `README.md`: add or change the rows for anything new (topics table, count of outside data services, testing text).
- A new topic also needs its row in `SERVICES` in `tests/live/services.mjs` (see "Adding a topic" in `docs/CODE.md`).

## 4. Check

1. Syntax check: `node tests/syntax-check.mjs`.
2. `grep -rn "<old version>\|plc-v<N>" index.html js sw.js README.md ROADMAP.md` should find nothing left over.
3. Test by type of change (owner, 8 November 2026; see "Which test to run" in `docs/TESTING.md`): serve with
   `python3 -m http.server 8080` in the background, then the full local test
   (`BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 REPLAY=daily node tests/live-check.mjs`) for a data source, topic or backup,
   or the pull-request-style test for wording, styles and layout. Report the pass count. An Environment Agency
   HTTP 403 "warn" is the only allowed non-pass; for any other failure, first ask the outside service whether the
   fault is theirs.

## 5. Commit and push

- One commit, message starting `Release <new>:` plus a one-line summary of what shipped.
- Push to the working branch. Open a pull request only if the owner asks; never merge it.
- Tell the owner in plain English: the new version, what shipped, and the test result.
