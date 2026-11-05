#!/usr/bin/env bash
# After the owner merges a pull request: restart the working branch from main, wait until GitHub Pages
# serves the new version, then run the full live check against the live site.
# Run: bash tests/after-merge.sh   (needs Playwright, see CLAUDE.md "Full test")
set -u
cd "$(dirname "$0")/.."
URL=https://andyseremet.github.io/reports-examles
BRANCH=$(git rev-parse --abbrev-ref HEAD)

git fetch -q origin main && git checkout -q -B "$BRANCH" origin/main && git push -q -u origin "$BRANCH" \
  || { echo "Could not restart $BRANCH from origin/main"; exit 1; }
VERSION=$(grep -o 'APP_VERSION = "[0-9.]*"' js/core.js | grep -o '[0-9.]*[0-9]')
CACHE=$(grep -o 'plc-v[0-9]*' sw.js | head -1)
echo "Branch $BRANCH = $(git log --oneline -1). Waiting for the live site to serve $VERSION / $CACHE ..."

for i in $(seq 1 45); do   # up to 15 minutes
  live_v=$(curl -sS "$URL/js/core.js?nocache=$RANDOM" | grep -o 'APP_VERSION = "[0-9.]*"')
  live_c=$(curl -sS "$URL/sw.js?nocache=$RANDOM" | grep -o 'plc-v[0-9]*' | head -1)
  if [[ "$live_v" == *"\"$VERSION\""* && "$live_c" == "$CACHE" ]]; then
    echo "Live: $VERSION / $CACHE"; break
  fi
  if [ "$i" = 45 ]; then
    echo "NOT LIVE after 15 minutes (site serves ${live_v:-nothing} / ${live_c:-nothing})."
    echo "GitHub Pages may have missed the publish: ask the owner to press Save in Settings > Pages."
    exit 2
  fi
  sleep 20
done

LOG=$(mktemp)
node tests/live-check.mjs > "$LOG" 2>&1; code=$?
grep -E "^(FAIL|WARN)" "$LOG"; tail -1 "$LOG"
echo "Status page file: $(curl -sS -o /dev/null -w '%{http_code}' https://raw.githubusercontent.com/andyseremet/reports-examles/status/status.json) (404 until the first Live check run on main)"
exit $code
