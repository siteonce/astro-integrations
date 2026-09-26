# astro-stack

A snapshot monorepo that is the foundation for every Astro **content site** built on this stack (directories, magazines, blogs — not apps). The customer copies the repo and owns every file; SiteOnce does not publish packages.

## Language

### Delivery

**snapshot**: The product as a git copy the customer takes over. Every file is theirs. There are no promised upgrades. _Avoid_: npm package, published package (for the product)

**astro-stack**: This repository — the snapshot we maintain and sell. Customers copy it; they are not registry consumers of `@siteonce/*`. _Avoid_: astro-base, siteonce-stack, product repo, library repo, package repo

**company-repo**: Our copy of astro-stack. We use the product to run sites, write content, and sell/document it — the same copy-and-own move a customer makes. Includes CI/CD. Not a second product. _Avoid_: devops repo

**content site**: The kind of site this snapshot is for — directory, magazine, or blog. Not an application (auth, dashboards, APIs). _Avoid_: app (for the customer’s site)

**starter monorepo**: The workspace inside the snapshot — apps and packages — structured like an end-user project. _Avoid_: starter (alone)

**starter**: The content-site application at `apps/starter`. Root `pnpm dev` / `build` / `preview` run it.

**starter theme**: The visual token layer inside the starter (CSS variables and Tailwind theme). Not a second product. _Avoid_: starter (for this meaning)

### Packages

**astro-intl**: Workspace package `@repo/astro-intl` — **catalogs**, collection pairing, route injection, locale list written through to Astro `i18n`. Factory `astroIntl()`.

**astro-intl-sitemap**: Workspace package `@repo/astro-intl-sitemap` — printer glue the app passes into `@astrojs/sitemap`.

**astro-og-image**: Workspace package `@repo/astro-og-image` — optional OG image generator. Factory `ogImage()`.

**astro-site**: Workspace package `@repo/astro-site` — layout, **Seo**, **Schema**, **blocks**, schema fragments, and helpers. Not an Astro integration. _Avoid_: packages/schemas

**ui**: Small primitives in **astro-site**. Measure and Flow CSS; CVA/Svelte primitives, one folder per component. _Avoid_: catalog (for this)

**blocks**: Composed page sections (Hero, PostList, …) built from **ui**.

**`@repo/*`**: Workspace package scope inside the snapshot. Not a registry; the customer owns these folders. _Avoid_: `@siteonce/*` (for workspace names)

**`astroIntl()`**: Default export of `@repo/astro-intl`. _Avoid_: siteonce(), astroLib(), astro() (the framework already owns that name in `astro.config`)

**`ogImage()`**: Default export of `@repo/astro-og-image`. _Avoid_: astroOgImage()

**`createT`**: Pure factory that returns `t()` from message objects the app passes in. _Avoid_: loading catalogs through `virtual:app/i18n`

**`virtual:astro-og-image/config`**: Vite module `ogImage()` fills with generation config.

### Intl

**catalog**: Per-locale message file for `t()`. The app passes parsed objects into `createT`. _Avoid_: dictionary, i18n collection; using catalog for **ui** / **blocks**; a virtual module for this

**content source**: Where a collection’s entries come from. The app chooses Astro content collections or a **CMS**.

**CMS**: A content system outside this snapshot that can supply a **content source**. _Avoid_: an **astro-intl** package; calling **starter** a CMS

**slug** (entry field): One public segment of a routed **entry**. Not the pairing `id`, not the locale prefix, and not the **section** in front of it. _Avoid_: full public tail, authored path, per-entry pathPrefix

**pairing `id`**: Shared key that joins locale siblings of one **entry**. Authored on the entry (`data.id` by default). Distinct from the public `slug` and from Astro’s per-file collection `id`. Intl prefixes the collection name. _Avoid_: using slug as the group key; treating `entry.id` as the pairing key; generating the key from the folder tree; minting a second internal key

**section**: A locale-specific prefix in front of an entry **slug** (`blog` vs `artikel`, or several segments such as `about/history`). On a route row it is the text before `{slug}`. _Avoid_: pathPrefix (as an entry field), catalog key (for this)

**`{slug}`**: The route-row token that publishes an entry tail. The text before it is the **section**. The entry **slug** is the last segment. _Avoid_: a movable capture; renaming the brace; a page number

**`pageSize`**: How many entries one chunk of a collection tail holds. A positive integer on that route row. The written tail is page 1. The row does not store a page count. _Avoid_: pages (as a count of URLs); a CMS API page size

**routed collection**: A listed collection whose entries have a public URL. A `{slug}` row publishes that URL: the **section** plus the **slug**. _Avoid_: giving records a slug; treating a collection tail as an entry URL

**entry**: One item in a collection. Locale siblings share one pairing `id`. _Avoid_: document; a **view** that no collection claims

**`viewRendering`**: Intl config setting for when injected **views** render: `'build'` (prerendered, the default) or `'request'` (static and `{slug}` routes on demand; listing and missing routes stay prerendered). The app sets it from its deploy class. _Avoid_: onDemand, a deploy class inside intl, previewMode

**hybrid preview**: A preview where the build pairs the URLs and the view loads fresh CMS content per request with `getLiveEntry`. Needs `viewRendering: 'request'`. _Avoid_: live pairing (not built), draft mode

**missing view**: The **view** named in `missingView` for a locale without a translation. The config names one for every `{slug}` row; a row may name its own, or `false` for none. It receives the default-locale entry and its URL. With none, those URLs 404. _Avoid_: fallback, redirect page (it may show a notice)

**record**: A translated **entry** with no public URL. _Avoid_: routed (for this)

