# astro-integrations

A monorepo of Astro integrations for **content sites** (directories, magazines, blogs — not apps), published to npm under `@siteonce/*`. The customer installs a package into their own Astro site. `apps/demo` proves the packages work together.

## Language

### Delivery

**astro-integrations**: This repository — the published packages and the **demo**. _Avoid_: astro-stack (a separate repository that installs these packages), library repo

**content site**: The kind of site these packages are for — directory, magazine, or blog. Not an application (auth, dashboards, APIs). _Avoid_: app (for the customer’s site)

**demo**: The content-site application at `apps/demo`, the proving ground for the packages. It runs them from source. Root `pnpm dev` / `build` / `preview` run it. _Avoid_: starter (astro-stack’s site), example app, playground

### Packages

**astro-intl**: Published package `@siteonce/astro-intl` — **catalogs**, collection pairing, route injection, locale list written through to Astro `i18n`, and sitemap options. Factory `astroIntl()` takes the intl config. Always written with its scope: the unscoped `astro-intl` on npm is an unrelated library. _Avoid_: `@repo/astro-intl`, `@siteonce/astro-intl-sitemap`, sitemap glue package

**astro-og-image**: Parked package `@repo/astro-og-image` — optional OG image generator. Factory `ogImage()`. Out of the workspace and unpublished.

**`@siteonce/*`**: The npm scope the packages publish under. _Avoid_: `@repo/*` (the old workspace scope; only the parked OG package keeps it)

**`astroIntl()`**: Default export of `@siteonce/astro-intl`. Takes the intl config. _Avoid_: siteonce(), astroLib(), astro() (the framework already owns that name in `astro.config`)

**`createIntl`**: The app-owned binding of intl’s page helpers to the intl config. _Avoid_: `setIntlConfig`, a global intl runtime, a virtual module

**`createIntlSchema`**: The app-owned binding of the content-schema helpers `relation` and `localized` to the intl config. _Avoid_: `intlSchema`, the unbound `relation()`/`localized()`

**`ogImage()`**: Default export of `@repo/astro-og-image`. _Avoid_: astroOgImage()

**`createT`**: Pure factory that returns `t()` from message objects the app passes in. _Avoid_: loading catalogs through `virtual:app/i18n`

**`virtual:astro-og-image/config`**: Vite module `ogImage()` fills with generation config.

### Intl

**catalog**: Per-locale message file for `t()`. The app passes parsed objects into `createT`. _Avoid_: dictionary, i18n collection; a virtual module for this

**content source**: Where a collection’s entries come from. The app chooses Astro content collections or a **CMS**.

**CMS**: A content system outside the app that can supply a **content source**. _Avoid_: an **astro-intl** package; calling the **demo** a CMS

**slug** (entry field): One public segment of a routed **entry**. Not the pairing `id`, not the locale prefix, and not the **section** in front of it. _Avoid_: full public tail, authored path, per-entry pathPrefix

**pairing `id`**: Shared key that joins locale siblings of one **entry**. Authored on the entry (`data.id` by default). `collections.fields.id` renames that field. Distinct from the public `slug` and from Astro’s per-file collection `id`. Intl prefixes the collection name. _Avoid_: using slug as the group key; treating `entry.id` as the pairing key; generating the key from the folder tree; minting a second internal key

**section**: A locale-specific prefix in front of an entry **slug** (`blog` vs `artikel`, or several segments such as `about/history`). On a route row it is the text before `{slug}`. _Avoid_: pathPrefix (as an entry field), catalog key (for this)

**`{slug}`**: The route-row token that publishes an entry tail. The text before it is the **section**. The entry **slug** is the last segment. _Avoid_: a movable capture; renaming the brace; a page number

**`pagination`**: The object on a route row that publishes listing pages after the first. It holds `pageSize`, a full `slug` per locale, and an optional `view`. Page 1 is the row’s `slug`. _Avoid_: a second route row; a tail relative to the row’s `slug`; nesting a `{slug}` row inside it; a different listing order in `pagination.view` than in the row’s view

**`{page}`**: The token in `pagination.slug` for listing pages after the first. It is the whole final segment of that tail. The number replaces it. That tail never publishes page 1. A literal page-1 tail such as `blog/1` is the row’s `slug`, and it is allowed. _Avoid_: a movable capture; a token in the row’s `slug`; publishing page 1 from this tail

**page-1 tail**: The row’s `slug` when the row has `pagination`. It publishes listing page 1 at that written tail. _Avoid_: page-1 row (there is no separate row); a `{page}` token in this tail

**`pageSize`**: How many entries one chunk of a listing holds. A positive integer on `pagination`. Omit `pagination` and the row stays that one tail. The row does not store a page count. _Avoid_: a top-level key; pages (as a count of URLs); a CMS API page size

