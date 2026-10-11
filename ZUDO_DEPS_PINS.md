# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: b4f974598b27064a092eeadb5b2e5559078a8bb9 (v6.0.0; create-zudo-doc@6.0.0)
- updated: 2026-10-11
- notes: Reconciled all 11 files against the published create-zudo-doc 6.0.0 templates and verified registry gitHead against the upstream v6.0.0 tag. Adopt the zudo-react route types, Preact-free tsconfig and zudo-wind CSS entry. Preserve the explicit DocHistoryBoundary bindings on both routes, the futura-editorial Japanese font fallback, brand assets, and the explicit test-wisdom setup-skill argument. All remaining tracked templates (including check-links.js and setup-doc-skill.sh) are unchanged upstream. Typecheck, build, all 10 b4push gates, and browser checks passed.
