# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 50cbd5c6c9e5a795d72a74a855e105e4939d4eab (v5.27.0)
- updated: 2026-09-25
- notes: Preserve the two doc-history route patches, host branding in global.css, and the explicit test-wisdom setup-skill argument. The 5.26.2 published template contains the Bash 3.2/config-locale/locale-existence fixes in setup-doc-skill.sh and the quoted-attribute/single-pass scans plus escaped-MDX-tag fix in check-links.js; both scripts now match it exactly and their allowlist entries are removed. 5.27.0 changed only check-links.js (heading-ID targets now come from `extractAllHeadingIds`, covering h5/h6 and escaped punctuation/code spans); adopted verbatim after the unquoted-href/id and escaped-serialized-markup fixtures in scripts/check-links.test.mjs passed against it. Only the routes and global.css remain intentional divergences in .template-drift-allowlist. Non-allowlisted files must match the scaffold exactly.
