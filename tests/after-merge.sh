#!/usr/bin/env bash
# After the owner merges a pull request: restart the working branch from main. If the merge changed the app,
# wait until GitHub Pages serves the new version, then run the live check against the live site: every data
# service live, the report pages from the daily recording (no pauses needed), or all live if there is none yet.
# Run: bash tests/after-merge.sh   (needs Playwright, see CLAUDE.md "Full test")
set -u
cd "$(dirname "$0")/.."
URL=https://andyseremet.github.io/reports-examles
RECORDING=https://raw.githubusercontent.com/andyseremet/reports-examles/status/recordings.json
APP_FILES='^(index\.html|status\.html|glossary\.html|manifest\.webmanifest|sw\.js|css/|js/|data/|icons/)'
BRANCH=$(git rev-parse --abbrev-ref HEAD)

git fetch -q origin main && git checkout -q -B "$BRANCH" origin/main && git push -q -u origin "$BRANCH" \
  || { echo "Could not restart $BRANCH from origin/main"; exit 1; }
echo "Branch $BRANCH = $(git log --oneline -1)."
if ! git diff --name-only HEAD^1 HEAD | grep -qE "$APP_FILES"; then
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
OUT=$OUT QUIET=1 node tests/live-check.mjs > "$OUT/log.txt" 2>&1; code=$?
node tests/digest.mjs "$OUT/results.json" 2>/dev/null || tail -5 "$OUT/log.txt"
exit $code
