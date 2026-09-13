# Starter theme

CSS variables and Tailwind `@theme` mappings. The file is `apps/marketing/src/styles/theme.css`.

A minimal, appearance-only token system. These tokens define how things **look and feel** — not structure or layout. Add tokens when needed; do not speculatively create large token maps.

## Conventions

- Product token names stay on `:root`.
- `@theme inline` maps those tokens onto Tailwind namespaces. Tailwind's default scales are a reference, not the token set.
- **Pairs** (body, selection, muted): the unnumbered color is a surface that is a bad ink color. Map ink to `--text-color-*` so `text-body` is never the canvas. Product names keep the `-text` suffix (`--color-body-text`); do not put those into `--color-*`.
- **Brand:** the default shade is usable as fill and ink. Map only `--color-brand`. `text-brand` is brand itself, not ink on brand. Do not add `--color-brand-text` / `--text-color-brand`. Contrast on a filled brand shape uses a shade (`text-brand-50`) or white.
- **Shades** are physical lightness (50 light … 950 dark), same as Tailwind. They do not flip in dark mode. Semantic defaults remap which rung they stand on (`light-dark()`, `.dark`, or `prefers-color-scheme`).
- Prefer aliasing a Tailwind palette (`--color-brand-500: var(--color-blue-500)`) over authoring a custom ramp. Swap the hue in the aliases and in `--color-brand`.
- **Appearance only.** Color and type stacks. Structural concerns (z-index, layout, stacking) stay out. Radius, shadow, and motion use Tailwind's defaults until a site needs a product token.
- **Start with the base token.** Add a ladder or a new role when the UI needs it.
- **Component defaults stay local.** Global tokens are not a registry of every component's possible appearance.

### Typography

```css
--font-stack-sans: /* project stack */;
--font-stack-mono: /* project stack */;
```

### Colors

Colors are theme-dependent and should start from the smallest useful set. HTML primitives:

```css
--color-body
--color-body-text
--color-selection
--color-selection-text
```

Muted is a derived surface (and paired ink):

```css
--color-muted
--color-muted-text
```

Brand is a remapped default plus a 50–950 ladder aliased to a Tailwind palette:

```css
--color-brand: light-dark(var(--color-blue-600), var(--color-blue-400));
```

```css
--color-brand-50: var(--color-blue-50);
/* … */
--color-brand-950: var(--color-blue-950);
```

`@theme` maps pairs to `--color-*` plus `--text-color-*`, and brand to `--color-*` only:

```css
--color-body: var(--color-body); /* bg-body, border-body, … */
--text-color-body: var(--color-body-text); /* text-body */
--color-brand: var(--color-brand); /* bg-brand, text-brand, border-brand */
```

Color tokens describe visible shape colors by default. Do not add a `bg` suffix.

Accent, status, and extra roles copy brand's pattern (singleton or aliased scale, remap the unnumbered default per scheme) when the site has that UI.

### Not in this file

- Radius: Tailwind `rounded-*`
- Shadow, duration, ease: Tailwind defaults
- Spacing and fluid type: Leibniz / Tailwind
- Component chrome (`card`, `popover`, `input`, `ring`)