**relation**: A pointer from an entry to another collection by pairing `id`. Authored as that id string; after parse `{ target, id }`, where `target` is the collection name. Resolve uses the current locale. The intl config lists its target collections in `relationTargets`. _Avoid_: `reference()` (for this helper); treating Astro’s collection file id as the stored pointer

### Content schemas

**seo** (fragment): Shared Zod fragment for collection frontmatter that drives search and social: `seoTitle`, `seoDesc`, `primaryKeyword`, `secondaryKeywords`. Not the **Seo** head component. _Avoid_: prose (for this meaning)

**media** (fragment): Shared Zod fragment for an entry’s editorial image: `featImage` (URL) and `featImageAlt`. Pairs with **editorial media**. _Avoid_: featImagePath

**blog**: The composed collection schema for a blog: **seo** + **media** plus posting fields (pubDate, status, tags, excerpt, optional og). Lives in **astro-site** so a second site can import it. A directory composes fragments instead. _Avoid_: prose (for this schema)

**term**: An item in a **taxonomy**, published as a paired **entry** (`id` + `locale` + `slug`). A post points at its terms with a **relation** per tag. _Avoid_: tag (for this unit); locale-free slug as the collection entry id; matching terms by folder name

**taxonomy**: A named vocabulary of **terms**. Site-owned as a content collection when those terms own URLs. _Avoid_: tag registry, TaxonomyType

**editorial media**: Images for content entries, stored in a public object store. Frontmatter holds a URL. Co-located files exist only so the demo renders offline. _Avoid_: host blobs (for this meaning), storage (as a package)

**newsletter**: An ESP-hosted campaign (Buttondown, Beehiiv, Mailchimp). RSS is the machine feed an ESP may poll. The snapshot does not send mail. _Avoid_: packages/mail, transactional mail (for this meaning)

**provider facade**: A module that hides a third-party vendor (auth, payments, mail, storage) behind a SiteOnce API. Out of scope — the snapshot wires vendor SDKs directly. _Avoid_: wrapper (for this meaning)

### Lifecycle & head

**chrome**: Shared site shell around every page — styles, Favicon, Analytics, locale switcher, head pass-through. **SiteLayout** is chrome. _Avoid_: composing **blocks** or page landmarks in the layout

**Astro page**: A file under `src/pages/` that Astro publishes as a route. _Avoid_: **view**

**view**: The file a route row renders. It lives under `src/views/`; the row names it by its path there (`blog/post`). The rows live in `src/routes.config.ts`. `astroIntl()` injects it as an Astro route for each locale. It is a full Astro page: its own `getStaticPaths` lists its URLs. _Avoid_: routed page, template, page component, **Astro page**, document, catch-all, a component that an **Astro page** imports, moving `getStaticPaths` out of it.

**`SiteLayout`**: The starter chrome component around **BaseLayout**.

**`BaseLayout`**: The bare HTML skeleton component — `<html lang>` plus a `<head>` slot and a `<body>` slot.

**`Seo`**: The component that owns `<head>` tag emission (title, meta, Open Graph, Twitter), driven by site config plus per-page props.

**`Schema`**: The JSON-LD emitter component (Article, BreadcrumbList, Organization, WebSite).

**`Hreflang`**: Alternate-language `<link rel="alternate">` tags from pairing. Intl export, distinct from **Seo**.

**`Analytics`**: The app head component that emits the analytics tag block. App concern, not a package export; the customer edits the file.

**`Favicon`**: The app head component that emits the standard favicon tag block. App concern, not a package export; icon files live in the app’s `public/`.

**`robotsTxt`**: Helper that builds the robots.txt body from site and deploy config. Not a route. Distinct from **Seo** `noindex`. _Avoid_: feeding noindex into robots rules

### Styling

**Tailwind**: The utility styling engine for the starter theme and call-site classes. _Avoid_: Panda, Sass (for the wired stack)

**CVA**: A `class-variance-authority` definition of a component’s base styles and closed variant-prop options. _Avoid_: recipe

**variant prop**: A typed component prop that picks from a fixed set of options and maps to a CVA variant.

**call-site `class`**: Extra classes on a component instance, merged after CVA so the caller wins. Deep customization is editing the component file. _Avoid_: css prop, value prop (outgoing public API)

### Layout

**`Flow`**: Collapse boundary for a stack of blocks, including the stack’s block spacing. _Avoid_: Region; `space-y` for this job.

**`Measure`**: Width-constraint primitive (class `measure`) — a centered max width and a side inset (`gutter`) so contents do not touch the viewport edge. _Avoid_: Container (the old name); treating it as a site section; putting full-bleed background on it; Tailwind’s `container`; `px-*` as the gutter.

### Integration & environment

**`deployConfig`**: App-owned mapping of host environment onto one exclusive class (`production` | `preview` | `local`). The app writes the host check and parses the schema on import. _Avoid_: DEPLOY_CONTEXT, packages/netlify, authConfig, three independent booleans, `virtual:app/config`

**`deployEnv`**: Helpers `isProd` / `isPreview` / `isLocal` that read `deployConfig.class`. Callers pass the parsed config. _Avoid_: netlifyEnv, astro:env (for this fill), deployContext

**`rehypeExternalLinks`**: The rehype plugin that adds `target="_blank" rel="noopener noreferrer"` to outbound prose links not listed in `siteConfig.externalLink.exceptions`.

### OG images

**OG image endpoint**: The configurable raw-PNG namespace injected by `ogImage()`, defaulting to `/_og`; the page path determines the image path. _Avoid_: build hook, manifest.

**`OgContext`**: The complete per-render data contract passed to project-authored Satori JSX templates.

**`ogImageFor()`**: The pure helper that maps a page pathname and explicit generation config to Seo-compatible generated-image props.

**OG image cache**: The generator's internal content-hash cache; cache identity is independent of the public endpoint URL.
