# `@gravitysupport/astro-og-image` — OG image generator

Optional Open Graph image generation for the stack. Universal OG metadata stays in `@gravitysupport/astro-lib`; this package owns generator mechanics, while consumers own generation config, fonts, templates, and branding.

## Architecture

- **`astroOgImage()`** validates config, exposes consumer templates and public Astro route metadata through Vite, and injects the configured raw-PNG namespace.
- **Route resolution** is shared by build enumeration, dev requests, gallery/preview tooling, and `ogImageFor()`: exact route, matching dynamic pattern, then `"*"`.
- **Renderer** is Satori to Sharp with public-image inlining and an internal content-hash cache. The package bundles no fonts.
- **Template contract** is `OgContext`, the minimal JSX runtime, and project-authored templates in `src/og-templates/`.

## Constraints

- Dependency direction is `astro-og-image` → `astro-lib`, never the reverse.
- Use Astro's public resolved-route metadata. Discover only project-owned HTML pages; ignore endpoints, redirects, fallback routes, and integration-owned routes.
- Never infer dynamic collections from URL segments or use private APIs to inspect `getStaticPaths()`. Included dynamic patterns name their collection explicitly; exact `false` exclusions still win for concrete paths.
- The `"*"` rule covers discovered pages, not arbitrary requests. Undiscovered, excluded, and unknown PNG paths return 404.
- Consumers must configure at least one `.woff`, `.ttf`, or `.otf` font. Reject missing files, unsupported extensions, and `.woff2` during startup.
- Templates receive all render-specific state through `OgContext`; they never read request globals.
- Statically resolvable configuration, template, font, and background failures abort startup. Missing template image assets degrade to a logged blank slot during rendering.
- Dev renders raw PNGs on request and injects HTML gallery/preview routes. Build prerenders PNGs only; Astro preview and static production hosts serve those emitted files.
- Cache keys cover the page path, template source and config, locale, validated entry data, site config, font registry, and package version.

## Out of scope

- Emitting `og:*` or `twitter:*` tags; `Seo` in core owns those.
- Host-specific image services or SSR adapters.
- Project branding, font selection, and template layout; those stay in the starter.
