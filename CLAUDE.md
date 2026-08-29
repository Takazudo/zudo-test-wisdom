# zudo-test-wisdom

Takazudo's frontend testing strategy guide, built with zudo-doc (zfb stack, MDX, Tailwind CSS v4).

## Commands

```bash
pnpm dev              # Start zfb dev server (4321) + doc-history server (4322)
pnpm build            # Build static site via zfb build
pnpm preview          # Preview built site
pnpm check            # zfb type checking
pnpm format:md        # Format MDX files
pnpm b4push           # Pre-push validation (format + drift + pins + typecheck + build + html + links)
pnpm setup:doc-skill  # Generate test-wisdom skill + symlink all skills
```

## Content Structure

- English (default): `src/content/docs/` -> `/docs/...`
- Japanese: `src/content/docs-ja/` -> `/ja/docs/...`
- Japanese docs mirror the English directory structure

**Bilingual rule**: When creating or updating any doc page, ALWAYS update both the English (`docs/`) and Japanese (`docs-ja/`) versions in the same PR. Keep code blocks identical between languages -- only translate surrounding prose. Executable code blocks stay byte-identical between EN and JA; display-only text inside diagrams (mermaid node/edge labels, tree-diagram comments) may be translated.

**Exception**: Pages with `generated: true` in frontmatter (e.g., claude-resources auto-generated pages) do not require Japanese translations.

## Content Categories

Top-level directories under `src/content/docs/`. Directories with header nav entries are mapped via `categoryMatch` in the `headerNav` list in `zfb.config.ts`:

- `overview/` - Introduction and purpose of the testing guide
- `testing-levels/` - The 6 testing levels from unit to AI-based verification
- `decision-guide/` - Which level to use, common failure patterns, required behaviors
- `tool-patterns/` - Patterns organized around a specific tool, not a project shape (Vitest, Playwright, visual regression, browser-in-container verification, cargo-nextest)
- `project-recipes/` - Patterns organized around a repo/project shape, not a single tool (backend, Tauri, remark/rehype plugins, built-site integrity)
- `ci-operations/` - Running suites across CI, deploys, and releases (environment-tiered testing, smoke tests, scheduled re-exam, branch strategy, publishing, runner sizing, CI-skip markers and merge hygiene)
- `test-integrity/` - Ways tests deceive (flakes, false greens, self-agreement, fixture traps) and the discipline preventing them
- `tools-reference/` - Quick reference of tools per testing level

Auto-generated directories (no header nav entry, managed by claude-resources integration):

- `claude-md/` - CLAUDE.md file documentation (`noPage: true`)
- `claude-skills/` - Claude Skills documentation (`noPage: true`)

## Writing Docs

All documentation files use `.mdx` format with YAML frontmatter.

### Frontmatter Fields

Schema is the zudo-doc package default (shipped by `@takazudo/zudo-doc`; override via `buildDocsSchema` in `zfb.config.ts` if ever needed):

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Page title, rendered as the page h1 |
| `description` | string | No | Subtitle displayed below the title |
| `sidebar_position` | number | No | Sort order within category (lower = higher). Always set this for predictable ordering |
| `sidebar_label` | string | No | Custom text for sidebar display (overrides `title`) |
| `generated` | boolean | No | Build-time generated content (skip translation) |

### Content Rules

- **No h1 in content**: The frontmatter `title` is automatically rendered as the page h1. Start your content with `## h2` headings.
- **Always set `sidebar_position`**: Without it, pages sort alphabetically which is unpredictable.
- **Kebab-case file names**: Use `my-article.mdx`, not `myArticle.mdx`.
- **No body `hr`** (`---`) in MDX content. A separator that marks a real topic shift should be expressed with heading structure instead (see the deflaking-recipe restructure). (auto-generated pages — claude-md/, claude-skills/, and any `generated: true` page — are exempt: they may contain `---` inside embedded examples and must never be hand-edited. This excludes `docs-ja/claude/index.mdx`, a hand-maintained locale stub with no `generated: true` marker.)

### Linking Between Docs

Use relative file paths with the `.mdx` extension:

```markdown
[Link text](./sibling-page.mdx)
[Link text](../other-category/page.mdx#anchor)
```

### Admonitions

