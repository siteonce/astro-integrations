# Upstream Astro i18n

Status: upstream research only. Not an implementation spec. Does not describe this snapshot’s `astro` package.

Researched: 2026-09-15. Docs and GitHub pages as fetched that day. Current public docs describe Astro 7 (advanced routing marked **Added in:** `astro@7.0.0`). i18n routing itself has been stable since Astro 4.0.

If a planned feature is unclear, this note says so. It does not infer Astro’s intent beyond what maintainers wrote.

---

## 1. Executive summary

**Stable (use it, do not reimplement):** locale-prefix routing (`prefixDefaultLocale`, `redirectToDefaultLocale`), `routing: "manual"` plus the `astro:i18n` middleware helpers, per-locale fallback (`i18n.fallback` + `fallbackType: "redirect" | "rewrite"`), custom locale `{ path, codes }` objects, domains-per-locale (SSR, with limits), and the `astro:i18n` URL helpers (`getRelativeLocaleUrl` and siblings). `astro:config/client` exposes the resolved `i18n` config. Astro 7 also exposes i18n as a pipeline handler `i18n()` from `astro/fetch` / `astro/hono`.

**Ours to build (core does not own these, and has said so or left them out):** message catalogs / dictionaries; next-intl-style per-route `pathnames` (`/about` → `/über-uns`); CMS-shaped document pairing (`id` + `locale` + `path`). Official docs point at a recipe and at community integrations for those layers. RFC 0045 listed dictionaries and SEO as non-goals. Maintainers have repeatedly treated translated slugs as opinionated and a better fit for an integration than core.

