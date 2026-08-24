# siteonce-stack

Monorepo for Astro deliverables consumed together:

- **`packages/astro-lib/`** — the host-agnostic integration, published as `@siteonce/astro-lib`. SCSS foundation + parameterized Sass mixins. See [`packages/astro-lib/AGENTS.md`](packages/astro-lib/AGENTS.md).
- **`packages/astro-og-image/`** — optional OG image generator (`@siteonce/astro-og-image`): injected endpoints, Satori template rendering, consumer font loading, and cache. See [`packages/astro-og-image/AGENTS.md`](packages/astro-og-image/AGENTS.md).
- **`packages/astro-netlify/`** — optional Netlify host adapter (`@siteonce/astro-netlify`): deploy-context bridge, staging-auth edge function. See [`packages/astro-netlify/AGENTS.md`](packages/astro-netlify/AGENTS.md).
- **`starter/`** — a blank Astro project that wires core, OG generation, and the Netlify adapter together. Intended to be cloned via `degit` as the starting point for new sites.

## Cloning the starter

The starter lives at a subdirectory of this repo. Use `degit` (via `tiged`, its maintained fork) to pull just that subdirectory into a new project:

```bash
npx tiged <owner>/siteonce-stack/starter my-project
cd my-project
pnpm install
pnpm dev
```

Replace `<owner>` with the GitHub org/user that hosts this repo. `tiged` is the actively-maintained successor to `degit`; the original `degit` package still works but is unmaintained.

## The `astro-lib` version pin on the starter

This is the one piece of monorepo plumbing that does **not** transparently survive a `degit` clone, and it needs a conscious flip before the starter is usable externally.

`starter/package.json` currently references the lib as:

```json
"@siteonce/astro-lib": "workspace:*"
```

Inside this monorepo, pnpm resolves `workspace:*` to the local `packages/astro-lib` via a symlink — fast iteration, no publish step required. **But the `workspace:` protocol is a pnpm-specific extension. Outside the monorepo, npm and yarn don't understand it, and `pnpm install` from a degit'd starter will fail too** (no workspace context to resolve against).

### Before the starter is usable externally

Two things have to happen:

1. **Publish the packages consumed by the starter** to a registry. Today they are private workspace packages and have never been published.
2. **Rewrite the starter's `workspace:*` dependencies** to real semver ranges matching the published versions.

Options for managing step 2:

- **Manual flip.** Edit `starter/package.json` by hand before each share, revert after. Simple, error-prone.
- **Release script.** A script that copies `starter/` to a release branch (or separate repo) with the field rewritten. Avoids polluting the dev-friendly `workspace:*` in main.

pnpm rewrites `workspace:` ranges automatically when publishing _packages_, but the starter is not a published package — it is a `degit` target — so pnpm's built-in rewrite does not help here. The rewrite has to happen at "starter release" time, not at "lib publish" time.

Until both steps are done, the starter is only runnable from inside this monorepo.

## Development

```bash
pnpm install     # at the repo root
pnpm dev         # runs astro dev in starter/
pnpm build
pnpm preview
```

Changes to packages under `packages/` are picked up live in `starter/` via pnpm's workspace symlinks.

## OG images

The optional `@siteonce/astro-og-image` integration reads generation settings from [`starter/src/config/ogConfig.ts`](starter/src/config/ogConfig.ts). The route registry requires a `"*"` default, lets project pages override or opt out, and uses an explicit collection for dynamic routes:

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

Fonts are project dependencies and must include at least one Satori-compatible `.woff`, `.ttf`, or `.otf` file; `.woff2` is not supported. Project-authored Satori JSX templates live in [`starter/src/og-templates/`](starter/src/og-templates/). Pages opt into generated SEO metadata with explicit config:

```ts
const ogImage = ogImageFor(Astro.url.pathname, ogConfig);
```

Run `pnpm dev` and open `/_og` for the development-only gallery. Each gallery card links to a focused HTML preview and its raw PNG. `pnpm build` prerenders included PNGs into `starter/dist/_og/`; the gallery and focused previews are not production routes. `pnpm preview` serves only the PNG files already emitted by the preceding Astro build.
