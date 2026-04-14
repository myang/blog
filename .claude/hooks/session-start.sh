#!/usr/bin/env bash
# SessionStart hook: ensure the project is ready to build and test.
# Runs once per Claude Code session. Fast no-op if already installed.

set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ ! -d node_modules ]] || [[ ! -x node_modules/.bin/eleventy ]]; then
  echo "[harness] Installing npm dependencies..." >&2
  npm install --silent >&2
  echo "[harness] Dependencies installed." >&2
else
  echo "[harness] node_modules/ present — skipping install." >&2
fi

exit 0
