# Sit on Astro i18n

How this snapshot builds multilingual content sites on Astro’s own i18n. Use this as the yardstick for **intl** and for **starter**. Glossary: `CONTEXT.md` (`slug`, pairing `id`, `section`).

## What

Sit on Astro i18n. Enhance it. Do not replace it.

Astro already owns locale prefixing, `getRelativeLocaleUrl`, `Astro.currentLocale`, automatic routing, and content collections. We do not wrap those in a second name, and we do not add a second router.

The enhancement is what Astro does not own: **catalogs** (`t()`) and **pairing** documents across locales. A routed entry (file collection or CMS) carries three fields:

- `id` — same document across locales
- `locale` — which sibling this is
- `slug` — the public tail after the locale prefix

That is the wire. Everything else is the user’s Astro: folders, file routes vs a catch-all, chrome, how a document is rendered.

Two products, two jobs:

- **intl** (`@repo/astro-intl`) — locales written through to Astro `i18n`, catalogs, pairing, lookup by id and by locale+slug. It does not own folders, page bodies, or which URLs the build emits.
- **starter** — an example of using intl, and an example of a CMS-like Astro site. It registers content URLs, missing-locale, and sitemap/RSS printers. It has to pass the same bar. A starter convention that fights Astro is still cost.

## Why

Elegant and least friction. Offer the pairing + catalog layer without the cost of an over-engineered Astro extension. Small, flexible, just works, get out of the way.

`id` + `locale` + `slug` are required because something has to join siblings and name the public tail. They are the smallest contract that works for Astro collections and a CMS.

## How to apply

**The test.** If deleting a piece would make the site look more like ordinary Astro and pairing still works, it was cost, not enhancement. Do not add a concept the user has to learn _instead of_ Astro.

**Do not wrap Astro.** Use `astro:i18n` and `astro:content` under their own names. Intl writes locales / prefix policy into `defineConfig.i18n`; it does not invent a parallel prefix API. Automatic routing is enough when `slug` is the full public tail and `prefixDefaultLocale` is true.

**Intl has no opinion on `pages/` or `layouts/`.** Collection roles and page types are starter convention. New _kind_ of document in starter → a new body file. New _document_ of an existing kind → no new file route.

**Starter must look like Astro.** Layouts are chrome (`SiteLayout` in `layouts/`). Document bodies the catch-all loads live in `pages/_pages/` (Astro ignores `_`, so they are not routes). 404 is a file route. Do not park page work in `layouts/`. Do not put `AGENTS.md` in `pages/` (`.md` there becomes a route).

**One catch-all.** Content URLs go through `[locale]/[...path].astro`. It finds the document and picks a `_pages` body via the starter kind map (`pageName`). Do not add per-section file routes, `[locale]/index.astro` for home, or a per-entry path to a body file. `pageType` stays on the mixed pages collection (home vs listing); other collections map from the collection name. Missing-locale uses the same public tail in the default locale, then that locale’s home, then 404 — not pairing.

**Who publishes URLs.** Intl joins documents. Starter lists the pages. Astro matches the file. Intl keeps one table (pairing `id` + `locale` + `slug`): uniqueness of `(id, locale)` and of `(locale, slug)`, lookup by locale+slug, sibling slugs. Starter’s `getStaticPaths` registers which URLs get HTML. It asks intl for one list of paired `locale`+`slug` (not catch-all params) and maps those to params, including homepage `/` → `undefined`. Do not keep a getStaticPaths-shaped helper on intl. Missing-locale, sitemap, and RSS stay in starter. Alternate-language data is pairing; the tags are starter’s to print. Do not copy the pairing walk into starter, keep a second path list, or add a package. Intl is not a router: it does not own catch-all params, sitemap `loc`s, or canonical/hreflang `href`s.

**Do not fix translated sections with pathnames or `routing: "manual"`** unless that is an explicit request. A pathnames map would own the section while the entry already owns the full tail. Localized `pages/en/blog` vs `pages/de/artikel` folders fight the CMS story.

**Do not pair on `slug`.** Pairing is `id`. The locale-section list only checks that a `slug` matches that locale’s section; it does not write URLs.
