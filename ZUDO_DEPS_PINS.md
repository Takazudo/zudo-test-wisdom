# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 7151a5f58dd78de9c0720e0efb1c4496a951d85a (v5.28.1)
- updated: 2026-09-28
- notes: Preserve the two doc-history route patches, host branding in global.css, and the explicit test-wisdom setup-skill argument. The 5.28.1 scaffold has no additional drift from these local files; `check:template-drift` confirms all non-allowlisted files match, and `test:links` confirms unquoted href/id and escaped serialized markup remain handled. Only the routes and global.css remain intentional divergences in .template-drift-allowlist.
