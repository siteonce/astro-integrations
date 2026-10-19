---
id: translate-a-post
locale: en
slug: translate-a-post
pubDate: 2026-01-15
status: published
seoTitle: Translate a post
seoDesc: How a German sibling joins an English post — one shared id, its own slug, and the section from the route row.
# Co-located so the demo renders offline.
featImage: ./feat.png
featImageAlt: Placeholder feature image.
tags:
  - engineering
source: intl
excerpt: Give the translation the same id, its own locale and slug, and intl pairs the two.
---

# Translate a post

Each post is a folder with one file per locale. The files share the pairing `id` in their frontmatter. `locale` says which sibling a file is, and `slug` is its one public segment.

```yaml
# src/content/posts/translate-a-post/de.md
id: translate-a-post
locale: de
slug: beitrag-uebersetzen
```

The section in front of the slug comes from the route row in `src/routes.config.ts`, not from the entry. This post is `/blog/translate-a-post/` in English and `/de/artikel/beitrag-uebersetzen/` in German.

Intl pairs the two files on `id`. The locale switcher links each one to its sibling, and the sitemap lists both with their alternates. An English post with no German file gets the fallback view at its German URL, and the demo's fallback view redirects to the English post.
