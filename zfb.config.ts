import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

// zudo-doc v4 single-entry config. `zudoDoc()` shallow-merges these fields over
// the package defaults and returns a complete ZfbConfig (framework, tailwind,
// collections, plugins, markdown, package-owned routes are all supplied
// internally — the host sets only what differs from the defaults). Fields left
// at their documented @default (colorScheme/colorMode, base "/", mermaid,
// docsDir, defaultLocale "en", tocMin/MaxDepth, packageOwnedRoutes, port 4321,
// directives/buildDocsSchema/translations/colorSchemes) are intentionally omitted.
export default defineConfig(
  zudoDoc({
    siteName: "zudo-test-wisdom",
    siteDescription:
      "Takazudo's frontend testing strategy guide for AI agents and developers",
    githubUrl: "https://github.com/Takazudo/zudo-test-wisdom",
    siteUrl: "https://zudo-test-wisdom.takazudomodular.com",
    // Deploy target: Cloudflare Workers static assets (wrangler.toml `main`
    // points at dist/_worker.js). REQUIRED — the default is a pure static build
    // that emits no _worker.js, which would break `wrangler deploy`.
    adapter: "@takazudo/zfb-adapter-cloudflare",
    // Wide home grid on `/` and every locale home. Replaces the former
    // host-reconstructed pages/index.tsx + pages/[locale]/index.tsx, which
    // existed only because zudo-doc 4.2.1 had no toggle (zudo-doc#2959);
    // 4.4.x added `home.wide`, so the package-owned routes are used again.
    home: { wide: true },
    locales: {
      ja: { label: "JA", dir: "src/content/docs-ja" },
    },
    metaTags: {
      description: true,
      keywords: "",
      ogImage: "/img/ogp.png",
      ogSiteName: true,
      twitterCard: "summary_large_image",
      twitterCreator: "@Takazudo",
    },
    // Noto Sans JP webfont for JA + Latin body text. Emitted as real <head>
    // links (preconnect + async stylesheet); global.css points --font-sans at
    // it. Never load the font via CSS @import — Tailwind v4 bundling can push
    // it past the first style rule and the browser silently drops it.
    head: {
      preconnect: [
        { href: "https://fonts.googleapis.com" },
        { href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
      ],
      stylesheets: [
        {
          href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
          async: true,
        },
      ],
    },
    llmsTxt: true,
    cjkFriendly: true,
    sidebarResizer: true,
    sidebarToggle: true,
    imageEnlarge: true,
    docHistory: true,
    bodyFootUtilArea: {
      docHistory: true,
      viewSourceLink: false,
    },
    claudeResources: {
      claudeDir: ".claude",
    },
    defaultLocaleOnlyPrefixes: [
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-agents/",
      "/docs/claude-commands/",
    ],
    footer: {
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/">zudo-doc</a>. Enjoy synth on <a href="https://takazudomodular.com/">Takazudo Modular</a>.`,
    },
    headerNav: [
      { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
      { label: "Testing Levels", path: "/docs/testing-levels", categoryMatch: "testing-levels" },
      { label: "Decision Guide", path: "/docs/decision-guide", categoryMatch: "decision-guide" },
      { label: "Patterns", path: "/docs/real-world-patterns", categoryMatch: "real-world-patterns" },
      { label: "Tools", path: "/docs/tools-reference", categoryMatch: "tools-reference" },
      { label: "Claude", path: "/docs/claude", categoryMatch: "claude" },
    ],
    headerRightItems: [
      { type: "component", component: "github-link" },
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
      { type: "component", component: "language-switcher" },
    ],
  }),
);
