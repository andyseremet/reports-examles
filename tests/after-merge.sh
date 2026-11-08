#!/usr/bin/env bash
# After the owner merges a pull request: restart the working branch from main. If the merge changed the app,
# wait until GitHub Pages serves the new version, then run a quick live check against the live site (QUICK=1, owner,
# 8 November 2026): every data service, and every desktop step with one full report, from the daily recording (or
# all live after a pause if there is no recording yet). The pull request check already ran every step on the same
# code, and the daily run still does.
# Run: bash tests/after-merge.sh   (needs Playwright, see CLAUDE.md "Full test")
set -u
cd "$(dirname "$0")/.."
URL=https://andyseremet.github.io/reports-examles
RECORDING=https://raw.githubusercontent.com/andyseremet/reports-examles/status/recordings.json
# The files whose change raises APP_VERSION and CACHE (CLAUDE.md "Releases"): only then is there a new version to test.
APP_FILES='^(index\.html|status\.html|glossary\.html|sw\.js|css/|js/|data/|kit/)'
BRANCH=$(git rev-parse --abbrev-ref HEAD)

[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Uncommitted changes on $BRANCH: commit or remove them first."; exit 1; }
git fetch -q origin main || { echo "Could not fetch origin/main"; exit 1; }
# Where main was before this branch was merged: the diff from there covers everything merged since. After a merge
# commit the branch's last commit is itself on main, so start from just before the first main commit that holds it.
OLD=$(git rev-parse HEAD)
FROM=$(git merge-base "$OLD" origin/main)
if [ "$FROM" = "$OLD" ]; then
  M=""
  for c in $(git rev-list --first-parent -n 100 origin/main); do git merge-base --is-ancestor "$OLD" "$c" || break; M=$c; done
  [ -n "$M" ] && [ "$M" != "$OLD" ] && FROM="$M^1"
fi
git checkout -q -B "$BRANCH" origin/main && git push -q -u origin "$BRANCH" \
  || { echo "Could not restart $BRANCH from origin/main"; exit 1; }
echo "Branch $BRANCH = $(git log --oneline -1)."
if ! git diff --name-only "$FROM" HEAD | grep -qE "$APP_FILES"; then
  echo "The merge changed no app files: no live check needed."; exit 0
fi

VERSION=$(grep -o 'APP_VERSION = "[0-9.]*"' js/core.js | grep -o '[0-9.]*[0-9]')
CACHE=$(grep -o 'plc-v[0-9]*' sw.js | head -1)
echo "Waiting for the live site to serve $VERSION / $CACHE ..."
for i in $(seq 1 90); do   # up to 15 minutes
  live_v=$(curl -sS "$URL/js/core.js?nocache=$RANDOM" | grep -o 'APP_VERSION = "[0-9.]*"')
  live_c=$(curl -sS "$URL/sw.js?nocache=$RANDOM" | grep -o 'plc-v[0-9]*' | head -1)
  if [[ "$live_v" == *"\"$VERSION\""* && "$live_c" == "$CACHE" ]]; then echo "Live: $VERSION / $CACHE"; break; fi
  if [ "$i" = 90 ]; then
    echo "NOT LIVE after 15 minutes (site serves ${live_v:-nothing} / ${live_c:-nothing})."
    echo "GitHub Pages may have missed the publish: ask the owner to press Save in Settings > Pages."
    exit 2
  fi
  sleep 10
done

[ "$(curl -s -o /dev/null -w '%{http_code}' "$RECORDING")" = 200 ] && export REPLAY=$RECORDING \
  || echo "No daily recording yet: the report pages ask every service live (with pauses)."
OUT=$(mktemp -d)
OUT=$OUT QUIET=1 QUICK=1 node tests/live-check.mjs > "$OUT/log.txt" 2>&1; code=$?
node tests/digest.mjs "$OUT/results.json" 2>/dev/null || tail -5 "$OUT/log.txt"
# Tell an outage from an app fault: ask each failed data service again, once, 30 seconds later (the result above stands).
FAILED=$(node -e 'console.log(require(process.argv[1]).results.filter(r => r.group === "Data services" && !r.pass).map(r => r.name).join("|"))' "$OUT/results.json" 2>/dev/null)
if [ -n "$FAILED" ]; then
  sleep 30
  echo "Failed data services, asked again 30 seconds later:"
  ONLY_SERVICES="$FAILED" OUT="$OUT/again" node tests/live-check.mjs 2>/dev/null \
    | sed -n 's/^PASS  \[Data services\] \(.*\)  – .*/  answers now: \1/p; s/^FAIL  \[Data services\] \(.*\)  – \(.*\)/  still down: \1 (\2)/p'
fi
exit $code
