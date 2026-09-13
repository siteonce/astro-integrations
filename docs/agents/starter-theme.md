# Starter theme

CSS variables and Tailwind `@theme` mappings. The file is `apps/marketing/src/styles/theme.css`.

A minimal, appearance-only token system. These tokens define how things **look and feel** — not structure or layout. Add tokens when needed; do not speculatively create large token maps.

## Conventions

- Product token names stay on `:root`.
- `@theme inline` maps those tokens onto Tailwind namespaces. Tailwind's default scales are a reference, not the token set.
- Shape colors map to `--color-*` (`bg-body`). Paired text maps to `--text-color-*` (`text-body`). Do not put `--color-{name}-text` into `--color-*`.
- **Appearance only.** Color, shadow, radius, motion. Structural concerns (z-index, layout, stacking) stay out.
- **Start with the base token.** Add variations only when the UI needs them.
- **Component defaults stay local.** Global tokens are not a registry of every component's possible appearance.

### Typography

```css
--font-stack-sans: /* project stack */;
--font-stack-mono: /* project stack */;
```

### Colors

Colors are theme-dependent and should start from the smallest useful set. Base HTML color tokens:

```css
--color-body
--color-body-text
--color-selection
--color-selection-text
```

Other base HTML elements can initially use these values until the project reveals a real need for additional tokens.

Color tokens describe visible shape colors by default. Do not add a `bg` suffix.

```css
--color-brand: /* base brand shape color */;
--color-accent: /* supporting shape color */;
```

Use purpose suffixes only for dependent color uses:

```css
--color-brand-text: /* text on the base brand color */;
--color-brand-border: /* border paired with the base brand color */;
```

`@theme` maps the shape to `--color-*` and each purpose suffix to that utility's namespace:

```css
--color-brand: var(--color-brand); /* bg-brand, border-brand, … */
--text-color-brand: var(--color-brand-text); /* text-brand */
--border-color-brand: var(--color-brand-border); /* only when border must differ from the shape */
```

Naming pattern:

```css
--color-{name}
--color-{name}-{prominence}
--color-{name}-{purpose}
--color-{name}-{prominence}-{purpose}
```

Prominence means visual strength in the current theme, not absolute lightness or darkness. Create prominence variations only when the UI needs another visible shape color in the same family. Prefer sparse numeric steps (`10`, `20`, `40`, `60`, `80`, `90`) so new values can be inserted later without renaming. Higher numbers mean more visual strength. Add a short code comment to each numbered color token explaining why it exists. Do not rename existing color tokens to rebalance the scale unless explicitly instructed.

### Radius

```css
--radius
```

The base radius token may be enough for an entire project. Add variants only when needed, using the clearest modifier name for the project (`--radius-small`, `--radius-large`).

### Shadow

```css
--shadow
```

The base shadow token may be enough. When variants are needed, prefer context names over abstract scale names (`--shadow-card`, `--shadow-header`, `--shadow-popover`). Different context tokens may share the same value.

### Transitions

```css
--duration
--ease
```

The base duration token may be enough. Add variants only when needed (`--duration-fast`, `--duration-slow`).
