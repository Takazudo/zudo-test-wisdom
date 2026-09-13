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
    // The `/sitemap.xml` route is registered unconditionally by the package;
    // this flag is what populates it with real <url> entries (instead of an
    // empty <urlset>) and adds the `Sitemap:` line to robots.txt.
    sitemap: true,
    // This site's own home-hero brand mark, rendered as a theme-adaptive CSS
    // mask. REQUIRED — zudo-doc's `logo` default is "auto", which generates a
    // deterministic SVG seeded by `siteName` and silently displaces the host's
    // own asset (zudo-doc 4.4.0+). Omitting this does not fail the build.
    logo: "/img/logo.svg",
    // Deploy target: Cloudflare Workers static assets (wrangler.toml `main`
    // points at dist/_worker.js). REQUIRED — the default is a pure static build
    // that emits no _worker.js, which would break `wrangler deploy`.
    adapter: "@takazudo/zfb-adapter-cloudflare",
    // Wide home grid on `/` and every locale home. Replaces the former
    // host-reconstructed pages/index.tsx + pages/[locale]/index.tsx, which
    // existed only because zudo-doc 4.2.1 had no toggle (zudo-doc#2959);
    // 4.4.x added `home.wide`, so the package-owned routes are used again.
    home: {
      wide: true,
      introMarkdown: `zudo-test-wisdom is Takazudo's frontend testing strategy guide for AI coding agents and the developers who review their work. It collects practical lessons from real projects to help you decide what to test and how to verify a change.

The guide covers six testing levels, from unit tests to AI-based visual verification as a last resort. Use the decision guide to choose the level a change needs, and the test integrity articles to spot flaky tests, false greens, and tests that merely agree with the implementation.

Install the \`test-wisdom\` Claude Code skill from this repository with \`pnpm setup:doc-skill\`, then use \`/test-wisdom <topic>\` to find relevant articles during development. The bundled \`verify-ui\` and \`headless-browser\` skills help check computed styles, screenshots, and browser interactions.

- [Overview](/docs/overview/) — the guide's purpose, audience, and skill setup.
- [Testing Levels](/docs/testing-levels/) — what each level can verify and when to move beyond it.
- [Decision Guide](/docs/decision-guide/) — choose a testing level and decide where and when to run tests.
- [Test Integrity](/docs/test-integrity/) — recognize misleading passes and keep tests trustworthy.`,
    },
    locales: {
      ja: {
        label: "JA",
        dir: "src/content/docs-ja",
        description:
          "AIエージェントと開発者に向けた、Takazudoのフロントエンドテスト戦略ガイド",
        introMarkdown: `zudo-test-wisdomは、Takazudoがまとめたフロントエンドのテスト戦略ガイドです。AIコーディングエージェントと、その成果をレビューする開発者に向けて、実際のプロジェクトで得た知見をもとに、何をテストし、変更をどう検証するかを紹介します。

ユニットテストから、最終手段としてのAIによる視覚検証までを6つのテストレベルに整理し、判断ガイドで変更内容に合ったレベルの選び方を紹介します。フレイクや偽グリーン、実装と同じ思い込みをなぞるだけの「自己一致」など、テストの信頼性を損なう落とし穴も解説します。

Claude Code用の\`test-wisdom\`スキルは、このリポジトリで\`pnpm setup:doc-skill\`を実行すると導入できます。開発中に\`/test-wisdom <topic>\`で関連記事を参照でき、同梱の\`verify-ui\`と\`headless-browser\`で計算済みスタイルやスクリーンショット、ブラウザ上の操作を確認できます。

- [概要](/ja/docs/overview/) — ガイドの目的と対象読者、スキルの導入方法
- [テストレベル](/ja/docs/testing-levels/) — 各レベルで確認できることと、検証を一段進めるタイミング
- [判断ガイド](/ja/docs/decision-guide/) — テストレベルの選び方と、テストを実行する場所・タイミング
- [テスト完全性](/ja/docs/test-integrity/) — 見かけの成功に惑わされず、テストの信頼性を保つための考え方`,
      },
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
      // Keeps the hand-maintained JA stub (src/content/docs-ja/claude/index.mdx)
      // authoritative for /ja/docs/claude/ -- without this, zudo-doc's claude-resources
      // generator (5.14.0+) tries to overwrite it and throws since it lacks `generated: true`.
      "/docs/claude/",
    ],
    footer: {
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/">zudo-doc</a>. Enjoy synth on <a href="https://takazudomodular.com/">Takazudo Modular</a>.`,
    },
    headerNav: [
      { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
      { label: "Testing Levels", path: "/docs/testing-levels", categoryMatch: "testing-levels" },
      { label: "Decision Guide", path: "/docs/decision-guide", categoryMatch: "decision-guide" },
      { label: "Tool Patterns", path: "/docs/tool-patterns", categoryMatch: "tool-patterns" },
      { label: "Project Recipes", path: "/docs/project-recipes", categoryMatch: "project-recipes" },
      { label: "CI Operations", path: "/docs/ci-operations", categoryMatch: "ci-operations" },
      { label: "Test Integrity", path: "/docs/test-integrity", categoryMatch: "test-integrity" },
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
