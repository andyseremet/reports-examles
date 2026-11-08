# CLAUDE.md

Property Location Check: a free report on a home's location in England, Wales, Scotland and Northern Ireland, from
official open data, for non-technical home buyers. A static site of plain files with **no build step**. GitHub Pages
serves `main` at https://andyseremet.github.io/reports-examles/.

## Read before you start

| Before you… | Read |
|---|---|
| change code (`js/` modules, `index.html`, `sw.js`, `data/`) or add a topic | `docs/CODE.md` |
| change anything the user sees: layout, colours, wording, buttons | `docs/DESIGN.md` |
| run tests, read a failed check, or change `tests/` or the workflow | `docs/TESTING.md` |
| plan larger work, open or watch a pull request, or finish a merge | `docs/WORKFLOW.md` |
| change the kit for other apps (`js/kit.js`, `js/card.js`, `kit/`) | `docs/KIT.md` (For maintainers) |
| review code (`/code-review` or a pull request) | `REVIEW.md` |
| release a new version | `/release` (`.claude/skills/release/SKILL.md`) |

`README.md` explains the app and its files; `ROADMAP.md` lists what shipped and what is planned.

## Commands

- Serve locally: `python3 -m http.server 8080` (the app needs http, not `file://`).
- Syntax check: `node tests/syntax-check.mjs`. A hook runs it after every edit to `index.html` or a `.js` file; fix
  any error before going on.
- Full test: install Playwright as in `docs/TESTING.md`, then `BASE=http://localhost:8080/ PAUSE_MS=0 QUIET=1 REPLAY=daily node tests/live-check.mjs`
  (under a minute with the daily recording).
  Which test a change needs is in `docs/TESTING.md` ("Which test to run"). Do not edit files while a test runs.
- After a merge: `bash tests/after-merge.sh`, in the background.

## Rules that always apply

- **Plain English:** short sentences; technical words through `term()`; rate topics only with the five labels in
  `STATUS_LABEL`.
- **Missing data is never good news:** a source that published nothing is rated `"manual"` (Check yourself), never
  `"low"` (No issue found).
- **Outside data stays live.** A copy in `data/` only for a finished official dataset, and only with the owner's
  agreement.
- **Environment Agency map server** (`environment.data.gov.uk/spatialdata`): add no requests, and keep its pacing in
  `PACED_HOSTS`. Backups use Defra's copies on ArcGIS Online instead.
- **Releases:** any change to `index.html`, `status.html`, `glossary.html`, `css/`, `js/`, `sw.js` or `data/` raises
  `APP_VERSION` and `CACHE` together, with `README.md` and `ROADMAP.md` in the same commit.
- **Tests:** never skip, remove or loosen a step to get a pass. The only allowed non-pass is a warn for the
  Environment Agency map server refusing GitHub with HTTP 403. Test parts that run at the same time must never both
  ask OpenStreetMap's Nominatim at once (it allows one request a second): every live request to it waits its turn in
  `nominatimTurn()`.
- **Free for everyone:** no paywall, adverts or accounts (`MONETISATION.md`).
- **New features paused** (owner, 8 November 2026): improve existing topics and features only; add no new topic or
  feature until the owner says otherwise (`ROADMAP.md`, Part 2). The modular plan (topics usable on their own, five
  steps) is agreed as an improvement.
- **Kit copies stay fixed:** `kit/v<N>/` is what other apps load; never change it, except to follow an outside
  service that moved (`docs/KIT.md`).
- **The owner decides:** plan and quiz before larger work; small choices follow the recommendation. Ask before a new
  library, outside service, redesign or build step. Open a pull request only when asked; never merge or approve.

## Keeping these files current

- The rules above are the short form; the detail lives in the file named in the table. Change both together, and
  `REVIEW.md` too when the rule is one it checks.
- At the end of a task, suggest any instruction the owner repeated as a new rule in the right file.
