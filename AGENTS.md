# astro-stack

- **Vocabulary** — use terms from `CONTEXT.md`; respect its _Avoid_ entries.
- **How we build** — `docs/agents/`.
- **What this product is or refuses** — `docs/product/`. Read the files that cover the area before changing it.

## Standing constraints

- **Primary builders.** `docs/agents/builders.md`. Follow a human’s setup; say so if it’s a bad choice.
- **Tooling.** The pre-commit gate must pass — never bypass it.
- **Version policy.** `docs/agents/versions.md`.
- **Authoring language.** Svelte for UI. Astro only when forced — `<head>` injection or other Astro-only lifecycle.
- **Interactivity ladder.** `docs/agents/interactivity.md`.
- **Config vs env.** Secrets and environment-dependent values go in `.env` (typed via `astro:env`), never in source or config files. Static values live where they're read. If more than one file reads a value, or a package takes it, it goes in the app's `src/*.config.ts`. If one file reads it, it stays at the top of that file, commented for editing.
- **Error policy.** `docs/agents/errors.md`.
- **Tests.** `docs/agents/tests.md`.
- **Source comments.** Describe current behavior. Do not cite plan phases, PR numbers, or plan/backlog files.
- **Memory.** `MEMORY.md`. Anything workspace-related you'd save to your tool's built-in memory goes here instead, so all agents work from one record instead of drifting, partial copies.
