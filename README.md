# astro-stack

Monorepo for Astro deliverables consumed together:

- **`packages/astro-lib/`** — the host-agnostic integration, published as `@gravitysupport/astro-lib`. SCSS foundation + parameterized Sass mixins. See [`packages/astro-lib/AGENTS.md`](packages/astro-lib/AGENTS.md).
- **`packages/astro-netlify/`** — optional Netlify host adapter (`@gravitysupport/astro-netlify`): deploy-context bridge, staging-auth edge function. See [`packages/astro-netlify/AGENTS.md`](packages/astro-netlify/AGENTS.md).
- **`starter/`** — a blank Astro project that wires the lib (and Netlify adapter) in. Intended to be cloned via `degit` as the starting point for new sites.

## Cloning the starter

The starter lives at a subdirectory of this repo. Use `degit` (via `tiged`, its maintained fork) to pull just that subdirectory into a new project:

```bash
npx tiged <owner>/astro-stack/starter my-project
cd my-project
pnpm install
pnpm dev
```

Replace `<owner>` with the GitHub org/user that hosts this repo. `tiged` is the actively-maintained successor to `degit`; the original `degit` package still works but is unmaintained.

## The `astro-lib` version pin on the starter

This is the one piece of monorepo plumbing that does **not** transparently survive a `degit` clone, and it needs a conscious flip before the starter is usable externally.

`starter/package.json` currently references the lib as:

```json
"@gravitysupport/astro-lib": "workspace:*"
```

Inside this monorepo, pnpm resolves `workspace:*` to the local `packages/astro-lib` via a symlink — fast iteration, no publish step required. **But the `workspace:` protocol is a pnpm-specific extension. Outside the monorepo, npm and yarn don't understand it, and `pnpm install` from a degit'd starter will fail too** (no workspace context to resolve against).

### Before the starter is usable externally

Two things have to happen:

1. **Publish `@gravitysupport/astro-lib` to a registry** (npm, or a private registry). Today the package is marked `"private": true` and has never been published.
2. **Rewrite the starter's dependency** from `workspace:*` to a real semver range matching the published version, e.g. `"@gravitysupport/astro-lib": "^0.1.0"`.

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

Changes to `packages/astro-lib/` and `packages/astro-netlify/` are picked up live in `starter/` via pnpm's workspace symlink.
