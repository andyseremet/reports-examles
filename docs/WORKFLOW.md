# Working with the owner

How to plan, commit, open pull requests and finish after a merge. Read this before larger work and before any pull
request.

## Planning and decisions

- **Plan first for larger work:** before a new topic, a new version, or a change across several files, give a short
  plan and ask quiz-style questions (with a recommended answer). Small fixes need no quiz.
- **Small decisions follow the recommendation** (owner, 7 November 2026): for small choices inside an agreed plan
  (wording, a rating detail, which file to change), take the recommended option without a quiz and say what was chosen.
  Still ask for new topics, new outside services, changes to ratings or tests, and anything that sends extra requests.
- **Steady changes:** improve in small steps; ask before a redesign, a new library or a build step. English only.
- **Free for everyone:** every feature stays free. Never add a paywall, forced payment, adverts or accounts. Support
  for the app's development is always voluntary, and only ever as a separate optional module that the app reaches
  through hooks, so the app works the same without it (see `MONETISATION.md`).

## Commits and pull requests

- **Small commits:** one change per commit, with a clear message.
- **Pull requests:** open one only when asked, and never merge or approve; the owner merges. Watch it
  (`subscribe_pr_activity` plus one 50-minute safety check-in).
- **Code reviews:** `/code-review` and any review of a pull request follow `REVIEW.md`: what counts as Important, at
  most five Nits, what not to report and what to always check. When a rule in `CLAUDE.md` or `docs/` changes (a
  rating rule, a file to keep in step, a paced host), update `REVIEW.md` in the same commit.
- **Default branch stays `main`:** scheduled runs use the default branch, and the status page publishes only from `main`.

## After every merge

Cancel the check-in, run `tests/after-merge.sh` (see `docs/TESTING.md`) and report the pass count in plain English.
If Pages has not published within about 10 minutes (no new "pages build and deployment" run), ask the owner to press
Save in Settings → Pages.
