# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: a4024eb58058eaa5d5d3299c71ded219dc4df798 (v5.22.1)
- updated: 2026-09-13
- notes: Preserve the two doc-history route patches, host branding in global.css, the explicit test-wisdom setup-skill argument, and the Bash 3.2/config-locale/locale-existence fixes in setup-doc-skill.sh plus the quoted-attribute and single-pass scans in check-links.js; the 5.22.1 published template does not contain those fixes, so they remain intentional divergences documented in .template-drift-allowlist. Non-allowlisted files must match the scaffold exactly.
