# Intl

How this snapshot builds multilingual **content sites** on Astro’s own i18n. Yardstick for `@repo/astro-intl` and for **starter**. Glossary: `CONTEXT.md` (`slug`, pairing `id`, `section`, **content source**).

## Sit on Astro i18n

Sit on Astro i18n. Enhance it.

Astro already owns locale prefixing, `getRelativeLocaleUrl`, `Astro.currentLocale`, automatic routing, and content collections. Intl writes locale list and prefix policy into `defineConfig.i18n`. Callers use `astro:i18n` and `astro:content` under those names.

The enhancement is what Astro does not own: **catalogs** (`t()`) and **pairing** entries across locales. A routed entry carries `id` (the same entry across locales) and `locale` (which sibling this is). When the collection has a slug, `slug` is one segment. The **section** in front of that segment is per locale and is not a field on the entry. The public tail comes from the route row. Folders, the catch-all, chrome, and which routed page renders are the app’s.

Automatic routing with `prefixDefaultLocale` is enough.

`astroIntl()` takes no options. It loads `src/intl.config.ts` by convention.

## Two jobs

- **intl** (`@repo/astro-intl`) — locales written through to Astro `i18n`, catalogs, pairing, lookup by id and by locale and public tail. It does not own folders, page bodies, or which URLs the build emits. Who emits them: [`publishing.md`](publishing.md).
- **starter** — an example **content site** using intl. Its **content source** is Astro content collections. It registers content URLs and RSS. Sitemap printer glue lives in `@repo/astro-intl-sitemap`. The app owns a path whose entry is absent.

The test: if deleting a piece would make the site look more like ordinary Astro and pairing still works, it was cost.

## Content source

The app picks the **content source**: Astro content collections, or a **CMS**. Intl does not pick it.

Intl makes translation work on top of Astro for either source. **Catalogs**, **pairing**, **relations**, and locale resolve read collection entries. A CMS uses that translation by presenting the same entry fields. Intl does not ship a client for a CMS. New translation behavior has to work for both sources. A job the CMS already does on its own stays there.

## Pairing

Pairing reads `data[idField]` and `data[localeField]` (defaults `id` / `locale`) and prefixes the collection name. Pairing key = collection name + `/` + `data[idField]`. One `PairingIndex` (`byLocalePath`, `byLocaleEntryId`). Those fields are the contract for both content sources. File layout belongs to the app.

Pairing is on `id`. A collection with a slug publishes one URL per entry: that locale’s **section** plus the one-segment **slug**. A collection with no slug stays **records**, except an entry a route names. A row that names no entry publishes those tails with no pairing `id`. Its alternates are the other locales on that row. Intl does not know routed-page names.

Intl returns the default-locale entry at that same tail. It does not choose a fallback URL.

Intl keeps uniqueness of `(id, locale)` and of `(locale, path)`, lookup by locale and public tail, and sibling tails.

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
- A **relation** pairing `id` is missing, a listed target has no sibling in the source locale, or a `localized()` map has a missing or extra locale key.

## Today

Starter’s content source is Astro content collections. A CMS that presents the same entry fields is the other source this contract requires. The starter does not demonstrate that source.
