# astro-stack

A snapshot monorepo for Astro content sites. Copy the repo; every file is yours. There are no promised upgrades.

- **`apps/starter/`** — the content-site snapshot. Root `pnpm dev` / `pnpm build` / `pnpm preview` run this app.
- **`packages/astro-intl/`** — catalogs, collection pairing, locale list written through to Astro i18n (`@repo/astro-intl`). Factory `astroIntl()`.
- **`packages/astro-intl-sitemap/`** — printer glue the app passes into `@astrojs/sitemap` (`@repo/astro-intl-sitemap`).
- **`packages/astro-site/`** — layout, Seo, Schema, blocks, schema fragments, and helpers (`@repo/astro-site`).
- **`packages/og-image/`** — optional OG image generator (`@repo/og-image`). Factory `ogImage()`.

How the snapshot is shaped: [`docs/spec/`](docs/spec/index.md). Glossary: [`CONTEXT.md`](CONTEXT.md).

## Development

```bash
pnpm install     # at the repo root
pnpm dev         # runs astro dev in apps/starter
pnpm build
pnpm preview
```

Changes to packages under `packages/` are picked up live in `apps/starter` via pnpm's workspace symlinks.

## OG images

The optional `@repo/og-image` integration reads generation settings from [`apps/starter/src/og.config.ts`](apps/starter/src/og.config.ts). `routes['*']` is the required default; project pages can override or opt out:

```ts
export const ogConfig = {
  basePath: '/_og',
  templates: { default: {} },
  routes: {
    '*': { template: 'default' },
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

Fonts are project dependencies and must include at least one Satori-compatible `.woff`, `.ttf`, or `.otf` file; `.woff2` is not supported. Project-authored Satori JSX templates live in [`apps/starter/src/og-templates/`](apps/starter/src/og-templates/). Pages opt into generated SEO metadata with explicit config:

```ts
const ogImage = ogImageFor(Astro.url.pathname, ogConfig);
```

Run `pnpm dev` and open `/_og` for the development-only gallery. Each gallery card links to a focused HTML preview and its raw PNG. `pnpm build` prerenders included PNGs into `apps/starter/dist/_og/`; the gallery and focused previews are not production routes. `pnpm preview` serves only the PNG files already emitted by the preceding Astro build.
