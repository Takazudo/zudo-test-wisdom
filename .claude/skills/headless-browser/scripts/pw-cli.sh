#!/usr/bin/env bash
# pw-cli.sh — Wrapper for `npx @playwright/cli@latest` that works when the
# default Playwright cache (~/.cache/ms-playwright/ or ~/Library/Caches/ms-playwright/)
# is absent (e.g. Claude Code web, where the browser-download CDN is blocked).
#
# Mechanism: @playwright/cli resolves Chromium by scanning PLAYWRIGHT_BROWSERS_PATH
# for a dir named exactly "chromium-<BUILD>" (from its own bundled browsers.json).
# It does NOT honour an arbitrary PLAYWRIGHT_EXECUTABLE_PATH.  We therefore read
# the CLI's bundled browsers.json to get the expected build number, create a
# "chromium-<BUILD>/chrome-linux/chrome" symlink inside a synthetic cache dir,
# set PLAYWRIGHT_BROWSERS_PATH to that dir, then exec the CLI.  This is the only
# mechanism proven to make the CLI actually launch the /opt binary without a
# CDN download — arbitrary symlink names are silently ignored.

set -euo pipefail

# Check both Mac (~/Library/Caches) and Linux (~/.cache) default locations
DEFAULT_CACHE_LINUX="${HOME}/.cache/ms-playwright"
DEFAULT_CACHE_MAC="${HOME}/Library/Caches/ms-playwright"

# If the normal cache exists and has a Chromium entry, pass through unchanged.
# This is the Mac/local path — identical behaviour to calling npx directly.
if { [ -d "${DEFAULT_CACHE_MAC}" ] && ls "${DEFAULT_CACHE_MAC}"/chromium-* >/dev/null 2>&1; } || \
   { [ -d "${DEFAULT_CACHE_LINUX}" ] && ls "${DEFAULT_CACHE_LINUX}"/chromium-* >/dev/null 2>&1; }; then
  exec npx @playwright/cli@latest "$@"
fi

# --- Fallback: locate a pre-installed Chromium binary ---

CHROME_BIN=""

# Priority 1: explicit env var (our own convention)
if [ -n "${PLAYWRIGHT_EXECUTABLE_PATH:-}" ] && [ -x "${PLAYWRIGHT_EXECUTABLE_PATH}" ]; then
  CHROME_BIN="${PLAYWRIGHT_EXECUTABLE_PATH}"
fi

# Priority 2: /opt/pw-browsers/*/chrome-linux/chrome (newest build number wins)
# Use sort -V (version sort) to correctly handle numeric suffixes across digit counts
if [ -z "${CHROME_BIN}" ] && [ -d "/opt/pw-browsers" ]; then
  CHROME_BIN=$(ls -d /opt/pw-browsers/*/chrome-linux/chrome 2>/dev/null | sort -Vr | head -1 || true)
fi

if [ -z "${CHROME_BIN}" ] || [ ! -x "${CHROME_BIN}" ]; then
  echo "pw-cli.sh: no pre-installed Chromium found. Run: npx playwright install chromium" >&2
  exit 1
fi

# Read the exact Chromium build number that this version of @playwright/cli expects.
# The CLI only accepts "chromium-<BUILD>" dir names from its own browsers.json — an
# arbitrary name like "chromium-synthetic" is silently skipped, causing a CDN download.
PW_CLI_PACKAGE=$(npm_config_yes=true npx --no-install -p @playwright/cli@latest node -e \
  "process.stdout.write(require.resolve('@playwright/cli/package.json'))" 2>/dev/null || true)

CHROMIUM_BUILD=""
if [ -n "${PW_CLI_PACKAGE}" ]; then
  PW_CLI_DIR=$(dirname "${PW_CLI_PACKAGE}")
  BROWSERS_JSON="${PW_CLI_DIR}/browsers.json"
  if [ ! -f "${BROWSERS_JSON}" ]; then
    # Older layouts: look one level up
    BROWSERS_JSON="${PW_CLI_DIR}/../browsers.json"
  fi
  if [ -f "${BROWSERS_JSON}" ]; then
    # Extract chromium revisionOverride or revision
    CHROMIUM_BUILD=$(node -e "
      const j = JSON.parse(require('fs').readFileSync('${BROWSERS_JSON}','utf8'));
      const c = j.browsers.find(b => b.name === 'chromium');
      process.stdout.write(String(c ? (c.revisionOverride || c.revision) : ''));
    " 2>/dev/null || true)
  fi
fi

if [ -z "${CHROMIUM_BUILD}" ]; then
  # Fallback: use build number from the pre-installed binary's parent dir name
  CHROMIUM_BUILD=$(basename "$(dirname "$(dirname "${CHROME_BIN}")")" | grep -oE '[0-9]+$' || echo "fallback")
fi

# Build the registry-layout symlink that @playwright/cli expects
SYNTHETIC_CACHE="${HOME}/.cache/ms-playwright-fallback"
ENTRY_DIR="${SYNTHETIC_CACHE}/chromium-${CHROMIUM_BUILD}/chrome-linux"
mkdir -p "${ENTRY_DIR}"
TARGET="${ENTRY_DIR}/chrome"
if [ ! -e "${TARGET}" ]; then
  ln -sf "${CHROME_BIN}" "${TARGET}"
fi

export PLAYWRIGHT_BROWSERS_PATH="${SYNTHETIC_CACHE}"

exec npx @playwright/cli@latest "$@"
