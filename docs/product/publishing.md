# Publishing

Who emits URLs. Intl joins entries. The app lists the pages. Astro matches the file. Contract for joining: [`intl.md`](intl.md).

## Content URLs

List helpers return pairing (`locale` + `slug`), not route params. The app’s `getStaticPaths` maps those to params, including homepage `/` → no path param.

A **section** is per locale. The entry `slug` is the leaf after that section. A pathnames map or `routing: "manual"` is an explicit request, not the default.

Reserved tails come from Astro’s resolved routes, plus any the app names. The catch-all is ignored. A file route wins over a paired entry on the same tail. A dummy file route is not required to prove a reserved tail.

## Missing entry

The app owns a path whose entry is absent. Intl returns the default-locale entry at that same tail. The app chooses the redirect or not-found.

A published tail with no entry is still a URL.

## Sitemap

The app installs and registers `@astrojs/sitemap`. `@repo/astro-intl-sitemap` is glue the app passes in: published locs, a filter, and alternates.

The glue does not call `sitemap()`, does not enable the sitemap `i18n` option, and does not emit extra URLs.

A published tail with no entry is still a URL. The sitemap lists it. Its alternates are the other locales on that row.

The filter drops `rss.xml`, `robots.txt`, and `/_og`. Alternates and `x-default` for an entry come from pairing. `x-default` is the default locale.

Alternate-language tags are the app’s to print. For a tail with no entry they use the other locales on that row. Switcher data for an entry is pairing. Chrome policy is the app’s. See [`site.md`](site.md).

Drafts stay out of the production sitemap because those routes are not built.

## RSS

RSS stays in the app. Feeds are per locale (`/<locale>/rss.xml`). A root feed would mix languages or duplicate the default locale. `rss.xml` is a reserved tail.

Channel copy comes from catalogs. Item links come from pairing. Items are excerpts.

The feed route must leave pairing data available for sitemap serialize during the build.

## Robots

`robotsTxt` builds the body from site and deploy config. It is not a route the package owns. The app serves it.

Preview emits `Disallow: /`. Production and local emit scraper rules, `Allow: /`, and the sitemap URL.

**Seo** `noindex` is per page. It does not feed robots rules.
