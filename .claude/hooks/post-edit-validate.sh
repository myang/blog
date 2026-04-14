#!/usr/bin/env bash
# PostToolUse hook: runs after Claude Code uses Edit / Write / MultiEdit.
#
# Reads the tool input JSON from stdin, figures out which file was touched,
# and runs the relevant validators. Any validator failure exits 2 so Claude
# Code surfaces the stderr output back to the agent — that's what closes the
# auto-repair loop.

set -uo pipefail

cd "$(dirname "$0")/../.."

# Read tool payload from stdin.
input="$(cat || true)"

# Extract the file path that was edited. Different tools nest it differently;
# try the common shapes.
file_path="$(echo "$input" | jq -r '
  .tool_input.file_path
  // .tool_input.path
  // empty
')"

# If we cannot determine the file, skip silently — better than blocking
# every unrelated edit.
if [[ -z "$file_path" ]]; then
  exit 0
fi

# Normalize to a path relative to the repo root.
rel_path="${file_path#"$PWD"/}"

# Decide which test(s) to run based on what was edited.
run_posts=0
run_markdown=0
run_build=0

case "$rel_path" in
  src/posts/*.md|src/blog/*.md)
    run_posts=1
    run_markdown=1
    run_build=1
    ;;
  src/_includes/*|src/_data/*|.eleventy.js|src/index*.html)
    run_build=1
    ;;
  tests/*.js|.markdownlint-cli2.jsonc|.htmlvalidate.json)
    # Validator config or scripts changed — re-run the full suite.
    run_posts=1
    run_markdown=1
    run_build=1
    ;;
  *)
    # Edit outside the validated surface area — nothing to do.
    exit 0
    ;;
esac

failed=0
errors=""

run_step() {
  local name="$1"
  shift
  local out
  if ! out="$("$@" 2>&1)"; then
    failed=1
    errors+="
[$name] FAILED:
$out
"
  fi
}

if (( run_posts )); then
  run_step "test:posts" node tests/validate-posts.js
fi

if (( run_markdown )); then
  run_step "test:markdown" ./node_modules/.bin/markdownlint-cli2
fi

if (( run_build )); then
  # Build is required before HTML/build validators can run on fresh output.
  run_step "build" npm run --silent build
  if (( failed == 0 )); then
    run_step "test:html" ./node_modules/.bin/html-validate '_site/**/*.html'
    run_step "test:build" node tests/validate-build.js
  fi
fi

if (( failed )); then
  cat >&2 <<EOF
[harness] Validation failed after edit to: $rel_path
$errors

Auto-repair instructions (from CLAUDE.md):
  1. Read the error above.
  2. Diagnose the root cause.
  3. Apply the narrowest fix to the offending file.
  4. Re-run the failing test to verify green.
EOF
  exit 2
fi

exit 0
