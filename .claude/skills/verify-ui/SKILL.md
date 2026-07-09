---
name: verify-ui
description: "Verify CSS/UI changes match what the user asked for. Uses deterministic computed style checks to avoid LLM confirmation bias. Use when: (1) After CSS or layout changes the user asks to verify, (2) User says 'verify ui', 'check the result', 'confirm it works', (3) User asks to check via /headless-browser for style work. Use PROACTIVELY after CSS/layout changes when asked to verify."
---

# Verify UI

Verify that CSS/UI changes actually match what was requested.

## Core Principle

The user asked you to do something ("add a border", "center the dialog", "make it full width on mobile"). After implementing, verify that **the specific thing they asked for** is actually working. Not a generic checklist — verify the requirement.

## Consume the Requirement Contract — Don't Invent Pass Criteria

When the change came through `/x-as-pr` or `/big-plan` and the request had visual evidence, a **Screenshot Requirement Contract** already exists (in the PR body, the issue / sub-issue body, or `progress.md`). **Read it and verify against it.** Do NOT invent your own convenient pass criterion — inventing one is precisely how confirmation bias slips in and a broken layout gets a PASS.

The contract has `Expected:` states and `Forbidden:` states. Verify **both**, and report in this shape:

```md
Expected:                 <each expected state → met? how observed>
Observed:                 <what the computed styles / geometry / screenshot actually show>
Still different:          <expected-but-not-yet-true states>
Forbidden states checked: <each forbidden state → present or absent?>
Verdict: PASS / FAIL / INCONCLUSIVE
```

**A forbidden state that is still present forces the verdict — it cannot be PASS**, no matter how many `Expected:` items are satisfied. Partial improvement is FAIL, not PASS.

If the contract pins a `Viewport:` (specific widths or breakpoints), verify at those widths — they override the breakpoint auto-detection in Step 2 below.

If no contract exists yet (e.g. a bare `/verify-ui` on visual work), derive the Expected / Forbidden states from the screenshots yourself first — never verify against a proxy you picked because it was easy to read off the DOM. For a non-visual requirement, fall through to Step 1 below.

### Worked example — the false positive this prevents

A ReadyCrew fix had to move the AI reason **above** the budget (they had been side-by-side). The first implementation only widened the AI reason text and left the side-by-side layout intact. Verification checked a proxy — "does the reason span the wider triage column?" — and reported PASS:

```json
{ "reasonSpansTriageWidth": true, "reasonConfinedToAiColumn": false, "currentIsSideBySide": true }
```

`reasonSpansTriageWidth` (an Expected-ish proxy) was true, so it looked done — but `currentIsSideBySide: true` was the **forbidden** state the screenshot was correcting. Correct verdict: **FAIL** (partial improvement), not PASS. The second implementation, checked against the real contract, verified the states that actually matter:

```json
{ "aiBudgetSideBySide": false, "aiAboveBudget": true, "sameColumn": true }
```

The lesson: check the states the screenshot diff is actually about (`aiBudgetSideBySide: false`, `aiAboveBudget: true`), not a proxy metric that happens to be convenient to read from the DOM.

## Step 1: Clarify What to Verify

**If the requirement is clear** — translate it to verifiable CSS properties:

| User said | Verify these properties |
|-----------|------------------------|
| "add a border" | `border-style` (not `none`), `border-width` (not `0px`), `border-color` |
| "center the dialog" | `margin` (should be `auto` or symmetric), bounding box position |
| "full width on mobile" | `width` at narrow viewport, `max-width` |
| "remove rounded corners" | `border-radius` (should be `0px`) |
| "make text bigger" | `font-size` |
| "fix the z-index" | `z-index`, stacking relative to other elements |

**If the requirement is vague** ("check the result", "verify it looks good", "confirm it works") — **ask the user back**:

> "What specifically should I verify? For example: is it about the border, the positioning, the spacing, the colors, or something else?"

Do NOT proceed with a generic screenshot check when you don't know what you're looking for. That's how confirmation bias happens.

## Step 2: Extract Computed Styles

Run the verification script targeting the element in question:

```bash
LOGDIR=$(node $HOME/.claude/scripts/get-logdir.js)
mkdir -p "$LOGDIR"
node $HOME/.claude/skills/verify-ui/scripts/verify-styles.mjs "<URL>" "<SELECTOR>" "$LOGDIR/verify-ui" "<WIDTHS>" "<SCHEMES>"
```

**Detect viewport widths from the project's breakpoints:**

```bash
grep -n "breakpoint" src/styles/global.css 2>/dev/null
```

Pick widths that test each side of each breakpoint. Default: `400,800,1200`. Default schemes: `light,dark`.

**Parse the JSON output.** Find the properties relevant to the user's request and compare against expected values.

```
[PASS] border-style: solid (expected: not "none")
[FAIL] border-width: 0px (expected: 1px) ← THIS IS THE PROBLEM
```

If the computed style check reveals the issue, fix it. No screenshot analysis needed — the data is deterministic.

## Step 3: Visual Confirmation (if computed styles pass)

If computed styles look correct but the user's concern might be visual (layout, spacing, alignment), read the captured screenshots:

1. **Read** each screenshot with the Read tool
2. **Describe** what you see — specifically about the thing the user asked for
3. **Compare** against the requirement
4. **Report** whether it matches

**NEVER say "looks correct" without stating what specific thing you checked and what you observed.**

## Limited-env browser fallback (web/WSL)

`verify-styles.mjs` includes a browser-resolver that falls back to a pre-installed Chromium when the default Playwright cache (`~/Library/Caches/ms-playwright/` on Mac, `~/.cache/ms-playwright/` on Linux/WSL) is absent — e.g. on Claude Code web, where the browser-download CDN is blocked. Resolution order: default cache (Mac/local, unchanged) → `PLAYWRIGHT_EXECUTABLE_PATH` → newest `/opt/pw-browsers/*/chrome-linux/chrome`. On **Linux (WSL, native, web container)** the resolver passes `--no-sandbox --disable-gpu --disable-dev-shm-usage` on **every** branch — including the default cache — so a browser sitting in `~/.cache/ms-playwright/` launches without the "No usable sandbox!" error. On Mac/`darwin` no flags are added and the default-cache branch returns `{}` (unchanged). In-container, bind the dev server to `127.0.0.1` (`*.localhost` does not resolve there). When you cannot serve locally at all, verify against the PR preview deploy — see `/verify-ui-ai`'s "Verify against the PR preview deploy".

**WSL prerequisite:** a fresh WSL2 Ubuntu is missing Chromium's shared libraries (`libnss3`, `libgbm`, `libasound2`, …). The flags above silence the sandbox error, but if the libs are absent the launch still fails with *"Host system is missing dependencies to run browsers"*. Run `npx playwright install-deps` once (it uses `sudo`) to install them.

## When to Use Multiple Widths/Themes

- **Always** if the change involves responsive behavior (breakpoint-dependent styling)
- **Always** if the change involves colors or borders (may be invisible in one theme)
- **Not needed** for changes that are viewport/theme independent (e.g., changing font-weight)

## Anti-Patterns

- **Generic "take a screenshot and verify"** — verify WHAT? If you don't know, ask.
- **"Looks correct" after glancing at screenshot** — state what you checked.
- **Running verification without knowing what you're looking for** — confirmation bias guaranteed.
- **Checking only one viewport width when the change is responsive** — you'll miss breakpoint issues.
