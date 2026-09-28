# Intl

How this snapshot builds multilingual **content sites** on Astro’s own i18n. Yardstick for `@repo/astro-intl` and for **starter**. Glossary: `CONTEXT.md` (`slug`, pairing `id`, `section`, **content source**).

## Sit on Astro i18n

Sit on Astro i18n. Enhance it.

Astro already owns locale prefixing, `getRelativeLocaleUrl`, `Astro.currentLocale`, automatic routing, and content collections. Intl writes locale list and prefix policy into `defineConfig.i18n`. Callers use `astro:i18n` and `astro:content` under those names.

The enhancement is what Astro does not own: **catalogs** (`t()`) and **pairing** entries across locales. A routed entry carries `id` (the same entry across locales) and `locale` (which sibling this is). When the collection has a slug, `slug` is one segment. The **section** in front of that segment is per locale and is not a field on the entry. The public tail comes from the route row. Folders, chrome, and the views are the app’s. Intl injects each view at the URLs its row publishes ([Routes](#routes)).

Automatic routing with `prefixDefaultLocale` is enough.

`astroIntl()` takes no options. It loads `src/intl.config.ts` by convention.

## Two jobs

- **intl** (`@repo/astro-intl`) — locales written through to Astro `i18n`, catalogs, pairing, route injection, lookup by id and by locale and public tail. It does not own folders or views. Who emits which URLs: [`publishing.md`](publishing.md).
- **starter** — an example **content site** using intl. Its **content source** is Astro content collections. It writes the route rows, the views, and RSS. Sitemap printer glue lives in `@repo/astro-intl-sitemap`. The app’s fallback view decides what a missing translation does.

The test: if deleting a piece would make the site look more like ordinary Astro and pairing still works, it was cost.

## Content source

The app picks the **content source**: Astro content collections, or a **CMS**. Intl does not pick it.

Intl makes translation work on top of Astro for either source. **Catalogs**, **pairing**, **relations**, and locale resolve read collection entries. A CMS uses that translation by presenting the same entry fields. Intl does not ship a client for a CMS. New translation behavior has to work for both sources. A job the CMS already does on its own stays there.

Pairing reads build-time collections (`getCollection`). It does not read live collections (`getLiveCollection`). For fresh CMS content, keep the pairing fields in a build-time collection. The view then resolves its entry through intl and loads the body with `getLiveEntry` ([View rendering](#view-rendering)). New documents, slug changes, and new translations still need a build. Pairing at request time from live collections is possible, but intl does not build it yet.

## Pairing

Pairing reads `data[idField]` and `data[localeField]` (defaults `id` / `locale`) and prefixes the collection name. Pairing key = collection name + `/` + `data[idField]`. One `PairingIndex` (`byLocalePath`, `byLocaleEntryId`). Those fields are the contract for both content sources. File layout belongs to the app.

Pairing is on `id`. A `{slug}` row publishes one URL per entry: that locale’s **section** plus the one-segment **slug**. Naming an entry on that row publishes that entry alone. A collection with a slug still needs a `{slug}` row.

A row that names an entry and no `{slug}` publishes the written tail. That entry’s slug is unused. The `{slug}` row does not publish that entry again.

A collection named without `{slug}` supplies its entries to the written tail and publishes no entry URL. `pagination` publishes the later pages. `pageSize` is how many entries fill one chunk. Omit `pagination` and the row stays that one tail. Page 1 is the row’s `slug`. Later pages replace `{page}` in `pagination.slug`. Each locale writes that tail in full (`blog/{page}`, `artikel/seite/{page}`). The row does not store a page count. Each locale publishes as many pages as its listing fills. A page’s alternates are the locales that publish that same page. The `{page}` tail never publishes page 1. A literal page-1 tail such as `blog/1` publishes that tail and leaves the unnumbered tail free. An entry slug that matches a published page number on that section aborts the build.

`pagination.slug` is written in full, even when it repeats the row’s `slug`. It has no default. The obvious default, `<slug>/{page}`, has the shape that clashes with an on-demand `{slug}` route ([View rendering](#view-rendering)). A default would hand every site that clash without a line naming it. A tail relative to the row’s `slug` is refused as well. It would bend a literal page-1 tail (`blog/1` → `blog/1/2`) and tie later pages to page 1’s tail. The key stays `slug` because it holds the same kind of value as the row’s `slug`: a full tail per locale.

Pairing counts that locale’s entries (`localeField`). The view orders them with a required `sort` or `order` passed to `listingPaths`. Intl has no default order, because `getCollection()` order is non-deterministic. A CMS page size stays separate from `pageSize`.

The content source decides which drafts exist. Outside local and preview, drafts never enter the collection, so no page, listing, sitemap URL, or alternate sees them. A CMS does this with its published view of the content. The view orders the list. Intl filters by locale.

A collection with no slug stays **records**, except an entry a route names. A tail with no entry has no pairing `id`. Its alternates are the locales that publish that tail.

Intl keeps uniqueness of `(id, locale)` and of `(locale, path)`, lookup by locale and public tail, and sibling tails.

## Routes

`astroIntl()` injects one Astro route per route row and locale, and two when the row has `pagination`. A route row names the **view** that renders its URLs. A view is a file under `src/views/`, and the row names it by its path there without a file extension (`blog/post`). That file is `src/views/<view>.astro`, or `src/views/<view>/index.astro` when the name has no file.

A row names one view for every locale, or one view per locale.

The row decides the route’s shape:

- A `{slug}` row: `<section>/[slug]`, one URL per published entry.
- A row with `pagination`: page 1 is `<slug>/[...page]`, with the row’s view. The spread is empty for page 1. The helper keeps that page and drops the rest. Later pages are `pagination.slug` with `{page}` replaced by `[page]`, with `pagination.view` or the row’s view. Astro’s `paginate()` includes page 1 as `"1"`. The helper drops that page on the `[page]` route. The spreads exist so Astro calls the view’s `getStaticPaths`.
- Any other row: `<tail>/[...index]`, one URL. The spread is empty for that URL. It exists so Astro calls the view’s `getStaticPaths`.

Pairing counts the same list as `paginate()`, and a page count that disagrees aborts the build. `order` must return the same entries, and the build aborts when it does not. `listingPaths` aborts when neither `sort` nor `order` is set, and when both are set. Page 1 uses the row’s view. Later pages use `pagination.view`, or the row’s view when that is omitted. Each view calls `listingPaths` once. When `pagination.view` names a second view, both views must pass the same ordering, because each one slices its own pages from its own order. Import one shared `sort` or `order` in both. Intl does not check that they match. The helper reads `routePattern` and emits the pages for that route.

A view is a full Astro page. The view owns its `getStaticPaths`, typed props, and `prerender`, and its `getStaticPaths` lists its URLs. `viewRendering` sets the default for `prerender` ([View rendering](#view-rendering)). It returns intl’s helper for its route: `staticPaths`, `entryPaths`, `listingPaths`, or `fallbackPaths`. A helper returns only what pairing published in that locale. A locale that does not publish a row’s tail gets no page.

**Missing translation.** The config may name a **fallback view** (`fallbackView`) for every `{slug}` row. A `{slug}` row may name its own, or `false` for none. In each locale that is not the default, intl injects it for default-locale entries that have no translation. Its props carry that entry and its default-locale URL (`target`). The view chooses what to do: redirect, or show a notice. With none, those URLs 404. Intl never falls back to the same tail in the default locale.

**URL form.** Intl builds every URL through `astro:i18n`: hreflang, sitemap locs, fallback-view targets, and listing pager links. So links follow `trailingSlash` and `build.format`. Intl warns at startup when the two disagree: `"never"` with the `directory` format, or `"always"` with the `file` format.

## View rendering

`viewRendering` in the intl config says when the injected views render: `'build'` (the default) or `'request'`. The app sets it from its deploy class, for example `'request'` in preview only. Intl does not read the deploy class.

With `'request'`, intl injects static, `{slug}`, and listing routes on demand. Fallback routes stay prerendered. A fallback route shares its pattern with the `{slug}` route, and two on-demand routes cannot share one pattern. A view’s own `prerender` export wins over `viewRendering`. A fallback view must not export `prerender = false`. The site needs an adapter.

An on-demand `{page}` route fails startup when a `{slug}` route has the same prefix, the same section, and one dynamic final segment (`blog/{page}` beside `blog/{slug}`). `[page]` and `[slug]` tie, and Astro sorts `[page]` first. Astro’s matcher falls through only from a prerendered match to an on-demand one, so an on-demand `[page]` would answer every entry URL. Give `pagination` its own `view` that exports `prerender = true`. `/blog/2` stays, and page 1 stays on demand. Export `prerender = true` from the row’s view. This also prerenders page 1. Give `pagination.slug` its own segment (for example `blog/page/{page}`). That keeps every listing page on demand. A prerendered `{page}` route beside an on-demand `{slug}` route stays allowed. The host serves the prerendered file first.

The host must serve a prerendered file before it asks the on-demand app. That is how a prerendered fallback route and a prerendered `{page}` route win over an on-demand `{slug}` route. `@astrojs/node` in standalone mode serves the file first. On a host that does not, an untranslated slug answers 404.

`viewRendering` has no effect under `astro dev`. Dev renders every view per request already, so a view that calls `getLiveEntry` gets fresh content there too.

Pairing still comes from the build. A request renders a URL the build paired. It cannot publish a new one. New documents, slug changes, and new translations still need a build.

A view reads its props through `viewProps(Astro, getStaticPaths)`. Prerendered, that returns `Astro.props`. On demand, it runs the view’s own `getStaticPaths` for `Astro.routePattern` and returns the props of the path whose params match the request. With no match it returns `undefined`, and the view answers 404. The props are the same in both modes. A view has one code path.

**Hybrid preview** is `'request'` plus the app’s live content: the view gets its entry from `viewProps`, then loads the fresh body with `getLiveEntry`. The live loader, its draft view of the CMS, and the adapter are the app’s.

## Incremental builds

Astro’s `experimental.incrementalBuild` skips rendering a page when its `cacheKey` matches the last build. It does not skip `getStaticPaths`, so pairing still reads every entry on every build. Astro tracks code, not the data a page reads while it renders.

An intl page depends on more than its own entry. Adding a translation changes the alternates on every sibling. One new post shifts every page of its listing. So intl builds the `cacheKey`, not each view. Each helper returns one per path:

- `entryPaths`: the entry’s digest and its alternates.
- `listingPaths`: the digests of that page’s entries, the page count, and the page’s alternates.
- `staticPaths`: the named entry’s digest, if any, and the alternates.
- `fallbackPaths`: the default-locale entry’s digest and the `target`.

A view that reads more data, such as relations or related posts, folds that data into the helper’s key.

## Relations

A **relation** stores the pairing `id`. After parse it is `{ target, id }`, where `target` is the collection name. Resolve uses the current locale. Both content sources use this pointer.

The intl config lists every collection a relation can point at (`relationTargets`). Intl reads relations through that list, so an on-demand view needs nothing beyond `setIntlConfig`. A `relation()` whose collection is not listed fails the build.

Listed targets use pairing (`getContentById`). Those entries carry `id` and `locale`.

Locale-free tables and inline locale maps are unlisted. The stored id is the collection entry id. A file collection sets that id from the filename. A CMS sets it from its document id.

Documents stay paired entries (`id` + `locale` on each sibling). Inline locale maps are a lookup-target shape.

## Catalogs

`createT` is pure: the app passes message objects in. Catalog JSON is not loaded into a virtual module.

## Refuses to boot

Fail at startup when:

- `src/intl.config.ts` is missing, or a configured locale has no catalog file.
- Overlapping `i18n` keys are already set on `defineConfig`, or `@astrojs/sitemap`'s `i18n` option is set.
- A `(locale, path)` is duplicated, or a file route shadows an entry.
- A row names a view that has no file under `src/views/`, or that has both `<view>.astro` and `<view>/index.astro`.
- A row sets `fallbackView` (a view or `false`) without `{slug}`.
- `{page}` is in the row’s `slug`. It belongs in `pagination.slug`.
- `pagination` is on a row with no collection, a row that names an entry, or a row whose `slug` holds `{slug}`.
- `pagination.slug` and the row’s `slug` name different locales.
- `pagination.slug` is not a `{page}` tail: not the whole final segment, or beside `{slug}`.
- `pagination.pageSize` is not a positive integer.
- `pagination.view` names a missing file, both a file and a folder index, or the wrong locales.
- A top-level `pageSize`.
- `viewRendering` is `'request'` and the site has no adapter, outside `astro dev`.
- `viewRendering` is `'request'` and a fallback view exports `prerender = false`, outside `astro dev`.
- `viewRendering` is `'request'` and an on-demand `pagination.slug` route has the same shape as a `{slug}` route, outside `astro dev`.
- Two rows compile to the same route pattern.
- An app file route would serve a URL an injected route emits and win over it.
- A **relation** pairing `id` is missing, a listed target has no sibling in the source locale, or a `localized()` map has a missing or extra locale key.

## Today

Starter’s content source is Astro content collections. A CMS that presents the same entry fields is the other source this contract requires. The starter does not demonstrate that source.

The path helpers do not return a `cacheKey` yet.

The starter keeps `'build'` and has no adapter.

The starter keeps `blog/{page}` beside `blog/{slug}` on purpose. That is the clashing shape. It keeps the check and its workarounds exercised, so they do not rot. It is not the recommended setup for an on-demand site.

Some URLs still exist without a config line that names them. A static row compiles to a hidden `[...index]` spread. Fallback routes are injected for every non-default locale without a row naming them. `viewRendering` is treated as `'build'` under `astro dev`.
