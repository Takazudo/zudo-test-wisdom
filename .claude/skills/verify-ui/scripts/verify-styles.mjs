#!/usr/bin/env node

// Extracts computed styles, bounding box, and captures screenshots for a target element.
// Usage: node verify-styles.mjs <URL> <SELECTOR> [SCREENSHOT_DIR] [WIDTHS] [SCHEMES] [WAIT_UNTIL]
//
// Examples:
//   node verify-styles.mjs "http://localhost:4321/" "dialog"
//   node verify-styles.mjs "http://localhost:4321/" ".card" "./screenshots" "400,800,1200" "light,dark"
//   node verify-styles.mjs "http://localhost:4321/" ".card" "./screenshots" "400,800,1200" "light" "load"
//
// WAIT_UNTIL (default "networkidle", matches headless-check.js's --wait-until):
// some dev servers (e.g. Vite/zfb-style HMR) hold a WebSocket open forever, so
// "networkidle" never fires and every page.goto times out. Pass "load" for
// those. This script does NOT auto-detect that case — same as headless-check.js,
// the caller has to know to pass it.
//
// Playwright must be importable. The script tries common locations.

// Revisions actually present in the local Playwright browser cache(s), keyed
// by revision number string (e.g. "1217"). Used to pick a playwright-core
// install whose OWN required browser build is actually downloaded, instead of
// picking "the first one found" and crashing at launch time. pnpm hoists
// multiple playwright-core versions side by side in node_modules/.pnpm, and
// each version pins its own exact chromium-headless-shell revision — the
// cache commonly has some revisions but not others.
async function cachedChromiumRevisions() {
  const { existsSync, readdirSync } = await import("node:fs");
  const dirs = [
    `${process.env.HOME}/Library/Caches/ms-playwright`,
    `${process.env.HOME}/.cache/ms-playwright`,
  ];
  const revs = new Set();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const m = entry.match(/^chromium(?:_headless_shell)?-(\d+)$/);
      if (m) revs.add(m[1]);
    }
  }
  return revs;
}

async function requiredHeadlessShellRevision(playwrightCoreDir) {
  const { readFileSync } = await import("node:fs");
  try {
    const browsers = JSON.parse(
      readFileSync(`${playwrightCoreDir}/browsers.json`, "utf-8")
    ).browsers;
    return browsers.find((b) => b.name === "chromium-headless-shell")?.revision ?? null;
  } catch {
    return null;
  }
}

