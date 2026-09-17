# src/styles — global styles + foundation

Foundation CSS lives here on top of Tailwind Preflight. Mixins under `mixins/` are parked and unwired — fate is not decided here.

Token naming and growth → `docs/agents/starter-theme.md`.

## Conventions

- Tailwind is for call-site classes, layout utilities, and CVA primitives. Shared tokens live in `theme.css`.
- Mixins are tools for your selectors — not the restyle path for package primitives.
- For runtime theming prefer CSS custom properties.
