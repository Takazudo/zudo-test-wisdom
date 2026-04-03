# zudo-test-wisdom

Takazudo's frontend testing strategy guide, built with zudo-doc (Astro, MDX, Tailwind CSS v4).

## Commands

```bash
pnpm dev          # Start Astro dev server
pnpm build        # Build static site to dist/
pnpm preview      # Preview built site
pnpm check        # Astro type checking
pnpm format:md    # Format MDX files
pnpm b4push       # Pre-push validation (format + typecheck + build)
```

## Content Structure

- English (default): `src/content/docs/` -> `/docs/...`
- Japanese: `src/content/docs-ja/` -> `/ja/docs/...`
- Japanese docs mirror the English directory structure

**Bilingual rule**: When creating or updating any doc page, ALWAYS update both the English (`docs/`) and Japanese (`docs-ja/`) versions in the same PR. Keep code blocks identical between languages -- only translate surrounding prose.

**Exception**: Pages with `generated: true` in frontmatter (e.g., claude-resources auto-generated pages) do not require Japanese translations.

## Content Categories

Top-level directories under `src/content/docs/`. Directories with header nav entries are mapped via `categoryMatch` in `src/config/settings.ts`:

- `overview/` - Introduction and purpose of the testing guide
- `testing-levels/` - The 5 testing levels from unit to visual verification
- `decision-guide/` - Which level to use, common failure patterns, required behaviors
- `real-world-patterns/` - Vitest patterns, Playwright E2E, Tauri app testing
- `tools-reference/` - Quick reference of tools per testing level

Auto-generated directories (no header nav entry, managed by claude-resources integration):

- `claude-md/` - CLAUDE.md file documentation (`noPage: true`)
- `claude-skills/` - Claude Skills documentation (`noPage: true`)

## Writing Docs

All documentation files use `.mdx` format with YAML frontmatter.

### Frontmatter Fields

Schema defined in `src/content.config.ts`:

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

## Doc Skill (test-wisdom)

The `test-wisdom` skill (`.claude/skills/test-wisdom/SKILL.md`) is **generated** by `pnpm setup:doc-skill` (runs `scripts/setup-doc-skill.sh`). It is gitignored -- do NOT track it in git or edit it directly.

## Typography

- Futura for page h1 titles and header site name (`font-futura` class)
- Noto Sans JP for body text
- Headings use font-weight 400 (normal), not bold

## Site Config

- Base path: `/pj/zudo-test-wisdom`
- Settings: `src/config/settings.ts`

## CI/CD

- PR checks: typecheck + build + Cloudflare Pages preview
- Main deploy: build + Cloudflare Pages production + IFTTT notification
- Secrets: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, IFTTT_PROD_NOTIFY
