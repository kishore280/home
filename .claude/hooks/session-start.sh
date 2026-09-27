#!/bin/bash
# Claude Code on the web: install the packages and point the tests at the container's Chromium.
# Playwright looks for its own pinned browser build, which the container does not have, so every
# UI test would fail at launch; playwright.config.ts uses CHROMIUM_PATH instead (AGENTS.md, "Test").
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund

# The newest Chromium in the container's Playwright browsers folder.
chromium=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -n 1 || true)
if [ -n "$chromium" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CHROMIUM_PATH=\"$chromium\"" >> "$CLAUDE_ENV_FILE"
fi
