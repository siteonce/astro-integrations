# siteonce-stack

A snapshot monorepo that is the foundation for every Astro **content site** built on this stack (directories, magazines, blogs — not apps). The customer copies the repo and owns every file; SiteOnce does not publish packages.

## Language

### Delivery

**snapshot**: The product as a git copy the customer takes over. Every file is theirs. There are no promised upgrades. _Avoid_: npm package, published package (for the product)

**siteonce-stack**: This repository — the snapshot we maintain and sell. Customers copy it; they are not registry consumers of `@siteonce/*`. _Avoid_: product repo, library repo, package repo

**company-repo**: Our copy of siteonce-stack. We use the product to run sites, write content, and sell/document it — the same copy-and-own move a customer makes. Includes CI/CD. Not a second product. _Avoid_: devops repo

**content site**: The kind of site this snapshot is for — directory, magazine, or blog. Not an application (auth, dashboards, APIs). _Avoid_: app (for the customer’s site)

**starter monorepo**: The workspace inside the snapshot — apps, packages, and tooling — structured like an end-user project. _Avoid_: starter (alone)

**starter theme**: The visual token layer inside the starter monorepo (CSS variables and Tailwind theme). Not a second product. _Avoid_: starter (for this meaning)

**marketing app**: The public site application at `apps/marketing` (today's `starter/`). _Avoid_: starter (for this meaning)

**components**: The workspace package of primitives, blocks, and head components (`BaseLayout`, `Seo`, `Schema`, `Favicon`). _Avoid_: ui (for this package)

**astro**: The workspace package that is the Astro integration, Astro-coupled runtime (virtual modules, i18n, rehype, robots), config schemas, and reusable content-collection schema fragments. _Avoid_: site (for this package), packages/schemas

**utils**: The workspace package of pure helpers (`cn`, taxonomy machinery, related-content picker). No Astro imports — those stay in **astro**.

**`@repo/*`**: Workspace package scope inside the snapshot. Not a registry; the customer owns these folders. _Avoid_: `@siteonce/*` (for workspace names)

**`siteonce()`**: Default export of `@repo/astro` — the Astro integration registered in an app’s `astro.config`. _Avoid_: astroLib(), astro() (the framework already owns that name in `astro.config`)

**`ogImage()`**: Default export of `@repo/og-image`. _Avoid_: astroOgImage()

**`virtual:app/*`**: Vite modules the current app’s `siteonce()` registration fills (`config`, `i18n`). Same ids in every app; each build supplies that app’s values. Head and `t()` import these, never `apps/<name>/src/config`. _Avoid_: `virtual:astro-lib/*`, `virtual:siteonce/*`, `virtual:<app-folder>/*` (for the id)

**`virtual:og-image/config`**: Vite module `ogImage()` fills with generation config.

**editorial media**: Images for content entries, stored in a public object store. Frontmatter holds a URL. Day-one store is Backblaze B2. Co-located files exist only so the demo renders offline. _Avoid_: host blobs (for this meaning), storage (as a package)

**newsletter**: An ESP-hosted campaign (Buttondown, Beehiiv, Mailchimp). RSS is the machine feed an ESP may poll. The snapshot does not send mail. _Avoid_: packages/mail, transactional mail (for this meaning)

**provider facade**: A module that hides a third-party vendor (auth, payments, mail, storage) behind a SiteOnce API. Out of scope — the snapshot wires vendor SDKs directly. _Avoid_: wrapper (for this meaning)

### Content schemas

**seo** (fragment): Shared Zod fragment for collection frontmatter that drives search and social: `seoTitle`, `seoDesc`, `primaryKeyword`, `secondaryKeywords`. Not the **Seo** head component. _Avoid_: prose (for this meaning)

**media** (fragment): Shared Zod fragment for an entry’s editorial image: `featImage` (URL) and `featImageAlt`. Pairs with **editorial media**. _Avoid_: featImagePath

**blog**: The composed collection schema for a blog: **seo** + **media** plus posting fields (pubDate, status, tags, excerpt, optional og). Lives in **astro** so a second site can import it. A directory composes fragments instead. _Avoid_: prose (for this schema)

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

**Tailwind**: The utility styling engine for the starter theme and call-site classes. _Avoid_: Panda, Sass (for the wired stack)

**CVA**: A `class-variance-authority` definition of a component’s base styles and closed variant-prop options. _Avoid_: recipe

**variant prop**: A typed component prop that picks from a fixed set of options and maps to a CVA variant.

**call-site `class`**: Extra classes on a component instance, merged after CVA so the caller wins. Deep customization is editing the component file. _Avoid_: css prop, value prop (outgoing public API)

### Layout components

**`Flow`**: The vertical rhythm stack (Root + Item). `Flow.Root` establishes a BFC boundary; `Flow.Item` carries block margin via `blockMargin` prop → `--flow-item-block-margin` CSS var. Replaces `Region` for vertical layout composition. _Avoid_: Region (deprecated; use Flow instead).

**`Container`**: The width-constraint component — horizontal gutter and alignment. Value props `size` / `gutter` (open CSS lengths) become component-scoped CSS vars (e.g. `--container-size`); `align` is the only closed variant (start | center | end). Vertical rhythm moved to `Flow.Item`.

**`SiteFrameProvider`**: The top-level positioning context for the site frame; isolates a stacking context and hosts panels.

**`SiteFramePanel`**: An off-canvas panel anchored to a frame edge (start/end/top/bottom), with open/closed state.

### Integration & environment

**`astroLib()` integration**: The lib's default export — the Astro integration that wires rehype, Partytown, sitemap, i18n, core config validation, and OG metadata support.

**`astroOgImage()` integration**: The optional generator integration — validates generation config and injects the prerendered OG image endpoint.

**`deployConfig`**: App-owned mapping of host environment onto one exclusive class (`production` | `preview` | `local`). The values file lives in the app; the customer writes the host check (Netlify `CONTEXT` today). Schema lives in **astro**; `siteonce()` exposes it on `virtual:app/config`. _Avoid_: DEPLOY_CONTEXT, packages/netlify, authConfig, three independent booleans

**`deployEnv`**: Helpers `isProd` / `isPreview` / `isLocal` that read `deployConfig.class` from `virtual:app/config` for SSR/build product code. _Avoid_: netlifyEnv, astro:env (for this fill)

**`deployContext`**: Pure predicates on the three deploy classes, for runtimes that cannot import `virtual:`.

**`rehypeExternalLinks`**: The integration-wired rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG images

**OG image endpoint**: The configurable raw-PNG namespace injected by `astroOgImage()`, defaulting to `/_og`; the page path determines the image path. _Avoid_: build hook, manifest.

**`OgContext`**: The complete per-render data contract passed to project-authored Satori JSX templates.

**`ogImageFor()`**: The pure helper that maps a page pathname and explicit generation config to Seo-compatible generated-image props.

**OG image cache**: The generator's internal content-hash cache; cache identity is independent of the public endpoint URL.
