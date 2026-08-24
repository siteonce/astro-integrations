# siteonce-stack

The foundation for every Astro site built on this stack: the library `@siteonce/astro-lib` is the product, and `starter/` is a thin shell that wires it in. This glossary names the stack's components and modules.

## Language

### Packages

**`@siteonce/core`**: Framework-agnostic Panda recipes and pure helpers (resolveOpenState) for portable UI primitives. Imported by both `@siteonce/react` and `@siteonce/astro-lib`.

**`@siteonce/react`**: React implementations of SiteOnce UI primitives (Container, Flow, SiteFrame) — RSC-friendly where applicable. Imports recipes from `@siteonce/core`.

**`@siteonce/astro-lib`**: The core Astro-integration framework for the stack — reusable SCSS, Svelte components, utilities, schemas, OG metadata, and i18n. Svelte components now import recipes from `@siteonce/core` for portability. Optional generators and host wiring live in sibling packages.

**`@siteonce/astro-og-image`**: The optional OG image generator — injected endpoint, Satori-to-Sharp renderer, template contract, fonts, and internal cache. Depends on `astro-lib`; core never depends on it.

**`@siteonce/astro-netlify`**: The Netlify host adapter — `astroNetlify()` integration (bridges Netlify `CONTEXT` → lib `DEPLOY_CONTEXT`), staging-auth edge function, and Netlify context helpers. Optional sibling to the lib; install only when deploying on Netlify.

### Lifecycle & head components

**`BaseLayout`**: The bare HTML skeleton component — `<html lang>` plus a `<head>` slot and a `<body>` slot.

**`Seo`**: The component that owns `<head>` tag emission (title, meta, Open Graph, Twitter), driven by `seoConfig`.

**`Schema`**: The JSON-LD emitter component (Article, BreadcrumbList, Organization, WebSite).

**`Analytics`**: The starter-owned analytics tag component (GA4 via Partytown). Project concern, not a lib export; the lib only registers Partytown when `siteConfig.analytics` is set.

**`Favicon`**: The lib component that emits the standard favicon tag block; agnostic to how the icon files are generated (files live in the consumer’s `public/`).

### Styling

**Panda**: The build-time styling engine for lib component styles and call-site style objects; it generates static CSS. _Avoid_: CSS-in-JS (runtime), token system (not the stack’s Panda posture).

**recipe**: A Panda definition of a component’s base styles and its variant-prop options.

**`css` prop**: An optional style-object prop on lib components, merged after the recipe so consumer declarations win.

**value prop**: A typed component prop that supplies an open CSS value (usually a length), bridged to a CSS custom property at render time. _Avoid_: continuous prop, knob (as the primary name).

**variant prop**: A typed component prop that picks from a fixed set of options and maps to a recipe variant.

**`componentStyle`**: The shared helper that bridges value props to inline CSS custom properties on the element. Scope is value props only; names follow `--{component}-{prop}`. _Avoid_: knob (as the primary name for this helper).

### Layout components

**`Flow`**: The vertical rhythm stack (Root + Item). `Flow.Root` establishes a BFC boundary; `Flow.Item` carries block margin via `blockMargin` prop → `--flow-item-block-margin` CSS var. Replaces `Region` for vertical layout composition. _Avoid_: Region (deprecated; use Flow instead).

**`Container`**: The width-constraint component — horizontal gutter and alignment. Variant props: `width` (measure | wide | full), `gap` (default | flush), `align` (start | center | end). CSS vars: `--container-size`, `--container-gutter`. Vertical rhythm moved to `Flow.Item`.

**`SiteFrameProvider`**: The top-level positioning context for the site frame; isolates a stacking context and hosts panels.

**`SiteFramePanel`**: An off-canvas panel anchored to a frame edge (start/end/top/bottom), with open/closed state.

### Integration & environment

**`astroLib()` integration**: The lib's default export — the Astro integration that wires rehype, Partytown, sitemap, i18n, core config validation, and OG metadata support.

**`astroOgImage()` integration**: The optional generator integration — validates generation config and injects the prerendered OG image endpoint.

**`deployEnv`**: The host-agnostic helper that reads ambient `DEPLOY_CONTEXT` via `astro:env` and exposes `isProd`/`isPreview`/`isLocal` for SSR/build product code. _Avoid_: netlifyEnv (renamed; host binding lives in the adapter).

**`deployContext`**: Pure host-agnostic deploy-class predicates (`production` / `preview` / `local`) shared with edge runtimes that cannot import `astro:env`.

**`astroNetlify()` integration**: The Netlify adapter's default export — registers Netlify `CONTEXT` and bridges it to `DEPLOY_CONTEXT`.

**`edge/staging-auth`**: `createStagingAuth(authConfig)` in `@siteonce/astro-netlify` — the fail-closed basic-auth gate for non-production Netlify deploys, password from `STAGING_AUTH_PASSWORD`.

**`rehypeExternalLinks`**: The integration-wired rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG images

**OG image endpoint**: The configurable raw-PNG namespace injected by `astroOgImage()`, defaulting to `/_og`; the page path determines the image path. _Avoid_: build hook, manifest.

**`OgContext`**: The complete per-render data contract passed to project-authored Satori JSX templates.

**`ogImageFor()`**: The pure helper that maps a page pathname and explicit generation config to Seo-compatible generated-image props.

**OG image cache**: The generator's internal content-hash cache; cache identity is independent of the public endpoint URL.
