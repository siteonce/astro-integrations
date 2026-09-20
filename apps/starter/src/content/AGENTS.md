# src/content — content collections

Collection schemas: `src/content.config.ts`. Editorial media is a URL in frontmatter.

## Conventions

- Pair locales: one folder per translation group (`blog/hello-world/{en,de}.mdx`). Pairing `id` is generated (`blog/hello-world`); do not author `id` in frontmatter. Routed entries carry `locale` + `slug` (the public tail after the locale). `slug` is a mapped **section** plus one slugified rest segment (no `/` in the rest). Authors are translated records (`locale` + `name`, no slug, not routed).
- Compose `seo` + `media` (or import `blog`); per-project extras `.extend()`. Add intl `locale` / `slug` fragments on localized file entries. Do not redefine the shared field list in the app.
- `pageType` is **starter** convention on pages (`home`, `listing`). **intl** does not know **page types** or collection roles.
- **Term pages** are a routed collection (`locale` + `slug`), not locale-free JSON. Do not revive `blog-tags.json`.
- Co-located images are demo-only so preview needs no cloud account; live editorial media is a URL.
