#!/usr/bin/env bash
set -euo pipefail

# Idempotent bootstrap for this skill's bundled Playwright.
#
# This skill is used STANDALONE (symlinked into ~/.claude/skills/ without the
# zudo-test-wisdom repo, or copied into another project), so it cannot rely on
# the repo's `pnpm setup:doc-skill` having run. Every entry point that needs a
# browser calls this first; running it by hand is also safe at any time.
#
# Fast path: if node_modules/playwright and the pinned browser are already
# present, this exits in milliseconds without touching the network.
#
#   bash scripts/ensure-deps.sh                    # playwright + chromium-headless-shell
#   bash scripts/ensure-deps.sh chromium           # a specific browser
#   bash scripts/ensure-deps.sh chromium chromium-headless-shell

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BROWSERS=("$@")
if [ ${#BROWSERS[@]} -eq 0 ]; then
  BROWSERS=(chromium-headless-shell)
fi

if [ ! -f "$SKILL_DIR/package.json" ]; then
  echo "ensure-deps.sh: no package.json at $SKILL_DIR" >&2
  exit 1
fi

if [ ! -d "$SKILL_DIR/node_modules/playwright" ]; then
  (cd "$SKILL_DIR" && npm install --silent --no-audit --no-fund >/dev/null 2>&1) || {
    echo "ensure-deps.sh: npm install failed in $SKILL_DIR" >&2
    exit 1
  }
fi

CLI="$SKILL_DIR/node_modules/playwright/cli.js"
if [ ! -f "$CLI" ]; then
  echo "ensure-deps.sh: playwright CLI missing at $CLI" >&2
  exit 1
fi

# Drive the browser download through THIS package's own CLI. Each Playwright
# version pins its own browser revisions, so a bare `npx playwright install`
# (which fetches @latest) downloads a revision this module will never look for —
# the launch then fails with "Executable doesn't exist" despite a "successful"
# install. `playwright install` is itself idempotent and near-instant when the
# revision is already cached.
node "$CLI" install "${BROWSERS[@]}" >/dev/null 2>&1 || {
  echo "ensure-deps.sh: browser install failed (${BROWSERS[*]})" >&2
  exit 1
}