**listing order**: The required `sort` or `order` on `listingPaths`. `sort` builds a comparator from the route’s locale. `order` reorders the whole list and must keep the same entries. A row’s two listing views pass the same ordering. _Avoid_: a default order; a global listing hook; filtering in `order`

**routed collection**: A **translated** collection named on a `{slug}` row. That row publishes each entry’s URL: the **section** plus the **slug**. _Avoid_: giving records a slug; treating a collection tail as an entry URL

**entry**: One item in a collection. Locale siblings share one pairing `id`. _Avoid_: document; a **view** that no collection claims

**`viewRendering`**: Intl config setting for when injected **views** render: `'build'` (prerendered, the default) or `'request'` (static, `{slug}`, and listing routes on demand; fallback routes stay prerendered). An on-demand `{page}` route beside a `{slug}` route of the same shape fails startup. No effect under `astro dev`. The app sets it from its deploy class. _Avoid_: onDemand, a deploy class inside intl, previewMode

**hybrid preview**: A preview where the build pairs the URLs and the view loads fresh CMS content per request with `getLiveEntry`. Needs `viewRendering: 'request'`. _Avoid_: live pairing (not built), draft mode

**fallback view**: The **view** named in `fallbackView` for a locale without a translation. The config names one for every `{slug}` row; a row may name its own, or `false` for none. It receives the default-locale entry and its URL. With none, those URLs 404. _Avoid_: missing view; conflating it with Astro’s `i18n.fallback` (intl never serves the default-locale page at the translated URL); redirect page (it may show a notice)

**record**: An **entry** in a **translated** collection with no public URL. _Avoid_: routed (for this)

**relation**: A pointer from an entry to another collection, authored as an id string. After parse `Relation<C>` is `{ intlRelationTarget: C, id }`, where `C` is the target collection. A **translated** target stores the pairing `id` and resolves in the locale passed to `getRelated`. An **untranslated** target stores the collection entry id and ignores that locale. Targets are `collections.translated` and `collections.untranslated`. _Avoid_: `reference()` (for this helper); treating Astro’s collection file id as the stored pointer on a **translated** target

**translated** (collection): A collection paired on `(pairing id, locale)`. Intl loads it, pairs it, and keeps `(id, locale)` and `(locale, path)` unique. A **relation** to it resolves in the current locale. Named on a `{slug}` row, it is routed and its entries need the **slug** field. With no `{slug}` row, its entries are **records**, except an entry a route names. _Avoid_: listed (as this name)

**untranslated** (collection): A collection a **relation** may point at that is not paired. The stored id is the collection entry id. A file collection sets that id from the filename. A CMS sets it from its document id. _Avoid_: locale-free, unlisted (as this name)

**term**: An item in a **taxonomy**, published as a paired **entry** (`id` + `locale` + `slug`). A post points at its terms with a **relation** per tag. _Avoid_: tag (for this unit); locale-free slug as the collection entry id; matching terms by folder name

**taxonomy**: A named vocabulary of **terms**. Site-owned as a content collection when those terms own URLs. _Avoid_: tag registry, TaxonomyType

### Pages

**chrome**: Shared site shell around every page — styles, favicon, locale switcher, head tags. The demo’s chrome is `src/layouts/site-layout.astro`.

**Astro page**: A file under `src/pages/` that Astro publishes as a route. _Avoid_: **view**

**view**: The file a route row renders. It lives under `src/views/`; the row names it by its path there (`blog/post`). The rows live in `src/routes.config.ts`. `astroIntl()` injects it as an Astro route for each locale. It is a full Astro page: its own `getStaticPaths` lists its URLs. _Avoid_: routed page, template, page component, **Astro page**, document, catch-all, a component that an **Astro page** imports, moving `getStaticPaths` out of it.

### Integration & environment

**`deployClass`**: The demo's mapping of host environment onto one exclusive class (`production` | `preview` | `local`). A util in `src/utils/deploy.ts`, the only reader of host env. _Avoid_: DEPLOY_CONTEXT, packages/netlify, authConfig, three independent booleans, `virtual:app/config`

### OG images

**OG image endpoint**: The configurable raw-PNG namespace injected by `ogImage()`, defaulting to `/_og`; the page path determines the image path. _Avoid_: build hook, manifest.

**`OgContext`**: The complete per-render data contract passed to project-authored Satori JSX templates.

**`ogImageFor()`**: The pure helper that maps a page pathname and explicit generation config to Seo-compatible generated-image props.

**OG image cache**: The generator's internal content-hash cache; cache identity is independent of the public endpoint URL.
