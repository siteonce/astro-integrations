# astro-stack

The foundation for every Astro site built on this stack: the library `@gravitysupport/astro-lib` is the product, and `starter/` is a thin shell that wires it in. This glossary names the stack's components and modules.

## Language

### Lifecycle & head components

**`Base`**: The bare HTML skeleton component — `<html lang>` plus a `<head>` slot and a `<body>` slot.

**`Seo`**: The component that owns `<head>` tag emission (title, meta, Open Graph, Twitter), driven by `seoConfig`.

**`Schema`**: The JSON-LD emitter component (Article, BreadcrumbList, Organization, WebSite).

**`Analytics`**: The analytics provider tag component, wrapped in Partytown.

**`Favicon`**: The component that emits the standard favicon tag block; agnostic to how the icon files are generated.

### Layout components

**`componentStyle`**: The helper that turns typed component props into an inline `--ab-{component}--{name}` custom-property string.

**`Region`**: The margin-collapse-containment component with a polymorphic semantic element; carries no spacing opinion. _Avoid_: Section

**`Container`**: The width-constraint component — horizontal gutter, vertical rhythm, and alignment; value props become `--ab-container--*` CSS vars.

**`SiteFrameProvider`**: The top-level positioning context for the site frame; isolates a stacking context and hosts panels.

**`SiteFramePanel`**: An off-canvas panel anchored to a frame edge (start/end/top/bottom), with open/closed state.

### Integration & environment

**`astroLib()` integration**: The lib's default export — the Astro integration that wires rehype, OG middleware, Partytown, sitemap, i18n, and config validation.

**`netlifyEnv`**: The helper that reads the ambient Netlify `CONTEXT` via `astro:env` and exposes `isProd`/`isPreview`/`isLocal` predicates for SSR/build code.

**`netlifyContext`**: The runtime-agnostic deploy-context predicates shared with the edge runtime, which cannot import `astro:env`.

**`edge/staging-auth`**: `createStagingAuth(authConfig)` — the fail-closed basic-auth gate for non-production Netlify deploys, password from `STAGING_AUTH_PASSWORD`.

**`rehypeExternalLinks`**: The integration-wired rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG pipeline

**`og/renderer`**: The Satori + satori-html pipeline that renders OG images.

**`og/cache`**: The content-hash-keyed PNG cache for generated OG images.

**`og/resolver`**: The mapper from a request path to its template entry in `ogConfig.pages`.
