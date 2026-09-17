# `@repo/astro-intl`

## Scope

Astro integration for **intl**. Factory `astroIntl()`. Owns **catalogs** (pure `createT` plus startup catalog-file checks), locale list, and prefix policy written through to Astro `i18n`.

## Conventions

- Do not wrap Astro i18n in a second name. Do not extend `siteonce()`.
- Factory takes no options. Load `src/intl.config.ts` by convention (`defineIntl` + default export).
- Do not load **catalogs** into a virtual module. `createT` is pure: the app passes message objects in.
- Fail at startup when `src/intl.config.ts` is missing, a configured locale has no catalog file, overlapping `i18n` keys are already set on `defineConfig`, or `@astrojs/sitemap`'s `i18n` option is set.

## Out of scope

- Pairing, path compile, query helpers, `<Hreflang />`.
- A virtual module for **catalogs**.
