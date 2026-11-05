#!/usr/bin/env bash
# Runs the CLAUDE.md syntax check after Claude edits the app code (index.html, status.html, js/, sw.js).
# Exit 2 sends the error back to Claude so it fixes it straight away.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in *.js|*.html) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
out=$(node tests/syntax-check.mjs 2>&1) && exit 0
echo "Syntax check failed after editing $f:" >&2
echo "$out" | head -20 >&2
exit 2
