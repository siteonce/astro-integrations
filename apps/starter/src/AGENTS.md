# src — project source

Authoring, catalogs, and asset-folder choices that span directories.

## Conventions

### Catalogs — `t()` always

All user-facing strings flow through `t()` / `useTranslations` from `src/t.ts`. Never inline. Machine identifiers, class names, route slugs, log messages, and JSON-LD `@type` values are not user-facing.

Catalogs live at `src/messages/{locale}.json`. The locale is per-request — never a module-level global. Into a Svelte island, pass the locale code as a prop, then `t(localeProp, 'key')`.

OG template copy: `og-templates/AGENTS.md`.

### Pages

File routes in `pages/`. Underscore skips the router: document bodies in `pages/_pages/`; catch-all helpers `_page-name.ts` and `_missing-locale.ts` next to the route. New kind → new `_pages` file. New document of an existing kind → no new file route. 404 is a route, not a `_pages` file.

### Image / asset folder choice

- **`src/images/`** — content imagery through Astro `<Image>` / `<Picture>`.
- **`src/icons/`** — SVG icons for `astro-icon`.
- **`public/`** — URL-stable paths (no hashing).
- **Co-located in `src/content/<col>/<slug>/`** — demo-only so preview needs no cloud account; live editorial media is a URL.
- **Fonts** — `@fontsource/*`. No `src/fonts/`.
