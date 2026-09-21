# src — project source

Authoring, catalogs, and asset-folder choices that span directories.

## Conventions

### Catalogs — `t()` always

All user-facing strings flow through `t()` / `useTranslations` from `src/t.ts`. Never inline. Machine identifiers, class names, route slugs, log messages, and JSON-LD `@type` values are not user-facing.

Catalogs live at `src/messages/{locale}.json`. The locale is per-request — never a module-level global. Into a Svelte island, pass the locale code as a prop, then `t(localeProp, 'key')`.

OG template copy: `og-templates/AGENTS.md`.

### Pages

File routes in `pages/`. Underscore skips the router: document bodies in `pages/_pages/`; catch-all helper `_page-name.ts` next to the route. Missing-locale is the intl helper the catch-all calls. New kind → new `_pages` file. New document of an existing kind → no new file route. 404 is a route, not a `_pages` file. Locale switcher: current locale is `aria-current`. Other locales with a sibling are links. Missing siblings stay visible and disabled. 404 is not a document, so other locales still link to that locale’s home.

### Image / asset folder choice

- **`src/images/`** — content imagery through Astro `<Image>` / `<Picture>`.
- **`src/icons/`** — SVG icons for `astro-icon`.
- **`public/`** — URL-stable paths (no hashing).
- **Co-located in `src/content/<col>/<slug>/`** — demo-only so preview needs no cloud account; live editorial media is a URL.
- **Fonts** — `@fontsource/*`. No `src/fonts/`.
