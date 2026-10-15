# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 82049856397927077c5288465db34e44d0939260 (v7.0.0; published create-zudo-doc@7.0.0)
- updated: 2026-10-15
- notes: Three-way reconciled published 5.28.1 and 7.0.0 templates against the host; registry attestation identifies the v7.0.0 source commit above. Preserve the standard DocHistoryBoundary feature patches in both route stubs, the futura-editorial Noto Sans JP fallback in global.css and its head font links, and the explicit test-wisdom setup-skill argument. Routes and global.css are the only intentional template divergences; tsconfig matches 7.0.0. Unchanged scripts, favicon assets and home route remain byte-identical to both releases. Local frozen install, typecheck, template drift, pins, category metadata, link regression tests, MDX formatting and Wind audit passed on Node 24; full build/b4push and browser acceptance are coordinated separately before integration.
