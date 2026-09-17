# src/components — project components

Project-specific components live here. Do not re-vendor `packages/astro-site/src/components`. Package conventions: `packages/astro-site/src/components/AGENTS.md`.

## Conventions

- Measure and Flow are classes on the landmark (`measure`, `flow`), not package imports.
- Closed variant props are typed. Light tuning is a static call-site `class` — do not interpolate.
- Full-bleed paint wraps `measure`. Open lengths stay static literals. Center with `mx-auto`. Do not use Tailwind’s `container` or `px-*` as the gutter.
- Pair `flow` with `flow-*` for a stack of blocks. Do not use `space-y`.
- Different structure: author a project component, or edit the package file.
- Page dim is project chrome. Full-viewport scrims stay `position: absolute`, never `fixed`.
