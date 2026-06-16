#!/usr/bin/env node

/**
 * Lightweight Headless Browser Checker
 *
 * A token-efficient webpage checker that captures essential information
 * without the overhead of full MCP Playwright.
 *
 * Features:
 * - Headless Chromium via Playwright
 * - Compact JSON output with size limits
 * - Console error detection
 * - Network error tracking
 * - Optional screenshot capture
 * - Resource blocking for faster loads
 *
 * Usage:
 *   node scripts/headless-check.js --url https://example.com
 *   node scripts/headless-check.js --url https://example.com --screenshot viewport
 *   echo '{"url":"https://example.com"}' | node scripts/headless-check.js
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
// Dynamic import to handle symlinked skill directories — relative paths
// resolve against the symlink target, not $HOME/.claude/
const { getLogDir } = await import(
  new URL(`file://${path.join(os.homedir(), '.claude', 'scripts', 'get-logdir.js')}`).href
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Version
const API_VERSION = 'v1';
const SKILL_VERSION = '1.0.0';

// Default configuration
const DEFAULT_CONFIG = {
  timeoutMs: 15000,
  waitUntil: 'networkidle',
  captureScreenshot: 'none', // 'none' | 'viewport' | 'full'
  javascriptEnabled: true,
  blockResources: true,
  maxConsoleEntries: 20,
  maxFailedRequests: 10,
  maxTextLength: 512,
  userAgent: null,
  viewport: { width: 1280, height: 720 },
};

/**
 * Parse command line arguments and stdin
 */
async function parseInput() {
  const args = process.argv.slice(2);

  // Try to parse stdin if available
  if (!process.stdin.isTTY) {
    try {
      const stdin = await new Promise((resolve, reject) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
        setTimeout(() => resolve(null), 100);
      });

      if (stdin) {
        return JSON.parse(stdin);
      }
    } catch (error) {
      console.error('Failed to parse stdin JSON:', error.message);
    }
  }

  // Parse CLI arguments
  const config = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--url' && nextArg) {
      config.url = nextArg;
      i++;
    } else if (arg === '--timeout' && nextArg) {
      config.timeoutMs = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--wait-until' && nextArg) {
      config.waitUntil = nextArg;
      i++;
    } else if (arg === '--screenshot' && nextArg) {
      config.captureScreenshot = nextArg;
      i++;
    } else if (arg === '--no-javascript') {
      config.javascriptEnabled = false;
    } else if (arg === '--no-block-resources') {
      config.blockResources = false;
    } else if (arg === '--user-agent' && nextArg) {
      config.userAgent = nextArg;
      i++;
    }
  }

  return config;
}

/**
 * Truncate text to max length
 */
