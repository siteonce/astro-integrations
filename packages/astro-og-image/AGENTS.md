# `@gravitysupport/astro-og-image` — OG image generator

Optional Open Graph image generation for the stack. Universal OG metadata stays in `@gravitysupport/astro-lib`; this package only produces image files and the metadata props that point to them.

## Scope

- **`astroOgImage()`** — validates generation config, exposes consumer templates through Vite, and injects the prerendered `/og/[...path].png` endpoint.
- **Renderer** — Satori to Sharp, bundled Inter fonts, consumer font loading, public-image inlining, and an internal content-hash cache.
- **Template contract** — `OgContext`, the minimal JSX runtime, and project-authored templates in `src/og-templates/`.
- **`ogImageFor()`** — maps a page pathname to Seo-compatible image props without a manifest.

## Conventions

- Dependency direction is `astro-og-image` → `astro-lib`, never the reverse.
- The endpoint stays inside Astro's module graph. Do not restore filesystem content scans, a build hook, or a route manifest.
- Templates receive all render-specific state through `OgContext`; they never read request globals.
- Statically resolvable configuration and file failures abort startup. Missing template image assets degrade to a logged blank slot during rendering.
- Cache keys cover the page path, template source and config, locale, validated entry data, site config, font registry, and package version.

## Out of scope

- Emitting `og:*` or `twitter:*` tags; `Seo` in core owns those.
- Host-specific image services or SSR adapters.
- Project branding and template layout; those stay in the starter.
