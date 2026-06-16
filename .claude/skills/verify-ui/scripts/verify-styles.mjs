#!/usr/bin/env node

// Extracts computed styles, bounding box, and captures screenshots for a target element.
// Usage: node verify-styles.mjs <URL> <SELECTOR> [SCREENSHOT_DIR] [WIDTHS] [SCHEMES]
//
// Examples:
//   node verify-styles.mjs "http://localhost:4321/" "dialog"
//   node verify-styles.mjs "http://localhost:4321/" ".card" "./screenshots" "400,800,1200" "light,dark"
//
// Playwright must be importable. The script tries common locations.

async function findPlaywright() {
  // Try project node_modules first (pnpm stores in .pnpm/)
  const { execSync } = await import("node:child_process");
  try {
    const result = execSync(
      'find node_modules/.pnpm -name "playwright-core" -type d -maxdepth 4 2>/dev/null | head -1',
      { encoding: "utf-8" }
    ).trim();
    if (result) {
      const mod = await import(`${process.cwd()}/${result}/index.mjs`);
      return mod;
    }
  } catch {}
  // Try direct import
  try {
    return await import("playwright-core");
  } catch {}
  try {
    return await import("playwright");
  } catch {}
  console.error(
    "Error: playwright-core not found. Install it in the project or globally."
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

if (!url || !selector) {
  console.error("Usage: node verify-styles.mjs <URL> <SELECTOR> [SS_DIR] [WIDTHS] [SCHEMES]");
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
await stylePage.goto(url, { waitUntil: "networkidle" });

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
    await page.goto(url, { waitUntil: "networkidle" });
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
