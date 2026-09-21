# `@repo/astro-intl`

## Scope

Astro integration for **intl**. Factory `astroIntl()`. Owns **catalogs** (pure `createT` plus startup catalog-file checks), locale list and prefix policy written through to Astro `i18n`, collection pairing, compiled `path`, query helpers, and `<Hreflang />`.

## Conventions

- Do not wrap Astro i18n or `astro:content` in a second name. Do not extend `siteonce()`.
- Factory takes no options. Load `src/intl.config.ts` by convention (`defineIntl` + default export).
- Do not load **catalogs** into a virtual module. `createT` is pure: the app passes message objects in.
- Fail at startup when `src/intl.config.ts` is missing, a configured locale has no catalog file, overlapping `i18n` keys are already set on `defineConfig`, or `@astrojs/sitemap`'s `i18n` option is set.
- **intl** does not know collection roles or **page types**. Listed collections are routed (have a URL) or translated records (do not).
- File-route-wins: reserved tails from `astro:routes:resolved` plus optional `reservedPaths`. Do not add a dummy file route to prove it.
- Query helpers do not import `@astrojs/sitemap` or `@astrojs/rss`.
- Duplicate `(locale, path)` or a file route that shadows an entry aborts the build.
- Pairing reads `data[idField]` and `data[localeField]` (defaults `id` / `locale`) and prefixes the collection name. Do not resolve pairing from `filePath` or Astro `entry.id`. No strategy enum. Do not mint a second internal key.
- Pairing holds each sibling’s `slug`. The app’s `getStaticPaths` claims URLs. List helpers return pairing (`locale` + `slug`), not catch-all params. Do not add a second path index.

## Out of scope

- A virtual module for **catalogs**.
- Registering or wrapping `@astrojs/sitemap` / `@astrojs/rss`.
- Collection roles and **page types**.
