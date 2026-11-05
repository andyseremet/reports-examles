#!/usr/bin/env bash
# Runs the CLAUDE.md syntax check after Claude edits index.html or sw.js.
# Exit 2 sends the error back to Claude so it fixes it straight away.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$(basename "$f")" in index.html|sw.js) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
out=$(node -e "new Function(require('fs').readFileSync('index.html','utf8').split('<script>').slice(-1)[0].split('</script>')[0])" 2>&1 && node --check sw.js 2>&1)
[ $? -eq 0 ] && exit 0
echo "Syntax check failed after editing $f:" >&2
echo "$out" | head -20 >&2
exit 2
