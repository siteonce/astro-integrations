# src/content — content collections

Collection schemas: `src/content.config.ts`. Editorial media is a URL in frontmatter.

## Conventions

- Pair locales: `en` / `de` entries share `id` and each carry `locale` (MDX or TS). Routed entries also carry `slug`. Authors are translated records (`id` + `locale`, no slug, not routed).
- Compose `seo` + `media` (or import `blog`); per-project extras `.extend()`. Add intl `id` / `locale` / `slug` fragments on localized entries. Do not redefine the shared field list in the app.
- `pageType` is **starter** convention on pages (`home`, `listing`). **intl** does not know **page types** or collection roles.
- **Term pages** are a routed collection (`id` + `locale` + `slug`), not locale-free JSON. Do not revive `blog-tags.json`.
- Co-located images are demo-only so preview needs no cloud account; live editorial media is a URL.
