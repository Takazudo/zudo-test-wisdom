---
name: headless-browser
description: "Browser automation with two efficiency tiers. Tier 1: headless-check.js for quick health checks, screenshots, error detection (JSON output). Tier 2: Playwright CLI (@playwright/cli via npx) for interactive browser automation -- click, fill, navigate, take snapshots with YAML element refs (4x more token-efficient than MCP). Use when: (1) Quick webpage health checks, (2) Taking screenshots, (3) Checking console/network errors, (4) Clicking buttons, filling forms, navigating, (5) Multi-step browser interaction with element inspection. Use MCP Playwright only for complex scenarios requiring persistent context."
---

# Headless Browser Skill

Browser automation with two efficiency tiers for optimal token usage.

## Decision Tree

```
Need browser automation?
    |
    +-- Just checking page health/errors/screenshot?
    |       --> Tier 1: headless-check.js (fastest, lowest tokens)
    |
    +-- Need to interact (click, fill, navigate, inspect elements)?
    |       --> Tier 2: Playwright CLI (YAML snapshots + element refs, 4x more efficient than MCP)
    |
    +-- Need persistent context, rich introspection, or very complex scenarios?
            --> Tier 3: MCP Playwright (highest capability, higher tokens)
```

---

## Tier 1: Lightweight Checks (headless-check.js)

**Best for:** Quick health checks, screenshot capture, error detection

**Script:** `$HOME/.claude/skills/headless-browser/scripts/headless-check.js`

### Commands

Basic check (recommended for error detection):

```bash
node $HOME/.claude/skills/headless-browser/scripts/headless-check.js --url <URL> --no-block-resources
```

Quick check (faster, but may miss font/image errors):

```bash
node $HOME/.claude/skills/headless-browser/scripts/headless-check.js --url <URL>
```

With screenshot:

```bash
node $HOME/.claude/skills/headless-browser/scripts/headless-check.js --url <URL> --screenshot viewport --no-block-resources
node $HOME/.claude/skills/headless-browser/scripts/headless-check.js --url <URL> --screenshot full --no-block-resources
```

Options:

- `--timeout <ms>` - Timeout (default: 15000)
- `--wait-until load|networkidle|domcontentloaded` - Wait strategy
- `--no-javascript` - Disable JavaScript
- `--no-block-resources` - Load all resources (recommended for accurate error detection)
- `--user-agent "..."` - Custom user agent

**Important:** Always use `--no-block-resources` when checking for errors. Without it, fonts and images are blocked for speed, which can cause false `net::ERR_FAILED` errors or miss real resource loading failures.

### Output

JSON with:

- `title`, `statusCode`, `finalUrl`, `durationMs`
- `hasErrors` - Boolean error indicator
- `console` - Console messages (truncated, collapsed)
- `pageErrors` - JavaScript errors
- `networkErrors` - Failed requests
- `metrics` - Performance timing
- `screenshot` - File path if captured

### Example Output

```
{
  "url": "https://example.com",
  "title": "Example Domain",
  "statusCode": 200,
  "durationMs": 1234,
  "hasErrors": false,
  "console": { "entries": [], "total": 0 },
  "pageErrors": [],
  "screenshot": { "path": "/Users/you/cclogs/my-project/headless-screenshots/screenshot-2025-01-28.png" }
}
```

---

## Tier 2: Playwright CLI (Interactive Browser Automation)

**Best for:** Clicking, form filling, navigation, page inspection, multi-step automation

Playwright CLI (`@playwright/cli`) is Microsoft's CLI built specifically for coding agents. It outputs YAML snapshots with element refs (e.g., `e3`, `e15`) that you use to interact -- 4x more token-efficient than MCP Playwright.

**Run via npx** (no local install needed -- reuses existing Chromium browsers):

```bash
npx @playwright/cli@latest <command>
```

### Core Workflow

