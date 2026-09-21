# Interactivity ladder

Climb and stop at the first rung that works: (1) platform/CSS; (2) a few lines of vanilla JS in an Astro `<script>`; (3) a hydrated Svelte island (`client:*`) only for genuinely stateful reactive logic, not mere show/hide. A hydrated island is never the default first step.

Pick state by who must see it: Astro Sessions (per-user, outlives the request) → nanostores (two or more hydrated islands; never a reason to hydrate) → Svelte `setContext` / `getContext` (one island's subtree) → `$state` (default).

Per-request data (locale, URL, cookies) is read in `.astro` frontmatter and passed as props. A hydrated island has no `Astro.locals`. Pass the locale code in, then translate with `t(locale, key)`.
