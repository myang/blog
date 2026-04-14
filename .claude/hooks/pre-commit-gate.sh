#!/usr/bin/env bash
# PreToolUse hook for Bash: blocks `git commit` if the test suite is red.
#
# This is the final safety net before code lands in git. The agent should
# already have run `npm test` itself (per CLAUDE.md), but if it forgot or
# something regressed, this hook catches it.

set -uo pipefail

cd "$(dirname "$0")/../.."

input="$(cat || true)"
command="$(echo "$input" | jq -r '.tool_input.command // empty')"

# Only intercept commands that look like a git commit. Let everything else
# through unchanged.
if [[ -z "$command" ]] || ! echo "$command" | grep -qE '(^|[[:space:]]|;|&&|\|\|)git[[:space:]]+commit\b'; then
  exit 0
fi

echo "[harness] Pre-commit gate: running full validation pipeline..." >&2

if ! out="$(npm test 2>&1)"; then
  cat >&2 <<EOF
[harness] PRE-COMMIT BLOCKED: 'npm test' failed.

$out

Fix the failures above before committing. The harness will not let broken
code land. See CLAUDE.md > "The auto-repair loop" for the repair procedure.
EOF
  exit 2
fi

echo "[harness] Pre-commit gate: all tests green. Allowing commit." >&2
exit 0
