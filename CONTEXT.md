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

**astro-intl**: Workspace package `@repo/astro-intl` — **catalogs**, collection pairing, locale list written through to Astro `i18n`. Factory `astroIntl()`.

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

**slug** (entry field): The public tail after the locale prefix. Homepage is `/`. Not the pairing `id` and not Astro’s collection id. _Avoid_: authored path, per-entry pathPrefix

**pairing `id`**: Shared key that joins locale siblings of one document. Authored on the entry (`data.id` by default). Distinct from the public `slug` and from Astro’s per-file collection `id`. Intl prefixes the collection name. _Avoid_: using slug as the group key; treating `entry.id` as the pairing key; generating the key from the folder tree; minting a second internal key

**section**: A locale-specific prefix of a routed collection’s public tail (`blog` vs `artikel`, or a multi-segment prefix such as `about/history` vs `ueber-uns/geschichte`). Listing slug equals a section; an entry slug is that section plus one rest segment. _Avoid_: pathPrefix (as a document field), catalog key (for this)

**routed collection**: A listed collection whose entries have a public URL (`slug`). _Avoid_: giving records a slug

**record**: A translated collection entry with no public URL. _Avoid_: routed (for this)

**relation**: A pointer from an entry to another collection by pairing `id`. Authored as that id string; after parse `{ collection, id }`. Resolve uses the current locale. _Avoid_: `reference()` (for this helper); treating Astro’s collection file id as the stored pointer

**page type**: Starter convention on the pages collection (`home` | `listing`). Intl does not know page types. _Avoid_: collection role (as an intl concept)

### Content schemas

**seo** (fragment): Shared Zod fragment for collection frontmatter that drives search and social: `seoTitle`, `seoDesc`, `primaryKeyword`, `secondaryKeywords`. Not the **Seo** head component. _Avoid_: prose (for this meaning)

**media** (fragment): Shared Zod fragment for an entry’s editorial image: `featImage` (URL) and `featImageAlt`. Pairs with **editorial media**. _Avoid_: featImagePath

**blog**: The composed collection schema for a blog: **seo** + **media** plus posting fields (pubDate, status, tags, excerpt, optional og). Lives in **astro-site** so a second site can import it. A directory composes fragments instead. _Avoid_: prose (for this schema)

**term**: An item in a **taxonomy**, published as a paired **document** (`id` + `locale` + `slug`). Posts match terms by folder id string. _Avoid_: tag (for this unit); locale-free slug as the collection entry id

**taxonomy**: A named vocabulary of **terms**. Site-owned as a content collection when those terms own URLs. _Avoid_: tag registry, TaxonomyType

**editorial media**: Images for content entries, stored in a public object store. Frontmatter holds a URL. Co-located files exist only so the demo renders offline. _Avoid_: host blobs (for this meaning), storage (as a package)

**newsletter**: An ESP-hosted campaign (Buttondown, Beehiiv, Mailchimp). RSS is the machine feed an ESP may poll. The snapshot does not send mail. _Avoid_: packages/mail, transactional mail (for this meaning)

**provider facade**: A module that hides a third-party vendor (auth, payments, mail, storage) behind a SiteOnce API. Out of scope — the snapshot wires vendor SDKs directly. _Avoid_: wrapper (for this meaning)

### Lifecycle & head

**chrome**: Shared site shell around every page — styles, Favicon, Analytics, locale switcher, head pass-through. **SiteLayout** is chrome. _Avoid_: composing **blocks** or document landmarks in the layout

**document**: A published page for a paired entry (home, listing, post, **term**). Owns landmarks and head tags. _Avoid_: treating 404 as a paired document

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