```bash
# 1. Open a page
npx @playwright/cli@latest open http://localhost:4321/some/page

# 2. Take snapshot to see page structure and element refs
npx @playwright/cli@latest snapshot
# Output YAML with refs like:
#   - heading "Welcome" [level=1] [ref=e3]
#   - button "Submit" [ref=e15]
#   - textbox [ref=e21]

# 3. Interact using element refs from snapshot
npx @playwright/cli@latest fill e21 "test@example.com"
npx @playwright/cli@latest click e15

# 4. Snapshot again to verify the result
npx @playwright/cli@latest snapshot

# 5. Screenshot for visual verification
npx @playwright/cli@latest screenshot --filename $HOME/cclogs/REPO/headless-screenshots/result.png

# 6. Close the browser when done
npx @playwright/cli@latest close
```

### Command Reference

**Core:**

- `open [url]` -- Launch browser and navigate
- `close` -- Close current session
- `snapshot` -- Get page structure with element refs (YAML)
- `screenshot` -- Capture visual screenshot (`--filename path`, `--full-page`)
- `eval <js>` -- Evaluate JavaScript in the page

**Interaction:**

- `click <ref>` -- Click an element by ref
- `dblclick <ref>` -- Double-click
- `fill <ref> <text>` -- Fill a form field
- `type <text>` -- Type into focused element
- `select <ref> <value>` -- Choose dropdown option
- `check <ref>` / `uncheck <ref>` -- Toggle checkboxes
- `hover <ref>` -- Hover over element
- `drag <startRef> <endRef>` -- Drag and drop
- `upload <file>` -- Upload a file

**Navigation:**

- `goto <url>` -- Navigate to URL
- `go-back` / `go-forward` -- Browser navigation
- `reload` -- Refresh page

**Keyboard:**

- `press <key>` -- Press a key (e.g., `Enter`, `Tab`, `Escape`)

**Tabs:**

- `tab-new [url]` -- Open new tab
- `tab-list` -- List open tabs
- `tab-select <index>` -- Switch to tab
- `tab-close` -- Close current tab

**Network:**

- `route <url-pattern> <json-body>` -- Mock network responses
- `network` -- View recent network requests

**DevTools:**

- `console` -- View console messages
- `tracing-start` / `tracing-stop` -- Record traces
- `video-start` / `video-stop` -- Record video

### Common Patterns

**Page inspection** (no interaction needed):

```bash
npx @playwright/cli@latest open http://localhost:4321/page
npx @playwright/cli@latest snapshot
npx @playwright/cli@latest console
npx @playwright/cli@latest close
```

**Visual verification screenshot:**

```bash
npx @playwright/cli@latest open http://localhost:4321/page
npx @playwright/cli@latest screenshot --filename $HOME/cclogs/REPO/headless-screenshots/check.png --full-page
npx @playwright/cli@latest close
```

**Form interaction:**

```bash
npx @playwright/cli@latest open http://localhost:4321/form
npx @playwright/cli@latest snapshot                  # Find form element refs
npx @playwright/cli@latest fill e12 "user@example.com"
npx @playwright/cli@latest fill e15 "password123"
npx @playwright/cli@latest click e20                 # Submit button ref
npx @playwright/cli@latest snapshot                  # Verify result
npx @playwright/cli@latest close
```

**Check computed style via eval:**

```bash
npx @playwright/cli@latest open http://localhost:4321/page
npx @playwright/cli@latest eval "window.getComputedStyle(document.querySelector('.panel')).zIndex"
npx @playwright/cli@latest close
```

**Mock network response:**

```bash
npx @playwright/cli@latest open http://localhost:4321/page
npx @playwright/cli@latest route "**/api/users" '{"users": []}'
npx @playwright/cli@latest reload
npx @playwright/cli@latest snapshot
npx @playwright/cli@latest close
```

### Session Management

The browser stays running between commands (persistent session). Always close when done:

- `close` -- Close current session
- `close-all` -- Close all sessions
- `list` -- See active sessions

### Artifacts

Playwright CLI creates a `.playwright-cli/` directory at the current working directory containing snapshot YAML files and console logs. This directory is gitignored.

### Notes

- Always use `npx @playwright/cli@latest` (NOT the `playwright` CLI from the playwright npm package -- they are different)
- The `--raw` flag strips metadata, outputting only the result value
- Element refs (e3, e15, etc.) come from `snapshot` output -- use them in click/fill/select
- For **color scheme testing** (light/dark), use Tier 1's headless-check.js which supports Playwright's `colorScheme` context option. Playwright CLI does not have a `--color-scheme` flag
- If browsers are missing on a fresh machine, run: `npx playwright install chromium`

