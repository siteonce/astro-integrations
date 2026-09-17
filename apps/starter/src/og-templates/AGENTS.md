# src/og-templates — OG image templates (Satori JSX)

Read per-render state from `ctx`. Copy that lives in locale files goes through `ctx.t()`. The cache key includes locale.

Use only fonts registered in `og-config.ts`. Keep project branding, layout, and template-specific assets here; generator mechanics stay in the package.

Do not add a build hook, manifest, or committed generated PNGs.
