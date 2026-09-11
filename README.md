# astro-stack

A snapshot monorepo for Astro content sites. Copy the repo; every file is yours. There are no promised upgrades.

- **`apps/marketing/`** — the public marketing app. Root `pnpm dev` / `pnpm build` / `pnpm preview` run this app.
- **`packages/astro/`** — `siteonce()` integration, Astro-coupled runtime, config schemas, the component catalog, and helpers (`@repo/astro`).
- **`packages/og-image/`** — optional OG image generator (`@repo/og-image`). Default export `ogImage()`.

## Development

```bash
pnpm install     # at the repo root
pnpm dev         # runs astro dev in apps/marketing
pnpm build
pnpm preview
```

Changes to packages under `packages/` are picked up live in `apps/marketing` via pnpm's workspace symlinks.

## OG images

The optional `@repo/og-image` integration reads generation settings from [`apps/marketing/src/config/ogConfig.ts`](apps/marketing/src/config/ogConfig.ts). The route registry requires a `"*"` default, lets project pages override or opt out, and uses an explicit collection for dynamic routes:

```ts
export const ogConfig = {
  basePath: '/_og',
  templates: { default: {} },
  routes: {
    '*': { template: 'default' },
    '/blog/[slug]': { collection: 'blog' },
    '/404': false,
  },
  fonts: [
    {
      name: 'Inter',
      path: '@fontsource/inter/files/inter-latin-400-normal.woff',
      weight: 400,
    },
  ],
} satisfies OgImageConfigInput;
```

Fonts are project dependencies and must include at least one Satori-compatible `.woff`, `.ttf`, or `.otf` file; `.woff2` is not supported. Project-authored Satori JSX templates live in [`apps/marketing/src/og-templates/`](apps/marketing/src/og-templates/). Pages opt into generated SEO metadata with explicit config:

```ts
const ogImage = ogImageFor(Astro.url.pathname, ogConfig);
```

Run `pnpm dev` and open `/_og` for the development-only gallery. Each gallery card links to a focused HTML preview and its raw PNG. `pnpm build` prerenders included PNGs into `apps/marketing/dist/_og/`; the gallery and focused previews are not production routes. `pnpm preview` serves only the PNG files already emitted by the preceding Astro build.