---

## When to Use What

| Task | Recommended |
|------|------------|
| Check if page loads | Tier 1 |
| Capture screenshot (no interaction) | Tier 1 |
| Check for console errors | Tier 1 + `--no-block-resources` |
| Check network failures | Tier 1 + `--no-block-resources` |
| Color scheme screenshots (light/dark) | Tier 1 (supports `colorScheme`) |
| Inspect page structure / element tree | Tier 2 (`snapshot`) |
| Click a button | Tier 2 (`click`) |
| Fill a form | Tier 2 (`fill`) |
| Navigate through pages | Tier 2 (`goto` / `go-back`) |
| Test login flow | Tier 2 |
| Extract text after interaction | Tier 2 (`eval`) |
| Check computed CSS styles | Tier 2 (`eval`) |
| Multi-tab workflows | Tier 2 (`tab-*`) |
| Mock network responses | Tier 2 (`route`) |
| Complex stateful automation | Tier 3: MCP Playwright |
| Deep debugging with tracing | Tier 2 (`tracing-*`) or MCP Playwright |

---

## CSS/Style Verification Guidelines

**For CSS/style verification, prefer `/verify-ui` which provides deterministic computed style checks before visual analysis.** The guidelines below apply when using `/headless-browser` directly for CSS checks.

### Theme Awareness

The target website may support light/dark themes. When checking CSS/style-related changes, capture screenshots in **both** color schemes. Use Playwright's `colorScheme` option:

```javascript
// Capture in both themes
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme: scheme,
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ssDir}/check-${scheme}.png` });
  await page.close();
}
```

### Responsive Width Variations

When checking layout or fluid design, capture at multiple viewport widths to cover the design's breakpoints. The number and values of widths depend on the project — check the project's CSS/config for actual breakpoints (e.g., `@theme` breakpoints, Tailwind config, media queries) and capture at widths that test each transition point. For example, a project with `sm: 640px`, `lg: 1024px`, `xl: 1280px` breakpoints needs captures at widths like 400px, 700px, 1100px, and 1300px to verify behavior on each side of each breakpoint.

If the project's breakpoints are unclear, ask the user which width variations matter for the layout being checked.

### Mandatory Visual Verification

**CRITICAL**: After capturing screenshots, you MUST read and carefully examine every captured PNG file using the Read tool. Do NOT report success without visually verifying the screenshots show the expected result.

Workflow:

1. Capture screenshots
2. **Read each screenshot with the Read tool**
3. **Carefully inspect** — check borders, spacing, alignment, color, contrast
4. Compare against what was requested
5. Only then report the result

Screenshots that are captured but not visually inspected are worthless. If you skip verification, you will miss problems and the user will have to point them out repeatedly.

## Best Practices

1. **Start with Tier 1** -- If you just need to check if a page works, use headless-check.js
2. **Escalate to Tier 2** -- When interactions or page inspection are needed, use Playwright CLI
3. **Always close sessions** -- Run `npx @playwright/cli@latest close` when done to free resources
4. **Use snapshots, not raw HTML** -- Playwright CLI snapshots are structured YAML with element refs, far more token-efficient than page source
5. **Capture both themes** -- For theme testing, use Tier 1's `colorScheme` support
6. **Capture at project breakpoints** -- When checking layout, read the project's breakpoint config and capture widths that cover each transition
7. **Always visually verify** -- Read every captured PNG with the Read tool before reporting

---

## Technical Notes

- **Tier 1** uses Playwright API via Node.js (installed in `$HOME/.claude/skills/headless-browser/node_modules/`)
- **Tier 2** uses `@playwright/cli` via npx (isolated from the local playwright install, no conflicts)
- Both tiers share the same Chromium browsers from `$HOME/.cache/ms-playwright/`
- **Resource blocking:** By default, Tier 1 blocks images/fonts for speed. Use `--no-block-resources` for accurate error detection
- Screenshots saved to `$HOME/cclogs/{repo-name}/headless-screenshots/`
- Playwright CLI creates a `.playwright-cli/` directory at CWD for snapshot artifacts (gitignored)
- All tiers are more token-efficient than MCP Playwright (Tier 2 is ~4x more efficient)