function truncateText(text, maxLength = DEFAULT_CONFIG.maxTextLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

/**
 * Collapse duplicate console messages
 */
function collapseConsoleMessages(logs, maxEntries) {
  const collapsed = new Map();

  for (const log of logs) {
    const key = `${log.type}:${log.text}`;
    if (collapsed.has(key)) {
      collapsed.get(key).count++;
    } else {
      collapsed.set(key, { ...log, count: 1 });
    }
  }

  const result = Array.from(collapsed.values())
    .slice(0, maxEntries)
    .map((log) => ({
      type: log.type,
      text: truncateText(log.text),
      count: log.count,
    }));

  return {
    entries: result,
    total: logs.length,
    truncated: logs.length > maxEntries,
  };
}

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

// Print resolved opts when BROWSER_RESOLVER_DEBUG is set (for path-logic testing without a real launch)
if (process.env.BROWSER_RESOLVER_DEBUG) {
  const opts = await resolveBrowserOpts();
  console.log(JSON.stringify({ resolvedBrowserOpts: opts }));
  process.exit(0);
}

/**
 * Check a single URL
 */
async function checkUrl(url, config) {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  let browser = null;
  let context = null;
  let page = null;

  try {
    // Launch browser
    const browserOpts = await resolveBrowserOpts();
    browser = await chromium.launch({
      headless: true,
      timeout: mergedConfig.timeoutMs,
      ...browserOpts,
    });

    // Create context
    const contextOptions = {
      ignoreHTTPSErrors: true,
      viewport: mergedConfig.viewport,
      javaScriptEnabled: mergedConfig.javascriptEnabled,
    };

    if (mergedConfig.userAgent) {
      contextOptions.userAgent = mergedConfig.userAgent;
    }

    context = await browser.newContext(contextOptions);
    page = await context.newPage();

    // Collectors
    const consoleLogs = [];
    const pageErrors = [];
    const failedRequests = [];
    let blockedCount = 0;

    // Block heavy resources if requested
    if (mergedConfig.blockResources) {
      await page.route(
        '**/*.{png,jpg,jpeg,gif,webp,svg,ico,mp4,webm,woff,woff2,ttf,eot}',
        (route) => {
          blockedCount++;
          route.abort();
        },
      );
    }

    // Collect console messages
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect page errors
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: truncateText(err.message),
        stack: truncateText(err.stack),
      });
    });

    // Collect failed requests
    page.on('requestfailed', (request) => {
      if (failedRequests.length < mergedConfig.maxFailedRequests) {
        failedRequests.push({
          url: request.url(),
          method: request.method(),
          error: request.failure()?.errorText || 'Unknown error',
        });
      }
    });

    // Navigate to page
    const response = await page.goto(url, {
      timeout: mergedConfig.timeoutMs,
      waitUntil: mergedConfig.waitUntil,
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Get basic page info
    const title = await page.title();
    const finalUrl = page.url();
    const statusCode = response?.status() || null;

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const perfData = window.performance.timing;
      return {
        domContentLoadedMs:
          perfData.domContentLoadedEventEnd - perfData.navigationStart,
        loadMs: perfData.loadEventEnd - perfData.navigationStart,
      };
    });

    // Capture screenshot if requested
    let screenshot = null;
    if (mergedConfig.captureScreenshot !== 'none') {
      const screenshotBuffer = await page.screenshot({
        fullPage: mergedConfig.captureScreenshot === 'full',
        type: 'png',
      });

      // Save to temp file in current working directory
      const tempDir = path.join(getLogDir(), 'headless-screenshots');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(tempDir, filename);

      fs.writeFileSync(filepath, screenshotBuffer);

      screenshot = {
        path: filepath,
        bytes: screenshotBuffer.length,
      };
    }

    const duration = Date.now() - startTime;

    // Process console logs
    const console = collapseConsoleMessages(
      consoleLogs,
      mergedConfig.maxConsoleEntries,
    );

    // Determine if there are errors
    const hasErrors =
      pageErrors.length > 0 ||
      console.entries.some((log) => log.type === 'error');

    // Build result
    return {
      apiVersion: API_VERSION,
      skillVersion: SKILL_VERSION,
      url,
      finalUrl,
      title,
      statusCode,
      durationMs: duration,
      hasErrors,
      console,
      pageErrors: pageErrors.slice(0, 10), // Limit to 10
      networkErrors: {
        failedRequests,
        totalFailed: failedRequests.length,
        blockedCount,
      },
      metrics,
      screenshot,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      apiVersion: API_VERSION,
      skillVersion: SKILL_VERSION,
      url,
      error: {
        message: truncateText(error.message),
        stack: truncateText(error.stack),
      },
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } finally {
    // Cleanup
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const input = await parseInput();

    if (!input || !input.url) {
      console.error('Error: URL is required');
      console.error(
        'Usage: node scripts/headless-check.js --url https://example.com',
      );
      console.error(
        '   or: echo \'{"url":"https://example.com"}\' | node scripts/headless-check.js',
      );
      process.exit(1);
    }

    console.error(`🔍 Checking: ${input.url}`);

    const result = await checkUrl(input.url, input);

    // Output JSON to stdout
    console.log(JSON.stringify(result, null, 2));

    // Log summary to stderr
    if (result.error) {
      console.error(`❌ Error: ${result.error.message}`);
      process.exit(1);
    } else {
      console.error(`✅ Completed in ${result.durationMs}ms`);
      console.error(`   Title: ${result.title}`);
      console.error(`   Status: ${result.statusCode}`);
      console.error(`   Console entries: ${result.console.total}`);
      console.error(`   Page errors: ${result.pageErrors.length}`);
      console.error(`   Failed requests: ${result.networkErrors.totalFailed}`);
      if (result.screenshot) {
        console.error(`   Screenshot: ${result.screenshot.path}`);
      }
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Execute
main();
