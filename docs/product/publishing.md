# Publishing

Who emits URLs. Intl joins entries and injects one route per row and locale. Each view lists its own URLs. Contract for joining and injection: [`intl.md`](intl.md).

## Content URLs

There is no catch-all. A view is a full Astro page. Its `getStaticPaths` returns intl’s helper for its route: one path per URL that locale publishes, including each numbered listing page. A locale that does not publish a row’s tail gets no page: no file in the build, a 404 in dev.

Listing pages come from Astro’s `paginate()`. Intl rebuilds each page’s `page.url` through `astro:i18n`, so pager links match every other link.

A **section** is per locale. On a `{slug}` row the entry `slug` is the leaf after that section. A pathnames map or `routing: "manual"` is an explicit request, not the default.

A file route shaped like an injected route aborts startup. A literal file route on an entry’s URL is served by Astro. The file route wins. `astro build` warns that the `[slug]` route conflicts with the higher-priority route, skips the entry’s page, and exits 0. `astro dev` serves the file route without a warning. The sitemap still lists the URL with the entry’s alternates. The siblings’ hreflang still point at that URL.

## Missing entry

The config names the app’s fallback view (`fallbackView`) for every `{slug}` row, or none. A `{slug}` row may name its own, or `false` for none. In each locale that is not the default, intl injects it for default-locale entries that have no translation, and passes the default-locale entry and its URL. The app chooses the redirect or a notice. With none, those URLs 404.

The starter redirects to the default-locale entry. A static build writes a meta refresh with `noindex` and a canonical to the target. Dev answers with a 302.

A published tail with no entry is still a URL.

## URL form

The starter sets `trailingSlash: "always"`. Intl builds every URL through `astro:i18n`, so links follow `trailingSlash` and `build.format`. Intl warns at startup when the two disagree.

A URL typed in the other form is the host’s to redirect. Customers’ hosts are unknown, so the snapshot ships no redirect rules. Dev answers it with Astro’s 404 page, which links to the right form. Every page names its address with a canonical link, so a host that serves both forms creates no duplicate pages for search engines.

## Sitemap

The app installs and registers `@astrojs/sitemap`. Intl hands the app `customPages`, `serialize`, and `filter` as `astroIntl(intlConfig).sitemap`. The app registers the printer after intl. Each piece stands alone. The app can pass it through, wrap it, or replace it.

- `customPages` lists every URL pairing publishes, including on-demand ones. The app can add its own URLs to it. Intl keeps them.
- `serialize` adds each URL's alternates and `x-default`. It leaves URLs pairing does not know unchanged.
- `filter` drops intl's build-only data route and nothing else. The app combines it with its own filter. An app that replaces it lists that route.

The starter combines intl's filter with its own. Its own filter drops `rss.xml`, `robots.txt`, and `/_og`.

Intl builds one hidden data route under `/_intl/` during `astro build`. It carries pairing from the content collections to the sitemap options. Intl removes its output before the build ends, so the deployed site does not serve it. No app route has to feed the sitemap.

Intl does not call `sitemap()`, does not enable the sitemap `i18n` option, and does not emit extra URLs.

An app may build its sitemap without `@astrojs/sitemap`. The sitemap entries intl hands page code carry each URL, its alternates, and `x-default`: the same data `serialize` prints. The starter uses `@astrojs/sitemap`.

A published tail with no entry is still a URL. The sitemap lists it. Its alternates are the locales that publish that tail.

Alternates and `x-default` for an entry come from pairing. `x-default` is the default locale.

Alternate-language tags are the app’s to print. For a tail with no entry they use the locales that publish that tail. Switcher data for an entry is pairing. Chrome policy is the app’s. See [`site.md`](site.md).

Drafts stay out of the production sitemap because those routes are not built.

## RSS

RSS stays in the app. Each locale’s feed is `rss.xml` under that locale’s home. With `prefixDefaultLocale: false`, the default locale’s feed is `/rss.xml`. Other locales’ feeds are `/<locale>/rss.xml`. It is not a mixed-language root feed.

Channel copy comes from catalogs. Item links come from pairing. Items are excerpts.

## Robots

The starter owns `robots.txt` as a prerendered endpoint. The customer edits it directly.

Preview emits `Disallow: /`. Production and local emit scraper rules, `Allow: /`, and the sitemap URL.

**Seo** `noindex` is per page. It does not feed robots rules.
