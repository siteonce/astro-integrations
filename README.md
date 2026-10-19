# astro-integrations

Astro integrations for multilingual content sites, from [SiteOnce](https://github.com/siteonce).

| Package | What it does |
| --- | --- |
| [`@siteonce/astro-intl`](packages/astro-intl/) | Pairs content entries across locales and injects localized routes on top of Astro's i18n |

`packages/astro-og-image` is parked: it isn't built, published, or part of the workspace.

## Run the demo

`apps/demo/` is a bilingual blog built on `@siteonce/astro-intl`. It runs the package from source, so edits show without a build. From the repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

## Develop

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
```

The pre-commit hook formats and lints staged files. CI runs everything above, builds the demo, and installs the packed package into a fresh Astro app.

## License

MIT
