# astro-stack

The foundation for every Astro site built on this stack: the library `@gravitysupport/astro-lib` is the product, and `starter/` is a thin shell that wires it in. This glossary names the stack's components and modules.

## Language

### Packages

**`@gravitysupport/astro-lib`**: The Astro-integration framework for the stack — the integration itself plus the reusable layers it wires together (SCSS foundation + mixins, components, blocks, helpers, config/content schemas, OG support, i18n). Host-agnostic; host wiring lives in adapter packages.

**`@gravitysupport/astro-netlify`**: The Netlify host adapter — `astroNetlify()` integration (bridges Netlify `CONTEXT` → lib `DEPLOY_CONTEXT`), staging-auth edge function, and Netlify context helpers. Optional sibling to the lib; install only when deploying on Netlify.

### Lifecycle & head components

**`Base`**: The bare HTML skeleton component — `<html lang>` plus a `<head>` slot and a `<body>` slot.

**`Seo`**: The component that owns `<head>` tag emission (title, meta, Open Graph, Twitter), driven by `seoConfig`.

**`Schema`**: The JSON-LD emitter component (Article, BreadcrumbList, Organization, WebSite).

**`Analytics`**: The analytics provider tag component, wrapped in Partytown.

**`Favicon`**: The component that emits the standard favicon tag block; agnostic to how the icon files are generated.

### Styling

**Panda**: The build-time styling engine for lib component styles and call-site style objects; it generates static CSS. _Avoid_: CSS-in-JS (runtime), token system (not the stack’s Panda posture).

**recipe**: A Panda definition of a component’s base styles and its variant-prop options.

**`css` prop**: An optional style-object prop on lib components, merged after the recipe so consumer declarations win.

**value prop**: A typed component prop that supplies an open CSS value (usually a length), bridged to a CSS custom property at render time. _Avoid_: continuous prop, knob (as the primary name).

**variant prop**: A typed component prop that picks from a fixed set of options and maps to a recipe variant.

**`componentStyle`**: The shared helper that bridges value props to inline CSS custom properties on the element. Scope is value props only; names follow `--{component}-{prop}`. _Avoid_: knob (as the primary name for this helper).

### Layout components

**`Region`**: The margin-collapse-containment component with a polymorphic semantic element; carries no spacing opinion. _Avoid_: Section

**`Container`**: The width-constraint component — horizontal gutter, vertical rhythm, and alignment; value props become component-scoped CSS vars (e.g. `--container-size`).

**`SiteFrameProvider`**: The top-level positioning context for the site frame; isolates a stacking context and hosts panels.

**`SiteFramePanel`**: An off-canvas panel anchored to a frame edge (start/end/top/bottom), with open/closed state.

### Integration & environment

**`astroLib()` integration**: The lib's default export — the Astro integration that wires rehype, OG middleware, Partytown, sitemap, i18n, and config validation.

**`deployEnv`**: The host-agnostic helper that reads ambient `DEPLOY_CONTEXT` via `astro:env` and exposes `isProd`/`isPreview`/`isLocal` for SSR/build product code. _Avoid_: netlifyEnv (renamed; host binding lives in the adapter).

**`deployContext`**: Pure host-agnostic deploy-class predicates (`production` / `preview` / `local`) shared with edge runtimes that cannot import `astro:env`.

**`astroNetlify()` integration**: The Netlify adapter's default export — registers Netlify `CONTEXT` and bridges it to `DEPLOY_CONTEXT`.

**`edge/staging-auth`**: `createStagingAuth(authConfig)` in `@gravitysupport/astro-netlify` — the fail-closed basic-auth gate for non-production Netlify deploys, password from `STAGING_AUTH_PASSWORD`.

**`rehypeExternalLinks`**: The integration-wired rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG pipeline

**`og/renderer`**: The Satori + satori-html pipeline that renders OG images.

**`og/cache`**: The content-hash-keyed PNG cache for generated OG images.

**`og/resolver`**: The mapper from a request path to its template entry in `ogConfig.pages`.
