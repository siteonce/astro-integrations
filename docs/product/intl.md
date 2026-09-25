# Intl

How this snapshot builds multilingual **content sites** on Astro’s own i18n. Yardstick for `@repo/astro-intl` and for **starter**. Glossary: `CONTEXT.md` (`slug`, pairing `id`, `section`, **content source**).

## Sit on Astro i18n

Sit on Astro i18n. Enhance it.

Astro already owns locale prefixing, `getRelativeLocaleUrl`, `Astro.currentLocale`, automatic routing, and content collections. Intl writes locale list and prefix policy into `defineConfig.i18n`. Callers use `astro:i18n` and `astro:content` under those names.

The enhancement is what Astro does not own: **catalogs** (`t()`) and **pairing** entries across locales. A routed entry carries `id` (the same entry across locales) and `locale` (which sibling this is). When the collection has a slug, `slug` is one segment. The **section** in front of that segment is per locale and is not a field on the entry. The public tail comes from the route row. Folders, chrome, and the routed pages are the app’s. Intl injects each routed page at the URLs its row publishes ([Routes](#routes)).

Automatic routing with `prefixDefaultLocale` is enough.

`astroIntl()` takes no options. It loads `src/intl.config.ts` by convention.

## Two jobs

- **intl** (`@repo/astro-intl`) — locales written through to Astro `i18n`, catalogs, pairing, route injection, lookup by id and by locale and public tail. It does not own folders or page bodies. Who emits which URLs: [`publishing.md`](publishing.md).
- **starter** — an example **content site** using intl. Its **content source** is Astro content collections. It writes the route rows, the routed pages, and RSS. Sitemap printer glue lives in `@repo/astro-intl-sitemap`. The app’s missing page decides what a missing translation does.

The test: if deleting a piece would make the site look more like ordinary Astro and pairing still works, it was cost.

## Content source

The app picks the **content source**: Astro content collections, or a **CMS**. Intl does not pick it.

Intl makes translation work on top of Astro for either source. **Catalogs**, **pairing**, **relations**, and locale resolve read collection entries. A CMS uses that translation by presenting the same entry fields. Intl does not ship a client for a CMS. New translation behavior has to work for both sources. A job the CMS already does on its own stays there.

## Pairing

Pairing reads `data[idField]` and `data[localeField]` (defaults `id` / `locale`) and prefixes the collection name. Pairing key = collection name + `/` + `data[idField]`. One `PairingIndex` (`byLocalePath`, `byLocaleEntryId`). Those fields are the contract for both content sources. File layout belongs to the app.

Pairing is on `id`. A `{slug}` row publishes one URL per entry: that locale’s **section** plus the one-segment **slug**. Naming an entry on that row publishes that entry alone. A collection with a slug still needs a `{slug}` row.

A row that names an entry and no `{slug}` publishes the written tail. That entry’s slug is unused. The `{slug}` row does not publish that entry again.

A collection named without `{slug}` supplies its entries to the written tail and publishes no entry URL. `pageSize` is how many entries fill one chunk. Omit it and the row stays that one tail. The row does not store a page count. The written tail is page 1. Later pages append the number. Each locale publishes as many pages as its listing fills. A page’s alternates are the locales that publish that same page. `blog/1` is not published. An entry slug that matches a published page number on that section aborts the build.

The chunk count uses the app’s listing. The starter listing is that locale’s published posts, drafts in local and preview, newest first. A CMS supplies that same ordered list. A CMS page size is separate from `pageSize`.

A collection with no slug stays **records**, except an entry a route names. A tail with no entry has no pairing `id`. Its alternates are the locales that publish that tail.

Intl keeps uniqueness of `(id, locale)` and of `(locale, path)`, lookup by locale and public tail, and sibling tails.

## Routes

`astroIntl()` injects one Astro route per route row and locale. The row’s `page` names the **routed page**: `src/routes/<page>.astro` or `src/routes/<page>/index.astro`.

The row decides the route’s shape:

- A `{slug}` row: `<section>/[slug]`, one URL per published entry.
- A collection with `pageSize`: `<tail>/[...page]`, built with Astro’s `paginate()`. Pairing counts the same list, and a page count that disagrees aborts the build.
- Any other row: `<tail>/[...index]`, one URL. The spread is empty for that URL. It exists so Astro calls the page’s `getStaticPaths`.

Each routed page owns its `getStaticPaths`, typed props, and `prerender`. It returns intl’s helper for its route: `staticPaths`, `entryPaths`, `listingPaths`, or `missingPaths`. A helper returns only what pairing published in that locale. A locale that does not publish a row’s tail gets no page.

**Missing translation.** A `{slug}` row may name a `missingPage`. In each locale that is not the default, intl injects it for the default-locale entries that have no sibling in that locale. Its props carry that entry and its default-locale URL (`target`). The page chooses what to do: redirect, or show a notice. Without `missingPage`, intl injects nothing and those URLs 404. Intl never falls back to the same tail in the default locale.

**URL form.** Intl builds every URL through `astro:i18n`: hreflang, sitemap locs, missing-page targets, and listing pager links. So links follow `trailingSlash` and `build.format`. Intl warns at startup when the two disagree: `"never"` with the `directory` format, or `"always"` with the `file` format.

## Relations

A **relation** stores the pairing `id`. After parse it is `{ collection, id }`. Resolve uses the current locale. Both content sources use this pointer.

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
- A row names a routed page with no file under `src/routes/`, or with both `<page>.astro` and `<page>/index.astro`.
- `missingPage` is set on a row without `{slug}`.
- Two rows compile to the same route pattern.
- An app file route would serve a URL an injected route emits and win over it.
- A **relation** pairing `id` is missing, a listed target has no sibling in the source locale, or a `localized()` map has a missing or extra locale key.

## Today

Starter’s content source is Astro content collections. A CMS that presents the same entry fields is the other source this contract requires. The starter does not demonstrate that source.