**Do not wait on core for pathnames or catalogs.** The live Stage 1 RFC for Next.js-style pathnames ([roadmap #1176](https://github.com/withastro/roadmap/discussions/1176), Jun 2025) was not accepted. A later proposal ([roadmap #1347](https://github.com/withastro/roadmap/discussions/1347), Apr 2026) is **closed** with no maintainer reply. Emanuele Stoppa wrote that core now has the routing infrastructure, but that the feature is opinionated and was left out of core on purpose. Chris Swithinbank suggested a community integration. Florian Lefebvre wanted a better story “no matter if it's in core or an integration,” and later floated `@astrojs/i18n-paths` without committing to it.

**How to sit on top:** consume Astro’s `i18n` config and wrap `getRelativeLocaleUrl` / `getAbsoluteLocaleUrl` for the locale-prefix (and domain) layer. Add path aliases and catalogs in the integration. If path aliases require rewrites that file-based routes cannot see, use `routing: "manual"` and either sequence Astro’s `middleware()` with ours, or (Astro 7) compose `i18n()` after pages. Do not invent a parallel `localePrefix` or a `getPathname` that duplicates `getRelativeLocaleUrl`.

---

## 2. Today’s Astro i18n surface

Astro’s i18n is a **routing** API. The internationalization guide opens: it helps you “generate, use, and verify the URLs that your multi-language site produces.” It is not a translation framework. That split is explicit in RFC 0045 and in the official recipe.

### 2.1 Config keys

From the [configuration reference](https://docs.astro.build/en/reference/configuration-reference/) (`i18n` section) and the [i18n guide](https://docs.astro.build/en/guides/internationalization/).

| Key | Type | Added | Default | Role |
|---|---|---|---|---|
| `i18n.locales` | `Locales` (string codes, or `{ path, codes }`) | `astro@3.5.0` | required | Supported locales. Folder names must match `locales` items, or the `path` when using objects. |
| `i18n.defaultLocale` | `string` | `astro@3.5.0` | required | Must be one of `locales`. |
| `i18n.fallback` | `Record<string, string>` | `astro@3.5.0` | none (404) | Missing locale page → another locale. Unconfigured locales 404. |
| `i18n.routing` | `object \| "manual"` | `astro@3.7.0` | object | Prefix / redirect / fallback-type, or disable built-in middleware. |
| `i18n.routing.prefixDefaultLocale` | `boolean` | `astro@3.7.0` | `false` | `false`: default locale has no `/[locale]/` prefix. `true`: every locale is prefixed. |
| `i18n.routing.redirectToDefaultLocale` | `boolean` | `astro@4.2.0` | `false` **as of Astro 6** | Only valid when `prefixDefaultLocale: true`. If true, `/` from `src/pages/index.astro` redirects to `/[defaultLocale]`. |
| `i18n.routing.fallbackType` | `"redirect" \| "rewrite"` | `astro@4.15.0` | `"redirect"` | How `i18n.fallback` is applied. |
| `i18n.domains` | `Record<string, string>` | config: `astro@4.3.0`; guide: `astro@4.9.0` | `{}` | Per-locale domain/subdomain. See §2.7. |

`routing: "manual"` may not be combined with the other `routing` object keys in config. Those keys are passed later to `middleware()` from `astro:i18n`.

Invalid combo: `redirectToDefaultLocale: true` without `prefixDefaultLocale: true` throws `InvalidI18nMiddlewareConfiguration` (infinite-loop risk). Documented at [Invalid internationalization middleware configuration](https://docs.astro.build/en/reference/errors/invalid-i18n-middleware-configuration/).

### 2.2 Routing modes (locale prefix)

From the [i18n guide](https://docs.astro.build/en/guides/internationalization/#routing):

**`prefixDefaultLocale: false` (default).** Default-locale files live at `src/pages/` root. Other locales live in `src/pages/<locale>/`. URLs: `/about/` vs `/fr/about/`. Visiting `/en/about/` (default locale prefixed) is treated as invalid for this strategy.

**`prefixDefaultLocale: true`.** Every locale, including default, is prefixed. `src/pages/index.astro` is still required. Unprefixed URLs 404 unless fallback is configured. `redirectToDefaultLocale` only applies here: when `true`, `/` redirects to `/[defaultLocale]/`.

**`routing: "manual"` (Added `astro@4.6.0`).** Astro disables its i18n middleware. The app (or integration) must implement routing, or call `middleware()` from `astro:i18n` with `sequence()`.

Astro implements the non-manual strategies with middleware that is **first in the chain** but **awaits every later `Response`** (user middleware + page) before applying its own logic (verify localized URL, fallback, 404). The guide: “operations (e.g. redirects) from your own middleware and your page logic are run first, your routes are rendered, and then the i18n middleware performs its own actions.”

Astro 7 advanced routing makes that order explicit. Default pipeline: trailing-slash → redirects → sessions → actions → user middleware → pages → **i18n** → cache. The `i18n()` handler “post-processes a response against your i18n configuration. Handles locale redirects, 404s for invalid locales, and fallback routing. Call this after rendering.” ([Routing guide](https://docs.astro.build/en/guides/routing/#advanced-routing), **Added in:** `astro@7.0.0`.)

Resolved strategy names on `SSRManifest.i18n.strategy` (integration/adapter API): `"manual" | "pathname-prefix-always" | "pathname-prefix-other-locales" | "pathname-prefix-always-no-redirect" | "domains-prefix-always" | "domains-prefix-other-locales" | "domains-prefix-always-no-redirect"`.

`IntegrationResolvedRoute.fallbackRoutes` (**Added in:** `astro@6.1.0`) lists routes a route falls back to when the requested locale is missing.

### 2.3 `astro:i18n` helpers

From the [Internationalization API Reference](https://docs.astro.build/en/reference/modules/astro-i18n/). Module **Added in:** `astro@3.5.0`. Returned URLs for `defaultLocale` follow `i18n.routing`. Helpers also respect `base`, `trailingSlash`, `build.format`, and `site`.

**URL builders (always available when i18n is configured):**

| Helper | Type | Notes |
|---|---|---|
| `getRelativeLocaleUrl(locale, path?, options?)` | `string` | Throws if locale is unknown. |
| `getAbsoluteLocaleUrl(locale, path?, options?)` | `string` | Absolute when `site` is set; else relative. Honors `i18n.domains`. |
| `getRelativeLocaleUrlList(path?, options?)` | `string[]` | One URL per locale. |
| `getAbsoluteLocaleUrlList(path?, options?)` | `string[]` | Same, absolute. |

`GetLocaleOptions`: `prependWith?: string`, `normalizeLocale?: boolean` (default `true`; lowercases and replaces `_` with `-`).

These helpers **prefix a locale onto a path you already chose**. They do not translate path segments. `getRelativeLocaleUrl("fr", "about")` → `/fr/about`, never `/fr/a-propos`, unless `about` is already the French slug.

**Custom locale path/code mapping:**

| Helper | Added | Role |
|---|---|---|
| `getPathByLocale(locale)` | (with custom paths) | Code → URL `path` (`"fr-CA"` → `"french"`). |
| `getLocaleByPath(path)` | | Path → first configured `code`. |
| `toCodes(locales)` | `astro@4.0.0` | First code per locale entry. |
| `toPaths(locales)` | `astro@4.0.0` | Configured URL paths. |
| `normalizeTheLocale(locale)` | | `_` → `-`, lowercase. |
| `pathHasLocale(path)` | `astro@4.6.0` | Whether a path contains a configured locale/path. Use before helpers that require a locale in the URL ([`i18nNoLocaleFoundInPath`](https://docs.astro.build/en/reference/errors/i18n-no-locale-found-in-path/)). |

**Manual-routing only (`routing: "manual"`, Added `astro@4.6.0`):**

| Helper | Type | Role |
|---|---|---|
| `redirectToDefaultLocale(context, statusCode?)` | `Promise<Response>` | Redirect to `defaultLocale`. |
| `redirectToFallback(context, response)` | `Promise<Response>` | Apply `i18n.fallback` in user middleware. |
| `notFound(context, response?)` | `Promise<Response> \| undefined` | 404 when path is not root and has no locale. Can copy headers from an existing `Response`. |
| `middleware({ fallbackType, prefixDefaultLocale, redirectToDefaultLocale })` | `MiddlewareHandler` | Rebuild Astro’s i18n middleware to `sequence()` with your own. |
| `requestHasLocale(context)` | `boolean` | Current `APIContext#url.pathname` contains a configured locale. |

`redirectToFallback` originally triggered on `status >= 300`. That intercepted legitimate 3xx from page handlers ([issue #15688](https://github.com/withastro/astro/issues/15688), Feb 2026). Fixed in [#15704](https://github.com/withastro/astro/pull/15704) to **404 only**. Docs examples that still say `if (response.status >= 300)` are stale relative to that fix.

### 2.4 Runtime locale on `Astro`

From the i18n guide and [API reference](https://docs.astro.build/en/reference/api-reference/#preferredlocale):

- `Astro.currentLocale` (**Added in:** `astro@3.5.6`): from the current URL. If the URL has no `/[locale]/` prefix, this is `i18n.defaultLocale`. Available on static pages too.
- `Astro.preferredLocale` / `Astro.preferredLocaleList` (**Added in:** `astro@3.5.0`): `Accept-Language` ∩ configured `locales`/`codes`. **On-demand routes only.**

`astro:config/client` and `astro:config/server` both export `i18n` (**Added in:** `astro@5.7.0`).

### 2.5 Fallback (missing locale page)

Two knobs, from the [i18n guide](https://docs.astro.build/en/guides/internationalization/#fallback) and config reference:

1. **Which** locale: `i18n.fallback: { fr: "es" }`. Astro ensures a page exists in `src/pages/fr/` for every page in `src/pages/es/`.
2. **How**: `i18n.routing.fallbackType`:
   - `"redirect"` (default): visitor is sent to the fallback locale URL.
   - `"rewrite"` (**Added in:** `astro@4.15.0`, [Astro 4.15 blog](https://astro.build/blog/astro-4150/)): same URL, fallback locale’s content, HTTP 200. Example: missing `src/pages/fr/about.astro` still yields `dist/fr/about.html` with English/Spanish content.

If `i18n.fallback` does not name the locale, the missing page is a **404**.

Manual routing: call `redirectToFallback()` (and pass `fallbackType` into `middleware()`). A bug where `middleware()` ignored `i18n.fallback` was fixed in Dec 2024 ([#12431](https://github.com/withastro/astro/issues/12431) / [#12718](https://github.com/withastro/astro/pull/12718)). Fallback rewrites in server/hybrid output had a further fix in Jul 2025 ([#14017](https://github.com/withastro/astro/pull/14017)).

There is **no documented third mode** (soft 404, “untranslated” banner, content-level fallback). Starlight implements that itself; see §7.

### 2.6 Custom locale `path` / `codes`

Not per-route aliases. One URL prefix can map to several BCP-47 codes for `Accept-Language`:

```js
locales: ["es", "en", { path: "french", codes: ["fr", "fr-BR", "fr-CA"] }]
```

Folder name and URL prefix are `path` (`/french/...`). `codes` match the browser. `getRelativeLocaleUrl` should be called with the **path** value (docs: “use the `path` as the value for `locale`”). `getPathByLocale("fr-CA")` → `"french"`; `getLocaleByPath("french")` → first code.

Shipped in the original i18n design (RFC 0045; 4.0 blog called it “aliasing for common locales and language codes”).

### 2.7 Domains-per-locale

[Guide](https://docs.astro.build/en/guides/internationalization/#domains) **Added in:** `astro@4.9.0`. Config reference **Added in:** `astro@4.3.0`. [Astro 4.3 blog](https://astro.build/blog/astro-430/) shipped it as experimental `experimental.i18nDomains`. Treat **4.3 = experimental, 4.9 = stable** unless a changelog line says otherwise; the two “Added in” dates disagree.

Limits (guide):

- `site` required.
- `output: "server"`.
- No individual prerendered pages.
- Adapters originally called out: `@astrojs/node`, `@astrojs/vercel`.
- Relies on `X-Forwarded-Host` / `Host` and `X-Forwarded-Proto`. Missing headers → 404.

Mapped locales drop the `/[locale]/` prefix on that domain. Unmapped locales follow `prefixDefaultLocale`. `getAbsoluteLocaleUrl()` / `getAbsoluteLocaleUrlList()` use `i18n.domains`.

### 2.8 Content collections: official recipe, not a pairing API

The i18n guide does not define collections. The [Add i18n features recipe](https://docs.astro.build/en/recipes/i18n/) (still published) says built-in i18n routing arrived in v4.0 and points at the guide **if you want that instead**. The recipe still shows a **user-land** stack:

1. **Pages:** one folder per language under `src/pages/`, plus a root redirect to the default language.
2. **Collections:** `src/content/blog/en/post-1.md` and `src/content/blog/fr/post-1.md`. `getStaticPaths` splits `page.id` on `/` into `lang` + `slug`. Same filename is the only pairing. No `id` / `locale` / `path` fields in the schema.
3. **UI strings:** `src/i18n/ui.ts` dictionaries and a `t()` helper. Missing keys fall back to the default language. RFC 0045 listed this as a **non-goal** for core.
4. **Translate routes (user-land pathnames):** a `routes` map in `ui.ts` (`fr.services` → `"prestations-de-service"`) and `useTranslatedPath`. This is the official docs’ answer to `/about` → `/über-uns`: **you write it**.

Content Layer (Astro 5, required in 6) did not add i18n pairing. Collection `id` is a slug; `filePath` is the file. Live collections (`getLiveEntry`) are request-time loaders, not a CMS document model.

Astro 5.14 added `routePattern` on `getStaticPaths` so user helpers can localize **dynamic route segments** (`[...locale]/[files]/[slug]`). That is an escape hatch for generating static paths, not a pathnames config. ([Astro 5.14 blog](https://astro.build/blog/astro-5140/).)

### 2.9 Sitemap i18n (separate, prefix-naive)

[`@astrojs/sitemap` `i18n`](https://docs.astro.build/en/guides/integrations-guide/sitemap/#i18n) is **not** wired to `astro.config` `i18n`. You pass `{ defaultLocale, locales: Record<string, string> }`. The key is “used to look for a locale part in a page path.” Alternates assume the same slug under a different prefix (`/second-page/` ↔ `/es/second-page/`). Florian Lefebvre (Jul 31, 2025, #1176): “the official sitemap i18n handling is too naive for this atm” (translated paths).

### 2.10 Version timeline (shipped)

| When | What | Source |
|---|---|---|
| 2023-10-19 | RFC 0045 written | [roadmap/proposals/0045-i18n-routing.md](https://github.com/withastro/roadmap/blob/main/proposals/0045-i18n-routing.md) |
| 2023-11-08 | Experimental i18n (`experimental.i18n`) | [Astro 3.5](https://astro.build/blog/astro-350/) |
| 2023-12-05 | i18n routing **stable** | [Astro 4.0](https://astro.build/blog/astro-4/) |
| 2024-01-18 | `redirectToDefaultLocale` (default **true** then) | [Astro 4.2](https://astro.build/blog/astro-420/) |
| 2024-02-01 | `i18n.domains` experimental | [Astro 4.3](https://astro.build/blog/astro-430/) |
| 2024-04-11 | `routing: "manual"` + middleware helpers | [Astro 4.6](https://astro.build/blog/astro-460/) |
| ~4.9 | domains documented stable (guide `4.9.0`) | i18n guide |
| 2024-08-29 | `fallbackType: "rewrite"` | [Astro 4.15](https://astro.build/blog/astro-4150/) |
| 2025-09-25 | `getStaticPaths` `routePattern` | [Astro 5.14](https://astro.build/blog/astro-5140/) |
| Astro 6.0 | `redirectToDefaultLocale` default **false**; only with `prefixDefaultLocale: true` | [Upgrade to v6](https://docs.astro.build/en/guides/upgrade-to/v6/) |
| 2026-02 | Fallback middleware 404-only | [#15704](https://github.com/withastro/astro/pull/15704) |
| 2026-05-07 | Experimental advanced routing; `i18n()` handler | [Astro 6.3](https://astro.build/blog/astro-630/) |
| 2026-06-22 | Advanced routing **stable** | [Astro 7.0](https://astro.build/blog/astro-7/) |

There is **no current experimental flag for i18n routing**. `experimental.i18n` died in 4.0. `experimental.i18nDomains` died when domains stabilized. The v6 upgrade list of removed experimental flags does not include i18n.

---

## 3. Roadmap / RFCs / open issues

### 3.1 RFC 0045 — i18n routing — **implemented**

[proposals/0045-i18n-routing.md](https://github.com/withastro/roadmap/blob/main/proposals/0045-i18n-routing.md). Start date 2023-10-19. Shipped experimental 3.5, stable 4.0.

**Goals that shipped:** locale prefixes; default locale without prefix; redirect to default locale when prefix enabled; `astro:i18n` APIs; `Accept-Language`; fallback; `{ path, codes }`; domains (later).

**Non-goals (still accurate against today’s docs):**

- Localised data (dates, numbers, plurals)
- **Dictionaries** where users store translations of pre-defined words
- SEO optimisations

The RFC’s `prefixDefaultLocale` boolean is **inverted** relative to the shipped API. Do not use RFC 0045 as the config reference. Use current docs.

Unresolved in the RFC (folder location of locale dirs; typing `astro:i18n`) did not block shipping. Locale folders may live anywhere under `src/pages/`; names must match `locales` / `path`.

### 3.2 Roadmap discussion #795 — i18n routing enhancements — **partially shipped**

[withastro/roadmap#795](https://github.com/withastro/roadmap/discussions/795). Emanuele Stoppa, 2023-12-14. Goals: domain support; translate 404 and 500 pages; disable `/` → `/<defaultLocale>` when `prefixDefaultLocale: true`.

**Shipped:** domains; `redirectToDefaultLocale`. **Not shipped as a first-class i18n API:** translated 404/500 pages.

On **translated slugs**, 2023–2024 thread:

- Users asked for `getAlternateUrl('about.astro', 'es')` → `/es/sobre-nosotros` and for not assuming slug = filename.
- Stoppa (2024-03-08): wanted it in **configuration** (must work in middleware, SSR, edge; frontmatter is insufficient; skeptical of another known file). Also: “we still lack the infrastructure to do so.”
- Stoppa later (2025-07-31, on #1176): that infrastructure **now exists**.

No core API for this followed.

### 3.3 Roadmap discussion #1176 — Next.js-style pathnames — **Stage 1, not accepted**

[withastro/roadmap#1176](https://github.com/withastro/roadmap/discussions/1176). Opened 2025-06-01. Florian Lefebvre (2025-06-04): **Stage 1 RFC**; must go through the whole RFC process; gather feedback. No later comment on that thread marks it Stage 2 / accepted / implemented.

Proposal: `i18n.pathnames` map, middleware rewrite localized URL → canonical file route, optional redirect the other way. Dynamic segments (`/places/[slug]` → `/yerler/[slug]`). Single page file, no per-locale copies.

Maintainer comments (quoted, not paraphrased as intent beyond the words):

- **Matt Kane (ascorbic), 2025-06-02:** integrate with [existing i18n](https://docs.astro.build/en/guides/internationalization/); a separate config file “would [not] make sense.”
- **Florian Lefebvre, 2025-06-02:** “I definitely want a better story for translated paths in astro, **no matter if it's in core or an integration**.” Points at Nuxt `setI18nParams`.
- **Emanuele Stoppa, 2025-07-31:** localized paths were **not** added to core because (1) not all users need it, (2) localisation of paths can be done in different ways and was “not a blocker for i18n” in the original implementation, (3) at the time Astro lacked routing infrastructure (`/it/saluti` would 404 because the file did not exist). “However, core now has the infrastructure to support such a feature.” Also: he and Matthew were hesitant about “being opinionated”; “we thought it was best to **delegate this to an integration**, so users can use the package that fits their needs.”
- **Florian, 2025-07-31:** maybe `@astrojs/i18n-paths`; worry is sitemap interaction.
- **Chris Swithinbank (delucis), 2025-07-31:** “Could also be a community integration”; integrations are composable with sitemap. On unmaintained community i18n packages: “Maybe also a sign we wouldn't get it right either.”
- **Florian, 2025-07-31:** “the fact that there have been 10-ish integrations and most of are now unmaintained is a signal that this is difficult to get right, and maybe too hard for the community to handle.” Official sitemap i18n is “too naive” for translated paths.

A collaborator argued for keeping slug translation out of core (lean core + plugin). That is one commenter’s view, not a recorded core decision. Stoppa’s “delegate to an integration” is the clearest maintainer statement on record.

**Status as of 2026-09-15:** discussion still open; not an accepted RFC; no implementation PR found in this research.

### 3.4 Roadmap discussion #1347 — localized slugs again — **closed**

[withastro/roadmap#1347](https://github.com/withastro/roadmap/discussions/1347). Opened 2026-04-23, **Closed**. Same request (`contact` → `nous-contacter` / `contacto`; `getRelativeLocaleUrl` should return the translated slug). No maintainer reply. Community: already solvable with middleware rewrite (`localizedSlug → canonicalSlug → getEntry()`). Unicode/NFC/fullwidth issues discussed by commenters only.

Closed without an accepted design. Do not treat it as a planned core feature.

### 3.5 Notable core issues (bugs, not new API)

| Issue | Date | Status | Relevance |
|---|---|---|---|
| [#12431](https://github.com/withastro/astro/issues/12431) fallback ignored with `middleware()` | 2024-11 | Fixed [#12718](https://github.com/withastro/astro/pull/12718) | Manual routing can use `i18n.fallback`. |
| [#14017](https://github.com/withastro/astro/pull/14017) fallback rewrite in server mode | 2025-07 | Merged | Rewrites need `fallbackRoutes` awareness. |
| [#15688](https://github.com/withastro/astro/issues/15688) fallback on all 3xx | 2026-02 | Fixed [#15704](https://github.com/withastro/astro/pull/15704) | Fallback is 404-only. |
| [#16501](https://github.com/withastro/astro/issues/16501) `pathname-prefix-other-locales` matches default locale in **any** segment | 2026-04 | Open (P3) when fetched | Workaround documented: `routing: "manual"`. |

No core issue or PR found that adds `pathnames`, catalogs, or CMS `id`+`locale`+`path` pairing.

### 3.6 Astro 5 → 6 i18n breaking changes

The [v6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/) documents **one** i18n break:

**`i18n.routing.redirectToDefaultLocale` default `true` → `false`.** Implementation: [feat(astro)!: update i18n.redirectToDefaultLocale default (#14406)](https://github.com/withastro/astro/pull/14406). Combined with `prefixDefaultLocale: false` (also default), the old pair could infinite-loop. In v6 it can only be used when `prefixDefaultLocale: true`. Manual `middleware({ redirectToDefaultLocale: true })` must also set `prefixDefaultLocale: true`.

No other i18n API removals in that guide. Content Layer becoming mandatory affects i18n **recipes** that still mention `entry.slug` / `entry.render()` (v6: use `id` and `render(entry)`).

Astro 6.3 experimental advanced routing (including `i18n()` as a composable handler) became **stable in 7.0**. That is additive composition of the same i18n logic, not a new i18n config.

---

## 4. Explicit gaps vs next-intl-style usage

| next-intl-shaped need | Astro core today | Planned in core? |
|---|---|---|
| Message catalogs (ICU, nested keys, `t()`) | No. RFC 0045 non-goal. Recipe: DIY `ui.ts`. Starlight: i18n collection + i18next, **Starlight-only**. | No RFC. |
| Locale prefix / `localePrefix` | Yes: `prefixDefaultLocale` + `redirectToDefaultLocale`. Different names. | Stable. |
| `pathnames` (`/about` → `/über-uns`) | No first-class map. Recipe “Translate Routes” is user-land. `{ path, codes }` is **locale prefix** aliasing, not per-route. | #1176 Stage 1, not accepted. #1347 closed. Maintainers: integration / opinionated. |
| Single page file, many localized URLs | File-based routing wants a file per URL, or a dynamic `[locale]` / `[...locale]` route plus `getStaticPaths`. Pathnames need rewrite. | Infrastructure exists (Stoppa, 2025-07-31); product not in core. |
| CMS document `id` + `locale` + `path` | Collections: `id` is slug, optional `filePath`. Recipe pairs by **same filename** under `en/` / `fr/`. No `locale` field. | No movement found. Content Layer is a generic loader; a loader *could* emit those fields, but core does not. |
| Fallback missing translation | Route-level redirect or rewrite only. No “show default copy with banner.” | Unclear. Starlight does the banner itself. |
| `hreflang` / sitemap for translated slugs | Sitemap `i18n` assumes same slug + prefix. | Florian: sitemap too naive for pathnames. |
| `getPathname` / `getRelativeLocaleUrl` that knows aliases | `getRelativeLocaleUrl` prefixes only. | Would have to land with pathnames; not accepted. |

**Custom locale `path`/`codes` is not pathnames.** `path: "french"` changes `/fr/` to `/french/`. It does not change `/about` to `/a-propos`.

---

## 5. Recommendation for an integration

### 5.1 Wrap vs reimplement vs `routing: "manual"`

**Wrap Astro’s locale-prefix layer. Do not reimplement it.**

Consume:

- `i18n.locales` / `defaultLocale` / `{ path, codes }` / `domains`
- `i18n.routing.prefixDefaultLocale` and `redirectToDefaultLocale` (v6 defaults)
- `i18n.fallback` + `fallbackType` if route-level fallback is enough
- `getRelativeLocaleUrl` / `getAbsoluteLocaleUrl` / list variants
- `getPathByLocale` / `getLocaleByPath` / `pathHasLocale`
- `Astro.currentLocale` (and `preferredLocale*` on demand)
- `i18n` from `astro:config/client`

Build in the integration (core will not):

- Catalogs / `t()`
- Per-route `pathnames`
- CMS-shaped collection entries (`id` + `locale` + `path`) and pairing
- `hreflang` / sitemap alternates when slugs differ
- Optional “missing translation” UI (Starlight-style), if wanted — Astro fallback will not do it

**Automatic routing** is enough when public URLs are `/{locale?}/{same-slug}/` and files (or a `[locale]` dynamic route) exist for those URLs.

**`routing: "manual"`** (or Astro 7 `i18n()` after a rewrite) is needed when the **public path is not the file path**: next-intl-style pathnames, or any rewrite from `/de/über-uns` to a canonical page. File-based routing will 404 `/de/über-uns` unless a file or rewrite exists. That is the gap Stoppa named in 2025, now solvable in user middleware.

Pattern for pathnames without abandoning Astro’s prefix/fallback:

```js
// astro.config: i18n.routing: "manual"
import { sequence } from "astro:middleware";
import { middleware as astroI18n } from "astro:i18n";

export const onRequest = sequence(
  pathnamesMiddleware, // rewrite localized path → canonical file route
  astroI18n({
    prefixDefaultLocale: true, // or false; must match URL policy
    redirectToDefaultLocale: false,
    fallbackType: "redirect",
  }),
);
```

Astro 7 alternative: rewrite in `src/fetch.ts` (or Hono) **before** `pages()`, then `i18n(state, response)` **after**. Do not skip `i18n()` if you still want Astro’s locale 404s and `i18n.fallback`.

Starlight is **not compatible** with `routing: "manual"` (throws). A docs-site integration that must coexist with Starlight cannot force manual routing.

### 5.2 Risks of inventing parallel APIs

**`localePrefix` (or any alias of `prefixDefaultLocale`).** Two sources of truth. Astro’s middleware and `getRelativeLocaleUrl` will follow `i18n.routing`, not our flag. v6 made `redirectToDefaultLocale` illegal unless `prefixDefaultLocale` is true. A second prefix policy will fight that. Map next-intl `localePrefix` **onto** `prefixDefaultLocale` / `redirectToDefaultLocale` when generating `astro.config` `i18n`, or document that authors set Astro’s keys.

**`getPathname` that duplicates `getRelativeLocaleUrl`.** Drift on `base`, `trailingSlash`, `build.format`, `site`, `i18n.domains`, `{ path, codes }`, and `prefixDefaultLocale`. Correct composition:

1. Resolve the **canonical** path (file route or document `path` without locale prefix).
2. If pathnames exist, map canonical → localized slug for that locale.
3. Pass **that path** into `getRelativeLocaleUrl(locale, localizedPath)` (or `getAbsoluteLocaleUrl` when domains/`site` matter).

`getRelativeLocaleUrl("fr", "about")` will never yield `/fr/a-propos`. If we need `/fr/a-propos`, we must pass `"a-propos"` (or the mapped string) as `path`. Language switchers that strip the locale and re-prefix with `getRelativeLocaleUrl` will also need the pathnames map, or they will emit English slugs under `/fr/`.

**Owning `i18n` config ourselves instead of `defineConfig.i18n`.** Then `Astro.currentLocale`, sitemap-unaware helpers, and Starlight’s mapping to Astro i18n all go dark. If the integration generates config, write through to Astro’s `i18n` object.

### 5.3 Content collections

Do not wait for core pairing. Official pattern is folder-per-locale + same relative id. Starlight: same filename across locale folders, plus **custom** fallback (default-locale body at the requested URL, with `i18n.untranslatedContent` notice). HiDeoo (Starlight discussion [#3131](https://github.com/withastro/starlight/discussions/3131), Apr 2025): Astro’s `fallbackType` is only redirect or rewrite; rewrite would also switch UI language. Starlight’s behavior is **not** `i18n.fallback`.

CMS-shaped `id` + `locale` + `path` is integration/loader territory. Content Layer loaders can attach those fields. Core `CollectionEntry` will not grow a first-class translation group unless a future RFC says so — none found.

Do not use routing `pathnames` and a document-owned full `path` for the same URL prefix (double ownership). That constraint is product-side; core has no API that would force it.

### 5.4 Fallback policy

If missing-locale **routes** should redirect or rewrite to another locale’s **same slug**, use `i18n.fallback` + `fallbackType`. That is stable.

If missing **documents** should render default-locale copy at the original URL with a notice, that is **not** Astro i18n — copy Starlight’s collection loop, or 404.

Do not assume fallback still runs on 3xx; it is 404-only after Feb 2026.

### 5.5 What to wait on

Nothing in core that unblocks catalogs, pathnames, or CMS pairing. #1176 could move; it has not in more than a year of Stage 1. Building those layers in the integration matches what maintainers told that thread.

Watch (do not block on):

- #1176 status (Stage 2 / accepted / official `@astrojs/i18n-paths`)
- Sitemap gaining awareness of translated slugs
- #16501 (prefix matching mid-path) if we keep automatic routing and slugs may contain locale codes
- Advanced routing `i18n()` if we compose a custom fetch pipeline

---

## 6. Starlight (first-party signal)

[Starlight i18n guide](https://starlight.astro.build/guides/i18n/). Signal: **sit on Astro i18n for prefixes; own catalogs and document pairing.**

- Starlight `locales` / `defaultLocale` / `root` are mapped onto Astro `i18n` (see `packages/starlight/utils/i18n.ts` in the Starlight repo). `prefixDefaultLocale` is derived (multilingual without `root` → prefixed). **`routing: "manual"` throws.**
- Docs: “For more advanced i18n scenarios, Starlight also supports configuring internationalization using the [Astro’s `i18n` config](https://docs.astro.build/en/guides/internationalization/#configure-i18n-routing) option.”
- **Pairing:** same filename in each locale directory (`en/index.md` ↔ `ar/index.md`). Not CMS `id`.
- **Fallback:** default-locale content at the requested locale URL + translation notice. **Does not set Astro `i18n.fallback`.**
- **Catalogs:** `src/content/i18n/*.json`, `i18nLoader` / `i18nSchema`, `Astro.locals.t` (i18next). Plugin hook `i18n:setup` / `injectTranslations`. This is Starlight UI, not `astro:i18n`.
- Links: Starlight documents `getRelativeLocaleUrl` + `Astro.currentLocale` for in-language URLs — wrapping core helpers, not replacing them.

That is the same split this integration should use: Astro owns locale prefixes and URL helpers; the product owns strings and how documents pair.

---

## 7. Sources

### Docs (current)

- [Internationalization (i18n) Routing](https://docs.astro.build/en/guides/internationalization/)
- [Configuration reference — `i18n`](https://docs.astro.build/en/reference/configuration-reference/) (keys under `#i18n`)
- [Internationalization API Reference (`astro:i18n`)](https://docs.astro.build/en/reference/modules/astro-i18n/)
- [Upgrade to Astro v6](https://docs.astro.build/en/guides/upgrade-to/v6/) (`i18n.routing.redirectToDefaultLocale`)
- [Add i18n features (recipe)](https://docs.astro.build/en/recipes/i18n/)
- [Routing — advanced routing / `i18n()`](https://docs.astro.build/en/guides/routing/#advanced-routing)
- [Config imports (`astro:config`) — `i18n`](https://docs.astro.build/en/reference/modules/astro-config/)
- [API reference — `preferredLocale` / `currentLocale`](https://docs.astro.build/en/reference/api-reference/#preferredlocale)
- [Invalid i18n middleware configuration](https://docs.astro.build/en/reference/errors/invalid-i18n-middleware-configuration/)
- [i18nNoLocaleFoundInPath](https://docs.astro.build/en/reference/errors/i18n-no-locale-found-in-path/)
- [@astrojs/sitemap — `i18n`](https://docs.astro.build/en/guides/integrations-guide/sitemap/#i18n)
- [Starlight — Internationalization](https://starlight.astro.build/guides/i18n/)
- [Starlight — configuration `locales`](https://starlight.astro.build/reference/configuration/#locales)
- [Experimental flags index](https://docs.astro.build/en/reference/experimental-flags/) (no i18n flag)

### Blog / changelog-equivalent

- [Astro 3.5: i18n Routing (experimental)](https://astro.build/blog/astro-350/) (2023-11-08)
- [Astro 4.0 — i18n stable](https://astro.build/blog/astro-4/) (2023-12-05)
- [Astro 4.2 — `redirectToDefaultLocale`](https://astro.build/blog/astro-420/) (2024-01-18)
- [Astro 4.3 — experimental i18n domains](https://astro.build/blog/astro-430/) (2024-02-01)
- [Astro 4.6 — `routing: "manual"`](https://astro.build/blog/astro-460/) (2024-04-11)
- [Astro 4.15 — `fallbackType: "rewrite"`](https://astro.build/blog/astro-4150/) (2024-08-29)
- [Astro 5.14 — `routePattern` in `getStaticPaths`](https://astro.build/blog/astro-5140/) (2025-09-25)
- [Astro 6.3 — experimental advanced routing, `i18n()`](https://astro.build/blog/astro-630/) (2026-05-07)
- [Astro 7.0 — advanced routing stable](https://astro.build/blog/astro-7/) (2026-06-22)
- [How Astro does i18n](https://astro.build/blog/astro-i18n/) (2023-08-31) — **docs translation process**, not the routing API

### Roadmap / GitHub

- [RFC 0045 — i18n routing](https://github.com/withastro/roadmap/blob/main/proposals/0045-i18n-routing.md) (2023-10-19, implemented)
- [Discussion #795 — i18n routing enhancements](https://github.com/withastro/roadmap/discussions/795) (2023-12-14, partially shipped)
- [Discussion #1176 — pathname-based i18n](https://github.com/withastro/roadmap/discussions/1176) (2025-06-01, Stage 1, not accepted)
- [Discussion #1347 — localized slugs](https://github.com/withastro/roadmap/discussions/1347) (2026-04-23, closed)
- [Starlight discussion #3131 — fallback vs Astro i18n](https://github.com/withastro/starlight/discussions/3131) (2025-04)
- Core issues/PRs: [#12431](https://github.com/withastro/astro/issues/12431), [#12718](https://github.com/withastro/astro/pull/12718), [#14017](https://github.com/withastro/astro/pull/14017), [#14406](https://github.com/withastro/astro/pull/14406), [#15688](https://github.com/withastro/astro/issues/15688), [#15704](https://github.com/withastro/astro/pull/15704), [#16501](https://github.com/withastro/astro/issues/16501)

### Context7

- `/withastro/docs` queried for i18n routing, `routing: "manual"`, fallback, domains, `{ path, codes }` — agreed with the public docs pages above.
