# astro-stack

A snapshot monorepo that is the foundation for every Astro **content site** built on this stack (directories, magazines, blogs — not apps). The customer copies the repo and owns every file; SiteOnce does not publish packages.

## Language

### Delivery

**snapshot**: The product as a git copy the customer takes over. Every file is theirs. There are no promised upgrades. _Avoid_: npm package, published package (for the product)

**astro-stack**: This repository — the snapshot we maintain and sell. Customers copy it; they are not registry consumers of `@siteonce/*`. _Avoid_: astro-base, siteonce-stack, product repo, library repo, package repo

**company-repo**: Our copy of astro-stack. We use the product to run sites, write content, and sell/document it — the same copy-and-own move a customer makes. Includes CI/CD. Not a second product. _Avoid_: devops repo

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

### Lifecycle & head components

**`BaseLayout`**: The bare HTML skeleton component — `<html lang>` plus a `<head>` slot and a `<body>` slot.

**`Seo`**: The component that owns `<head>` tag emission (title, meta, Open Graph, Twitter), driven by `seoConfig`.

**`Schema`**: The JSON-LD emitter component (Article, BreadcrumbList, Organization, WebSite).

**`Analytics`**: The marketing-app analytics tag component (GA4 via Partytown). App concern, not a package export; `@repo/astro` only registers Partytown when `siteConfig.analytics` is set.

**`Favicon`**: The head component that emits the standard favicon tag block; agnostic to how the icon files are generated (files live in the app’s `public/`).

### Styling

**Tailwind**: The utility styling engine for the starter theme and call-site classes. _Avoid_: Panda, Sass (for the wired stack)

**CVA**: A `class-variance-authority` definition of a component’s base styles and closed variant-prop options. _Avoid_: recipe

**variant prop**: A typed component prop that picks from a fixed set of options and maps to a CVA variant.

**call-site `class`**: Extra classes on a component instance, merged after CVA so the caller wins. Deep customization is editing the component file. _Avoid_: css prop, value prop (outgoing public API)

### Layout components

**`Flow`**: The vertical rhythm stack (Root + Item) used inside a section to space bands. `Flow.Root` establishes a BFC boundary; `Flow.Item` carries block margin via `blockMargin` prop → `--flow-item-block-margin` CSS var. Replaces `Region`. _Avoid_: Region (deprecated; use Flow instead); wrapping **Container** in Flow to constrain width.

**`Container`**: A site section — one area of the page, typically a direct child of **SiteFrameProvider** or **SiteFramePanel**. It owns that area's background (call-site `class`), width, and horizontal gap. Value props `size` / `gutter` (open CSS lengths) become instance CSS vars; `align` is the only closed variant (start | center | end). _Avoid_: using Container as a nested width wrapper inside Flow.

**`SiteFrame`**: The compound site frame (`SiteFrame.Provider` + `SiteFrame.Panel`). Compose **Container** sections and panels as children (panels last so they layer). Named aliases `SiteFrameProvider` / `SiteFramePanel` sit next to the namespace.

**`SiteFrameProvider`**: Part of **SiteFrame** — the top-level positioning context; isolates a stacking context and hosts panels.

**`SiteFramePanel`**: Part of **SiteFrame** — an off-canvas panel anchored to a frame edge (start/end/top/bottom), with open/closed `state`.

### Integration & environment

**`deployConfig`**: App-owned mapping of host environment onto one exclusive class (`production` | `preview` | `local`). The values file lives in the app; the customer writes the host check (Netlify `CONTEXT` today). Schema lives in **astro**; `siteonce()` exposes it on `virtual:app/config`. _Avoid_: DEPLOY_CONTEXT, packages/netlify, authConfig, three independent booleans

**`deployEnv`**: Helpers `isProd` / `isPreview` / `isLocal` that read `deployConfig.class` from `virtual:app/config` for SSR/build product code. _Avoid_: netlifyEnv, astro:env (for this fill), deployContext

**`rehypeExternalLinks`**: The integration-wired rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG images

**OG image endpoint**: The configurable raw-PNG namespace injected by `ogImage()`, defaulting to `/_og`; the page path determines the image path. _Avoid_: build hook, manifest.

**`OgContext`**: The complete per-render data contract passed to project-authored Satori JSX templates.

**`ogImageFor()`**: The pure helper that maps a page pathname and explicit generation config to Seo-compatible generated-image props.

**OG image cache**: The generator's internal content-hash cache; cache identity is independent of the public endpoint URL.
