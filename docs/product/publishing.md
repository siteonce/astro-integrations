# Publishing

Who emits URLs. Intl joins entries and injects one route per row and locale. Each view lists its own URLs. Contract for joining and injection: [`intl.md`](intl.md).

## Content URLs

There is no catch-all. A view is a full Astro page. Its `getStaticPaths` returns intl’s helper for its route: one path per URL that locale publishes, including each numbered listing page. A locale that does not publish a row’s tail gets no page: no file in the build, a 404 in dev.

Listing pages come from Astro’s `paginate()`. Intl rebuilds each page’s `page.url` through `astro:i18n`, so pager links match every other link.

A **section** is per locale. On a `{slug}` row the entry `slug` is the leaf after that section. A pathnames map or `routing: "manual"` is an explicit request, not the default.

Reserved tails come from Astro’s resolved routes, plus any the app names. Intl’s own injected routes reserve nothing, and neither does a file route with a dynamic segment after `[locale]`. A paired entry on a reserved tail aborts the build. A file route that would serve a URL an injected route emits aborts startup. A dummy file route is not required to prove a reserved tail.

## Missing entry

The config names the app’s fallback view (`fallbackView`) for every `{slug}` row, or none. A `{slug}` row may name its own, or `false` for none. In each locale that is not the default, intl injects it for default-locale entries that have no translation, and passes the default-locale entry and its URL. The app chooses the redirect or a notice. With none, those URLs 404.

The starter redirects to the default-locale entry. A static build writes a meta refresh with `noindex` and a canonical to the target. Dev answers with a 302.

A published tail with no entry is still a URL.

## URL form

The starter sets `trailingSlash: "always"`. Intl builds every URL through `astro:i18n`, so links follow `trailingSlash` and `build.format`. Intl warns at startup when the two disagree.

A URL typed in the other form is the host’s to redirect. Customers’ hosts are unknown, so the snapshot ships no redirect rules. Dev answers it with Astro’s 404 page, which links to the right form. Every page names its address with a canonical link, so a host that serves both forms creates no duplicate pages for search engines.

## Sitemap

The app installs and registers `@astrojs/sitemap`. `@repo/astro-intl-sitemap` is glue the app passes in: published locs, a filter, and alternates.

The glue does not call `sitemap()`, does not enable the sitemap `i18n` option, and does not emit extra URLs.

A published tail with no entry is still a URL. The sitemap lists it. Its alternates are the locales that publish that tail.

The filter drops `rss.xml`, `robots.txt`, and `/_og`. Alternates and `x-default` for an entry come from pairing. `x-default` is the default locale.

Alternate-language tags are the app’s to print. For a tail with no entry they use the locales that publish that tail. Switcher data for an entry is pairing. Chrome policy is the app’s. See [`site.md`](site.md).

Drafts stay out of the production sitemap because those routes are not built.

## RSS

RSS stays in the app. Feeds are per locale (`/<locale>/rss.xml`). A root feed would mix languages or duplicate the default locale. `rss.xml` is a reserved tail.

Channel copy comes from catalogs. Item links come from pairing. Items are excerpts.

The feed route must leave pairing data available for sitemap serialize during the build.

## Robots

`robotsTxt` builds the body from site and deploy config. It is not a route the package owns. The app serves it.

Preview emits `Disallow: /`. Production and local emit scraper rules, `Allow: /`, and the sitemap URL.

**Seo** `noindex` is per page. It does not feed robots rules.
