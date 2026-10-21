---
'@siteonce/astro-intl': patch
---

`listingPaths` rows keep your app's `Locale` and entry types. In 0.1.0, the published declarations typed each row's `locale` as `string` and `page.data` as a generic entry list, so `astro check` failed when a listing view passed them to code typed for your locales or your collection's entries. `staticPaths` and `fallbackPaths` now also return named row types.
