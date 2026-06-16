#!/usr/bin/env bash
# resolve-preview-url.sh — resolve and verify the Cloudflare Pages preview URL for a PR.
#
# Usage:
#   ./resolve-preview-url.sh [PR_NUMBER]
#
# If PR_NUMBER is omitted, the script looks up the PR for the current branch via `gh pr view`.
#
# Output: prints the verified live preview URL to stdout.
# Exit codes:
#   0  — URL is live and (if commit SHA was present) matches a commit in the PR.
#   1  — no preview comment found, curl timeout, or commit SHA mismatch.
#
# Requires: gh (GitHub CLI), curl

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Base path where the site is served (project-specific — imposed by astro.config base option)
# Site is served at root ("/"), so base path is empty
SITE_BASE_PATH=""

# Poll settings: up to ~3 minutes total (exponential backoff: 5 10 20 40 60 60 ...)
MAX_POLL_SECONDS=180
INITIAL_BACKOFF=5

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { printf '[resolve-preview-url] %s\n' "$*" >&2; }
warn() { printf '[resolve-preview-url] WARNING: %s\n' "$*" >&2; }
fail() { printf '[resolve-preview-url] ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Step 1 — determine PR number
# ---------------------------------------------------------------------------

if [[ $# -ge 1 ]]; then
  PR_NUMBER="$1"
  log "Using provided PR number: $PR_NUMBER"
else
  log "No PR number supplied — resolving from current branch..."
  PR_NUMBER="$(gh pr view --json number --jq '.number' 2>/dev/null)" \
    || fail "Could not determine PR number. Are you on a branch with an open PR? (gh pr view failed)"
  log "Resolved PR number: $PR_NUMBER"
fi

# ---------------------------------------------------------------------------
# Step 2 — fetch PR commit SHAs (for stale-deploy guard)
# ---------------------------------------------------------------------------

# Collect all short SHAs of commits in this PR.
PR_COMMIT_SHAS="$(gh pr view "$PR_NUMBER" --json commits --jq '[.commits[].oid[:7]] | join(" ")')" \
  || fail "Could not fetch PR commits for PR #$PR_NUMBER"

# The pr-checks workflow runs on `pull_request`, so its "Built from commit" embeds context.sha —
# GitHub's synthetic test-merge commit (refs/pull/N/merge), which is NOT a PR branch commit. Add
# the PR's current merge commit so a preview built from it is recognized as fresh. Empty when the
# PR is not currently mergeable; we then degrade gracefully to branch-commit membership only.
MERGE_SHA="$(gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}" --jq '.merge_commit_sha // "" | .[:7]' 2>/dev/null || true)"
VALID_SHAS="${PR_COMMIT_SHAS}${MERGE_SHA:+ ${MERGE_SHA}}"

log "PR #$PR_NUMBER valid SHAs (branch + merge): $VALID_SHAS"

# ---------------------------------------------------------------------------
# Step 3 — find the latest cf-preview-pr comment
# ---------------------------------------------------------------------------

MARKER="<!-- cf-preview-pr -->"

# Fetch ALL pages of issue comments, slurp into one array, then filter.
# Using --slurp so jq sees the full concatenated array across pages before filtering.
# We pick the LAST comment that contains the marker (by array position).
# The workflow updates the same comment in place, but this guards against edge cases
# where multiple comments exist (e.g. the first was manually re-created).
COMMENT_BODY="$(
  gh api "repos/{owner}/{repo}/issues/${PR_NUMBER}/comments" \
    --paginate \
    --slurp \
  | jq -r "[.[][].body | select(. != null and (contains(\"${MARKER}\")))] | last"
)" || fail "Failed to list PR comments for PR #$PR_NUMBER"

if [[ -z "$COMMENT_BODY" || "$COMMENT_BODY" == "null" ]]; then
  fail "No '${MARKER}' comment found on PR #$PR_NUMBER. The preview deploy may not have run yet."
fi

log "Found preview comment."

# ---------------------------------------------------------------------------
# Step 4 — extract the *.pages.dev URL
# ---------------------------------------------------------------------------

# The workflow posts the URL in a Markdown table row:
#   | Preview | https://<something>.pages.dev |
# We match any https://*.pages.dev URL anywhere in the comment body.
PREVIEW_URL="$(
  printf '%s' "$COMMENT_BODY" \
    | grep -oE 'https://[a-zA-Z0-9._-]+\.pages\.dev[^[:space:]|]*' \
    | head -1 || true
)"

