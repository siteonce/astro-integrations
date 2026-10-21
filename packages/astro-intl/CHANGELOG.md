# @siteonce/astro-intl

## 0.1.1

### Patch Changes

- [`ee03108`](https://github.com/siteonce/astro-integrations/commit/ee03108716e973f15eab48435afaa049ed6507e9) Thanks [@marcwiest](https://github.com/marcwiest)! - `listingPaths` rows keep your app's `Locale` and entry types. In 0.1.0, the published declarations typed each row's `locale` as `string` and `page.data` as a generic entry list, so `astro check` failed when a listing view passed them to code typed for your locales or your collection's entries. `staticPaths` and `fallbackPaths` now also return named row types.