async function findPlaywright() {
  const { execSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const cachedRevs = await cachedChromiumRevisions();

  // Candidate 1: every playwright-core under the project's node_modules/.pnpm
  // (there can be several, hoisted by different sub-dependencies) — use the
  // first whose pinned browser revision is actually cached, not just the
  // first one `find` happens to list.
  try {
    const dirs = execSync(
      'find node_modules/.pnpm -name "playwright-core" -type d -maxdepth 4 2>/dev/null',
      { encoding: "utf-8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const dir of dirs) {
      const rev = await requiredHeadlessShellRevision(`${process.cwd()}/${dir}`);
      if (rev && cachedRevs.has(rev)) {
        return await import(`${process.cwd()}/${dir}/index.mjs`);
      }
    }
  } catch {}

  // Candidate 2: the headless-browser skill's own bundled Playwright install.
  // It pins a single version that this skill's setup keeps installed and
  // cached, so it works even when the target project's node_modules has
  // zero, multiple, or mismatched playwright-core versions.
  try {
    const skillIndex = new URL(
      "../../headless-browser/node_modules/playwright/index.mjs",
      import.meta.url
    );
    if (existsSync(skillIndex)) {
      return await import(skillIndex.href);
    }
  } catch {}

  // Candidate 3: whatever playwright-core the project has, even if we
  // couldn't confirm its browser revision is cached — better to attempt the
  // launch (Playwright's own error names the exact install command) than to
  // give up here.
  try {
    const result = execSync(
      'find node_modules/.pnpm -name "playwright-core" -type d -maxdepth 4 2>/dev/null | head -1',
      { encoding: "utf-8" }
    ).trim();
    if (result) {
      return await import(`${process.cwd()}/${result}/index.mjs`);
    }
  } catch {}
  // Candidate 4/5: plain global-style imports.
  try {
    return await import("playwright-core");
  } catch {}
  try {
    return await import("playwright");
  } catch {}
  console.error(
    "Error: no working Playwright installation found (checked the project's " +
      "node_modules, the headless-browser skill's bundled install, and global " +
      "packages). Run `npx playwright install chromium-headless-shell` in the project."
  );
  process.exit(1);
}

const CSS_PROPERTIES = [
  "display",
  "position",
  "width",
  "height",
  "max-width",
  "max-height",
  "margin",
  "padding",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "line-height",
  "box-shadow",
  "z-index",
  "opacity",
  "overflow",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
];

const url = process.argv[2];
const selector = process.argv[3];
const ssDir = process.argv[4] || "./verify-ui-screenshots";
const widths = (process.argv[5] || "400,800,1200")
  .split(",")
  .map((w) => parseInt(w.trim(), 10));
const schemes = (process.argv[6] || "light,dark").split(",").map((s) => s.trim());
const waitUntil = process.argv[7] || "networkidle";

if (!url || !selector) {
  console.error(
    "Usage: node verify-styles.mjs <URL> <SELECTOR> [SS_DIR] [WIDTHS] [SCHEMES] [WAIT_UNTIL]"
  );
  process.exit(1);
}

const { mkdirSync } = await import("node:fs");
const path = await import("node:path");
mkdirSync(ssDir, { recursive: true });

const { chromium } = await findPlaywright();

/**
 * Resolve Chromium launch options: an executablePath when the default Playwright
 * cache is absent, plus the platform-driven sandbox args.
 * On Linux (WSL + native Linux + web container) EVERY branch — default cache included —
 * launches with --no-sandbox --disable-gpu --disable-dev-shm-usage. Mac/darwin's sandbox
 * works, so it stays flag-free and the default-cache branch returns {} (unchanged).
 * executablePath fallback order when the default cache is absent (web/WSL, CDN download blocked):
 *   1. PLAYWRIGHT_EXECUTABLE_PATH env var (our own var — we read it and pass executablePath)
 *   2. /opt/pw-browsers/<newest>/chrome-linux/chrome (pre-installed by infra)
 */
async function resolveBrowserOpts() {
  const { existsSync, readdirSync } = await import("node:fs");
  // Linux (WSL + native Linux + web container) must launch Chromium with these
  // flags; Mac/darwin's sandbox works, so it stays flag-free. Applied on EVERY
  // executablePath branch (default cache included) — issue #60: the default-cache
  // branch previously returned no args, which broke WSL (browser is in the default
  // cache there, so it launched without --no-sandbox).
  const sandboxArgs =
    process.platform === "linux"
      ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
      : [];
  const withArgs = (opts = {}) =>
    sandboxArgs.length ? { ...opts, args: sandboxArgs } : opts;

  const defaultCaches = [
    `${process.env.HOME}/Library/Caches/ms-playwright`,
    `${process.env.HOME}/.cache/ms-playwright`,
  ];
  // Branch 1: default cache present (Mac/local, and WSL once installed)
  for (const defaultCache of defaultCaches) {
    if (existsSync(defaultCache) && readdirSync(defaultCache).some((d) => d.startsWith("chromium"))) {
      return withArgs();
    }
  }
  // Branch 2: explicit env var (our own; we pass it as executablePath, not relying on PW)
  const envPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (envPath) {
    return withArgs({ executablePath: envPath });
  }
  // Branch 3: glob /opt/pw-browsers/*/chrome-linux/chrome (newest build number wins)
  const optBase = "/opt/pw-browsers";
  if (existsSync(optBase)) {
    const dirs = readdirSync(optBase)
      .filter((d) => existsSync(`${optBase}/${d}/chrome-linux/chrome`))
      .sort((a, b) => {
        // Numeric sort on trailing build number (e.g. "chromium-1234" → 1234)
        const numA = parseInt(a.replace(/\D+/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D+/g, ""), 10) || 0;
        return numB - numA;
      });
    if (dirs.length > 0) {
      return withArgs({ executablePath: `${optBase}/${dirs[0]}/chrome-linux/chrome` });
    }
  }
  return withArgs();
}

const browserOpts = await resolveBrowserOpts();
// Print resolved opts when BROWSER_RESOLVER_DEBUG is set (for path-logic testing without a real launch)
if (process.env.BROWSER_RESOLVER_DEBUG) { console.log(JSON.stringify({ resolvedBrowserOpts: browserOpts })); process.exit(0); }
const browser = await chromium.launch({ ...browserOpts });
const report = { url, selector, timestamp: new Date().toISOString(), styles: {}, screenshots: [] };

// --- Layer 1: Computed style extraction (use first width/scheme) ---
const stylePage = await browser.newPage({
  viewport: { width: widths[0], height: 800 },
  colorScheme: schemes[0],
});
await stylePage.goto(url, { waitUntil });

report.styles = await stylePage.evaluate(
  ({ sel, props }) => {
    const el = document.querySelector(sel);
    if (!el) return { error: `Element not found: ${sel}` };
    const computed = window.getComputedStyle(el);
    const result = {};
    for (const prop of props) {
      result[prop] = computed.getPropertyValue(prop);
    }
    const rect = el.getBoundingClientRect();
    result["__boundingBox"] = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    result["__visible"] = el.offsetParent !== null || el.tagName === "DIALOG";
    result["__tagName"] = el.tagName.toLowerCase();
    result["__classList"] = Array.from(el.classList);
    return result;
  },
  { sel: selector, props: CSS_PROPERTIES }
);
await stylePage.close();

// --- Layer 2: Screenshots at each width x scheme ---
for (const scheme of schemes) {
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: 800 },
      colorScheme: scheme,
    });
    await page.goto(url, { waitUntil });
    const filename = `${scheme}-${width}w.png`;
    const filepath = path.join(ssDir, filename);
    await page.screenshot({ path: filepath });
    report.screenshots.push({ scheme, width, path: filepath });
    await page.close();
  }
}

await browser.close();

// --- Output ---
console.log(JSON.stringify(report, null, 2));