if [[ -z "$PREVIEW_URL" ]]; then
  fail "Could not extract a *.pages.dev URL from the preview comment."
fi

log "Extracted preview URL: $PREVIEW_URL"

# ---------------------------------------------------------------------------
# Step 5 — stale-deploy guard: compare commit SHA
# ---------------------------------------------------------------------------

# The workflow embeds: Built from commit: `<7-char-sha>`
# Anchored to the "Built from commit:" label to avoid matching unrelated inline-code tokens.
COMMENT_SHA="$(
  printf '%s' "$COMMENT_BODY" \
    | grep -oE 'Built from commit: `[0-9a-f]{7}`' \
    | grep -oE '[0-9a-f]{7}' \
    | head -1 || true
)"

if [[ -z "$COMMENT_SHA" ]]; then
  # No commit SHA in the comment — cannot verify build freshness.
  warn "The preview comment does not contain a commit SHA."
  warn "The live preview at ${PREVIEW_URL} may be built from an OLDER commit."
  warn "Build freshness could NOT be verified. Proceed with caution."
else
  log "Comment built-from SHA: $COMMENT_SHA"
  # Fresh if the comment SHA is a PR branch commit OR the PR's current merge commit (the workflow
  # embeds the latter via context.sha). -w matches whole space-separated tokens so a 7-char SHA
  # can't match as a substring of a longer one.
  if printf '%s' "$VALID_SHAS" | grep -qwF "$COMMENT_SHA"; then
    log "Comment SHA '$COMMENT_SHA' matches a PR commit or the current merge commit. Build is fresh."
  else
    fail "Stale-deploy mismatch: comment says built from '$COMMENT_SHA' but that SHA is neither a PR #$PR_NUMBER branch commit nor the current merge commit ($VALID_SHAS). Wait for the CI preview job to finish and re-run."
  fi
fi

# ---------------------------------------------------------------------------
# Step 6 — poll until the URL is live (exponential backoff, ~3 min cap)
# ---------------------------------------------------------------------------

PROBE_URL="${PREVIEW_URL}${SITE_BASE_PATH}/"
log "Probing: $PROBE_URL"

elapsed=0
backoff=$INITIAL_BACKOFF

while true; do
  HTTP_STATUS="$(
    curl -s -o /dev/null -w "%{http_code}" \
      --max-time 15 \
      --location \
      "$PROBE_URL" \
    || echo "000"
  )"

  if [[ "$HTTP_STATUS" == "200" ]]; then
    log "Site is live (HTTP $HTTP_STATUS)."
    break
  fi

  log "Not ready yet (HTTP $HTTP_STATUS). Elapsed: ${elapsed}s / ${MAX_POLL_SECONDS}s. Retrying in ${backoff}s..."

  sleep "$backoff"
  elapsed=$(( elapsed + backoff ))

  if (( elapsed >= MAX_POLL_SECONDS )); then
    fail "Timed out after ${elapsed}s waiting for ${PROBE_URL} to return 200 (last status: ${HTTP_STATUS})."
  fi

  # Exponential backoff, capped at 60s
  backoff=$(( backoff * 2 ))
  if (( backoff > 60 )); then
    backoff=60
  fi
done

# ---------------------------------------------------------------------------
# Done — print the verified URL
# ---------------------------------------------------------------------------

echo "$PREVIEW_URL"
