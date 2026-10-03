# Intl

How this snapshot builds multilingual **content sites** on Astro’s own i18n. Yardstick for `@repo/astro-intl` and for **starter**. Glossary: `CONTEXT.md` (`slug`, pairing `id`, `section`, **content source**).

What the starter doesn't show is shown in `packages/astro-intl/test/`, one file per section of this page, plus the sitemap from [`publishing.md`](publishing.md#sitemap) ([Tests document behavior](index.md#tests-document-behavior)).

## Sit on Astro i18n

Sit on Astro i18n. Enhance it.

Astro already owns locale prefixing, `getRelativeLocaleUrl`, `Astro.currentLocale`, automatic routing, and content collections. Intl writes locale list and prefix policy into `defineConfig.i18n`. Callers use `astro:i18n` and `astro:content` under those names. Page code reads `locales` and `defaultLocale` through `src/utils/intl.ts`. That file re-exports them from `@repo/astro-intl/runtime`, which reads `astro:config/server`. Both are server-only. The content config cannot import either.

The enhancement is what Astro does not own: **catalogs** (`t()`) and **pairing** entries across locales. A routed entry carries `id` (the same entry across locales), `locale` (which sibling this is), and a one-segment `slug`. The **section** in front of that segment is per locale and is not a field on the entry. The public tail comes from the route row. Folders, chrome, and the views are the app’s. Intl injects each view at the URLs its row publishes ([Routes](#routes)).

Automatic routing with `prefixDefaultLocale` is enough. It defaults to `false`.

`astro.config.mjs` passes the intl config to `astroIntl(intlConfig)`. Views and utils import intl through `src/utils/intl.ts`, which binds `createIntl(intlConfig)` and re-exports `viewProps`, `Relation`, `localizedValue`, `Locale`, `locales`, and `defaultLocale`. The layout takes the switcher and the alternates from that file.

Intl does not depend on the bundler. It uses no virtual module, Vite plugin, `define`, or alias. Astro’s own virtual modules (`astro:content`, `astro:i18n`, `astro:config/server`) stay allowed. `Locale` comes from `injectTypes`, an Astro integration API.

Stop and start `astro dev` after editing `intl.config.ts` or `routes.config.ts`. A restart keeps the old config.

## Two jobs

- **intl** (`@repo/astro-intl`) — locales written through to Astro `i18n`, catalogs, pairing, route injection, lookup by id and by locale and public tail. It does not own folders or views. Who emits which URLs: [`publishing.md`](publishing.md).
- **starter** — an example **content site** using intl. Its **content source** is Astro content collections. It writes the route rows, the views, and RSS. The app registers `@astrojs/sitemap` with `intl.sitemap` and combines intl’s `filter` with its own. The app’s fallback view decides what a missing translation does.

The test: if deleting a piece would make the site look more like ordinary Astro and pairing still works, it was cost.

**Small surface.** Using intl should take few lines in the app, and each one should be a line the app would write anyway. A call site passes what only the app knows: locale, path, entry. Intl fills in what it already holds: config, locale list, key formats, tails. The customer copies views as templates, so every line a view needs gets repeated in every view. Shrinking the surface never hides the data behind it ([No boxing in](index.md#no-boxing-in)). Why this also helps agents: [`builders.md`](../agents/builders.md#small-write-surface).

## Content source

The app picks the **content source**: Astro content collections, or a **CMS**. Intl does not pick it.

Intl makes translation work on top of Astro for either source. **Catalogs**, **pairing**, **relations**, and locale resolve read collection entries. A CMS uses that translation by presenting the same entry fields. Intl does not ship a client for a CMS. New translation behavior has to work for both sources. A job the CMS already does on its own stays there.

Pairing reads build-time collections (`getCollection`). It does not read live collections (`getLiveCollection`). For fresh CMS content, keep the pairing fields in a build-time collection. The view then resolves its entry through intl and loads the body with `getLiveEntry` ([View rendering](#view-rendering)). New documents, slug changes, and new translations still need a build. Pairing at request time from live collections is possible, but intl does not build it yet.

## Pairing

The intl config names the **translated** collections and the **untranslated** ones:

```ts
collections: {
  translated: ['posts', 'tags', 'authors'],
  untranslated: ['sources', 'roles'],
  // Only for a translated collection whose fields have other names.
  fields: {
    posts: { id: 'uid', locale: 'lang', slug: 'path' },
  },
},
```

Intl loads each **translated** collection and pairs it on `(pairing id, locale)`. Pairing reads the id and locale fields and prefixes the collection name. Pairing key = collection name + `/` + the pairing `id`. One `PairingIndex` (`byLocalePath`, `byLocaleEntryId`). The fields are `id`, `locale`, and `slug`. `fields` renames them for one collection. Each name is optional: `id` (default `id`), `locale` (default `locale`), `slug` (default `slug`). It only renames. It switches no behavior. Both content sources present these fields. File layout belongs to the app.

Startup fails when a name repeats or sits in both lists, a `fields` key is not in `translated`, a route row names a collection outside `translated`, or a name in either list is not a content collection.

Pairing is on `id`. A `{slug}` row publishes one URL per entry: that locale’s **section** plus the one-segment **slug**. Naming an entry on that row publishes that entry alone. A **translated** collection named on a `{slug}` row is routed, and its entries need the **slug** field.

A row that names an entry and no `{slug}` publishes the written tail. That entry’s slug is unused. The `{slug}` row does not publish that entry again.

A collection named without `{slug}` supplies its entries to the written tail and publishes no entry URL. `pagination` publishes the later pages. `pageSize` is how many entries fill one chunk. Omit `pagination` and the row stays that one tail. Page 1 is the row’s `slug`. Later pages replace `{page}` in `pagination.slug`. Each locale writes that tail in full (`blog/{page}`, `artikel/seite/{page}`). The row does not store a page count. Each locale publishes as many pages as its listing fills. A page’s alternates are the locales that publish that same page. The `{page}` tail never publishes page 1. A literal page-1 tail such as `blog/1` publishes that tail and leaves the unnumbered tail free. An entry slug that matches a published page number on that section aborts the build.

`pagination.slug` is written in full, even when it repeats the row’s `slug`. It has no default. The obvious default, `<slug>/{page}`, has the shape that clashes with an on-demand `{slug}` route ([View rendering](#view-rendering)). A default would hand every site that clash without a line naming it. A tail relative to the row’s `slug` is refused as well. It would bend a literal page-1 tail (`blog/1` → `blog/1/2`) and tie later pages to page 1’s tail. The key stays `slug` because it holds the same kind of value as the row’s `slug`: a full tail per locale.

Pairing counts that locale’s entries. A CMS page size stays separate from `pageSize`.

The view passes the collection, or a list of collections, and a required `sort` or `order` to `listingPaths`. Intl has no default order, because `getCollection()` order is non-deterministic. `@repo/astro-intl/sorting` supplies comparators for `sort` (`byDate`, `byNumber`, `byText`, `byFlag`) and `sortBy` to chain them. `byText` takes the listing’s locale from the `sort` context. Intl ships no helpers for `order`, because an `order` depends on entry metadata.

The content source decides which drafts exist. Outside local and preview, drafts never enter the collection, so no page, listing, sitemap URL, or alternate sees them. A CMS does this with its published view of the content. The view orders the list. Intl filters by locale.

A **translated** collection with no `{slug}` row is **records**, except an entry a route names. A tail with no entry has no pairing `id`. Its alternates are the locales that publish that tail. A path pairing does not know has no alternates.

Intl keeps uniqueness of `(id, locale)` and of `(locale, path)`, lookup by locale and public tail, and sibling tails.

## Routes

`astroIntl()` injects one Astro route per route row and locale, and two when the row has `pagination`. A route row names the **view** that renders its URLs. A view is a file under `src/views/`, and the row names it by its path there without a file extension (`blog/post`). That file is `src/views/<view>.astro`, or `src/views/<view>/index.astro` when the name has no file.

A row names one view for every locale, or one view per locale.

A row’s `slug` is the tail after the locale prefix. `/` in a row is that locale’s home. `prefixDefaultLocale` defaults to `false`. Which value to use is the app’s call.

With `false`, the default locale’s home is `/`. Other locales live under `/<locale>/`. Nothing else may sit at `/`. A page or a redirect there fails startup. Astro 404s `/<defaultLocale>/…` for pages in dev and on demand, and a static build never emits them.

With `true`, every locale is prefixed. The site root `/` belongs to no locale. The app must serve it, or startup fails. One way is Astro’s `redirects`: `{ '/': '/<defaultLocale>/' }`.

The row decides the route’s shape:

- A `{slug}` row: `<section>/[slug]`, one URL per published entry.
- A row with `pagination`: page 1 is `<slug>/[...page]`, with the row’s view. The spread is empty for page 1. The helper keeps that page and drops the rest. Later pages are `pagination.slug` with `{page}` replaced by `[page]`, with `pagination.view` or the row’s view. Astro’s `paginate()` includes page 1 as `"1"`. The helper drops that page on the `[page]` route. The spreads exist so Astro calls the view’s `getStaticPaths`.
- Any other row: `<tail>/[...index]`, one URL. The spread is empty for that URL. It exists so Astro calls the view’s `getStaticPaths`.

Pairing counts the same list as `paginate()`, and a page count that disagrees aborts the build. `order` must return the same entries, and the build aborts when it does not. `listingPaths` aborts when neither `sort` nor `order` is set, when both are set, and when the route row names a collection the call did not pass. Page 1 uses the row’s view. Later pages use `pagination.view`, or the row’s view when that is omitted. Each view calls `listingPaths` once. The helper reads `routePattern` and emits the pages for that route. When `pagination.view` names a second view, both views must pass the same ordering, because each one slices its own pages from its own order. Import one shared `sort` or `order` in both. Intl does not check that they match.

A view is a full Astro page. The view owns its `getStaticPaths`, typed props, and `prerender`, and its `getStaticPaths` lists its URLs. `viewRendering` sets the default for `prerender` ([View rendering](#view-rendering)). It returns intl’s helper for its route: `staticPaths(routePattern)`, `entryPaths(routePattern, collection)`, `listingPaths(routePattern, collection, paginate, ordering)`, or `fallbackPaths(routePattern)`. `entryPaths` and `listingPaths` take the collection, or a list of collections. One view can serve rows of several collections: `entryPaths(routePattern, ['tags', 'categories'])`. A row that names another collection fails the build. A helper returns only what pairing published in that locale. A locale that does not publish a row’s tail gets no page.

**Missing translation.** The config may name a **fallback view** (`fallbackView`) for every `{slug}` row. A `{slug}` row may name its own, or `false` for none. In each locale that is not the default, intl injects it for default-locale entries that have no translation. Its props carry that entry and its default-locale URL (`target`). The view chooses what to do: redirect, or show a notice. With none, those URLs 404. Intl never falls back to the same tail in the default locale.

**URL form.** Intl builds every URL through `astro:i18n`: hreflang, sitemap locs, fallback-view targets, listing pager links, entry URLs, and switcher links. So links follow `trailingSlash` and `build.format`. Intl warns at startup when the two disagree: `"never"` with the `directory` format, or `"always"` with the `file` format.

`getRelativeEntryUrl` and `getAbsoluteEntryUrl` are on the `createIntl` binding. The ref is a relation or an entry. They return `undefined` when that locale publishes no URL for the entry. They throw when the collection is not translated, and when an entry has no `collection`.

`localeSwitcherLinks(locale, path)` is on the binding. A missing sibling has no `href`. The app decides what to do with that.

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
- `listingPaths`: the digests of that page’s entries after `sort` or `order`, the page count, and the page’s alternates.
- `staticPaths`: the named entry’s digest, if any, and the alternates.
- `fallbackPaths`: the default-locale entry’s digest and the `target`.

A view that reads more data, such as relations or related posts, folds that data into the helper’s key.

## Relations

A **relation** is `{ intlRelationTarget, id }` after parse, where `intlRelationTarget` is the collection name. Both content sources use this pointer. Targets are the **translated** and **untranslated** collections.

The content config takes `relation` and `localized` from `createIntlSchema(intlConfig)`. `relation(name)` takes a name in `collections.translated` or `collections.untranslated`. Any other name fails when Astro loads the content config. `localized(value)` uses `locales` from that config.

Intl reads relations through those lists, so an on-demand view needs nothing beyond its `createIntl` binding. An entry holding a relation whose collection is in neither list fails when intl loads collections: in the build, and per request for an on-demand view.

A **translated** target stores the pairing `id`. `getRelated(locale, relation)` from the `createIntl` binding resolves it in that locale. Those entries carry `id` and `locale`.

An **untranslated** target stores the collection entry id and ignores the locale passed to `getRelated`. Locale-free tables and inline locale maps are **untranslated**. A file collection sets that id from the filename. A CMS sets it from its document id.

`getRelated` returns the entry unchanged, as `getCollection` would. The return type is the target collection's `CollectionEntry` through the injected types, so a call site passes no type argument. A `localized()` field stays a locale map. The caller reads it with `localizedValue(field, locale)` from `@repo/astro-intl`. `localizedValue` takes a configured locale and throws when that locale is missing.

Documents are paired entries (`id` + `locale` on each sibling). Inline locale maps are a lookup-target shape.

## Catalogs

`createT` is pure: the app passes message objects in. Catalog JSON is not loaded into a virtual module. `createT` defaults to the injected `Locale`, so the starter passes no type argument. A missing catalog for a configured locale is a type error. Intl does not check catalog files.

## Refuses to boot

Fail at startup when:

- Overlapping `i18n` keys are already set on `defineConfig`, or `@astrojs/sitemap`'s `i18n` option is set.
- The content config directly imports `@repo/astro-intl/runtime`. Read locales from the intl config.
- `@astrojs/sitemap` is registered before intl.
- A `(locale, path)` is duplicated.
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
- A file route shaped like an injected route would serve a URL that route emits and win over it.
- `prefixDefaultLocale` is true and nothing serves `/`.
- A collection name repeats, or sits in both `translated` and `untranslated`.
- A `fields` key is not in `translated`.
- A route row names a collection that is not in `translated`.
- A name in `translated` or `untranslated` is not a content collection.
- `relation()` names a collection neither `collections.translated` nor `collections.untranslated` lists.
- A **relation** points at a collection neither `collections.translated` nor `collections.untranslated` lists.
- A **relation** pairing `id` is missing, a **translated** target has no sibling in the source locale, or a `localized()` map has a missing or extra locale key.

## Today

Starter’s content source is Astro content collections. A CMS that presents the same entry fields is the other source this contract requires. The starter does not demonstrate that source.

The path helpers do not return a `cacheKey` yet.

The starter keeps `'build'` and has no adapter.

The starter keeps `blog/{page}` beside `blog/{slug}` on purpose. That is the clashing shape. It keeps the check and its workarounds exercised, so they do not rot. It is not the recommended setup for an on-demand site.

Intl's tests still sit beside their modules in `src/` and import internal modules. `packages/astro-intl/test/` does not exist yet.

Some URLs still exist without a config line that names them. A static row compiles to a hidden `[...index]` spread. Fallback routes are injected for every non-default locale without a row naming them. `viewRendering` is treated as `'build'` under `astro dev`.
