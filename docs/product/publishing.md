# Publishing

Who emits URLs. Intl joins documents. The app lists the pages. Astro matches the file. Contract for joining: [`intl.md`](intl.md).

## Content URLs

List helpers return pairing (`locale` + `slug`), not route params. The app’s `getStaticPaths` maps those to params, including homepage `/` → no path param.

A **section** is per locale. The entry `slug` is the leaf after that section. A pathnames map or `routing: "manual"` is an explicit request, not the default.

Reserved tails come from Astro’s resolved routes, plus any the app names. The document catch-all is ignored. A file route wins over a paired document on the same tail. A dummy file route is not required to prove a reserved tail.

## Missing locale

Missing-locale is an intl helper. It is not a router and it does not emit extra URLs.

It redirects to the default-locale document at the same tail, then to home in the requested locale. If neither exists, the helper returns not-found and the app rewrites the 404 route.

## Sitemap

The app installs and registers `@astrojs/sitemap`. `@repo/astro-intl-sitemap` is glue the app passes in: document locs from pairing, a filter, and alternates.

The glue does not call `sitemap()`, does not enable the sitemap `i18n` option, and does not emit extra URLs.

The filter drops `rss.xml`, `robots.txt`, and `/_og`. Alternates and `x-default` come from pairing. `x-default` is the default locale.

Alternate-language tags are the app’s to print. Switcher data is pairing. Chrome policy is the app’s. See [`site.md`](site.md).

Drafts stay out of the production sitemap because those routes are not built.

## RSS

RSS stays in the app. Feeds are per locale (`/<locale>/rss.xml`). A root feed would mix languages or duplicate the default locale. `rss.xml` is a reserved tail.

Channel copy comes from catalogs. Item links come from pairing. Items are excerpts.

The feed route must leave pairing data available for sitemap serialize during the build.

## Robots

`robotsTxt` builds the body from site and deploy config. It is not a route the package owns. The app serves it.

Preview emits `Disallow: /`. Production and local emit scraper rules, `Allow: /`, and the sitemap URL.

**Seo** `noindex` is per page. It does not feed robots rules.