Available globally without imports: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`

### Navigation Structure

Navigation is filesystem-driven. Directory structure directly becomes sidebar navigation. Pages ordered by `sidebar_position` (ascending). Category index pages (`index.mdx`) control category position.

### Content Creation Workflow

1. Create English `.mdx` file under `src/content/docs/` with `title` and `sidebar_position`
2. Write content starting with `## h2` headings (not `# h1`)
3. Create matching Japanese file under `src/content/docs-ja/`
4. Keep code blocks identical -- only translate prose
5. Run `pnpm format:md` then `pnpm build` to verify

## Skills

This repo contains test-related Claude Code skills under `.claude/skills/`:

- `test-wisdom/` - Doc-lookup skill (**generated** by `pnpm setup:doc-skill`, gitignored -- do NOT track or edit directly)
- `verify-ui/` - Deterministic CSS/computed-style verification (tracked in git)
- `headless-browser/` - Headless browser screenshots and interaction (tracked in git; bundles its own Playwright)

Run `pnpm setup:doc-skill` to generate the test-wisdom skill and symlink it to `~/.claude/skills/` (and `~/.codex/skills/`).

**It also symlinks the tracked skills** (`verify-ui`, `verify-ui-ai`, `headless-browser`) into the same global directory by default — a `create-zudo-doc@5.2.1`+ template feature (`LINK_TRACKED_SKILLS`), pulled in by the Aug-2026 zudo-doc 5.x migration, not something this repo added. `scripts/setup-doc-skill.sh` is a create-zudo-doc **template file** guarded by `pnpm check:template-drift`, so it must not be edited locally: a local edit fails the drift check and is silently overwritten on the next template re-sync. Pass `--no-link-tracked-skills` to skip that step and symlink only the generated skill.

Improving the shared template is an upstream change — see `/dev-upstream-report`.

The `test-wisdom` name is pinned as an explicit `$1` override in the `setup:doc-skill` script entry. The template's deterministic default derives `<packageName>-wisdom` = `zudo-test-wisdom-wisdom`, which is NOT the name `.gitignore` pins — leaving an untracked duplicate skill directory on every run.

**Playwright needs no manual install step.** `headless-browser` bundles Playwright and installs it on demand; `verify-ui` falls back to that bundle, or to its own directory when used standalone. Both self-heal on a fresh machine and retry once — see each skill's SKILL.md. Agents must NOT stop and ask the user to run `npx playwright install`; a missing browser is a setup gap, not a decision.

Both skills are designed to work **standalone** (symlinked or copied without this repo), so each carries its own bootstrap — `headless-browser/scripts/ensure-deps.sh` is the shared, idempotent entry point. Keep them self-sufficient: do not move recovery logic into `setup-doc-skill.sh` only.

One invariant to preserve if you touch the install path: browser downloads must be driven by the **resolved** Playwright package's own `cli.js`, never a bare `npx playwright install`. Each version pins its own browser revisions, so `npx` (which fetches `@latest`) installs a revision the resolved module never looks for — the launch then fails with `Executable doesn't exist` despite a "successful" install.

## Typography

- Futura for page h1 titles and header site name (`font-futura` class)
- Noto Sans JP for body text
- Headings use font-weight 400 (normal), not bold

## Project Layout

zudo-doc 4.x is a thin host shell — all wiring (components, config types,
utils, routes, chrome) lives inside `@takazudo/zudo-doc`, driven by the single
`zudoDoc()` config.

```
pages/                       # Thin route stubs (package-owned routes injected at build)
  index.tsx                  # Home: re-exports @takazudo/zudo-doc/routes/index
  docs/[[...slug]].tsx       # EN doc route stub
  [locale]/docs/[[...slug]].tsx  # JA doc route stub
src/
  content/                   # MDX doc pages (docs/ + docs-ja/)
  styles/global.css          # Package CSS imports + host brand overrides
zfb.config.ts                # The single config file — zudoDoc({ ... })
```

## Site Config

- Base path: `/` (root — no subpath prefix)
- Live URL: `https://zudo-test-wisdom.takazudomodular.com/`
- Settings + build config: `zfb.config.ts` (the single `zudoDoc()` config)

## CI/CD

- PR checks: typecheck + build + Cloudflare Workers static assets preview
- Main deploy: build → `wrangler deploy` → Cloudflare Workers + IFTTT notification
- Hosting: **Cloudflare Workers static assets** (not Pages)
- Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `IFTTT_PROD_NOTIFY`
