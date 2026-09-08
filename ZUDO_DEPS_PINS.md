# ZUDO_DEPS_PINS

Provenance for artifacts vendored or generated from first-party (takazudo/zudolab) upstreams.
Updated by /dev-bump-zudo-deps on every sync — keep `pinned:` accurate.

## create-zudo-doc scaffold
- repo: zudolab/zudo-doc
- what: generated doc-site scaffold, selectively customized and drift-gated
- files: pages/docs/[[...slug]].tsx, pages/index.tsx, pages/[locale]/docs/[[...slug]].tsx, public/favicon-16x16.png, public/favicon-32x32.png, public/favicon.ico, public/favicon.svg, scripts/check-links.js, scripts/setup-doc-skill.sh, src/styles/global.css, tsconfig.json
- source: packages/create-zudo-doc/templates/base/ -> repo root; packages/create-zudo-doc/templates/features/i18n/files/ -> repo root
- track: releases
- pinned: 987b703057f5fb338068c1790399a184c8eebb93 (v5.19.1)
- updated: 2026-09-08
- notes: Preserve the two doc-history route patches, host branding in global.css, and the explicit test-wisdom setup-skill argument; every intentional divergence is documented in .template-drift-allowlist, while non-allowlisted files must match the scaffold exactly. The former check-links.js unquoted-attribute patch retired at this sync: 5.19.1 handles unquoted attributes, HTML entity decoding and protocol-relative hrefs natively and still rejects escaped demo markup (zudolab/zudo-doc#3720 closed upstream), so scripts/check-links.js now tracks the template verbatim.
