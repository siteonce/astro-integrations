# astro-stack

- **Vocabulary** — use terms from `CONTEXT.md`; respect its _Avoid_ entries.
- **Product description** — `docs/spec/`. Read the files that cover the area before changing it.

## Standing constraints

- **Primary builders.** `docs/agents/builders.md`. Follow a human’s setup; say so if it’s a bad choice.
- **Tooling.** The pre-commit gate must pass — never bypass it.
- **Version policy.** `docs/agents/versions.md`.
- **Authoring language.** Svelte for UI. Astro only when forced — `<head>` injection or other Astro-only lifecycle.
- **Interactivity ladder.** `docs/agents/interactivity.md`.
- **Config vs env.** Secrets and environment-dependent values go in `.env` (typed via `astro:env`). Structured static values go in the app’s `src/*.config.ts`. Never inline either in components or pages; never put secrets in config files.
- **Error policy.** `docs/agents/errors.md`.
- **Source comments.** Describe current behavior. Do not cite plan phases, PR numbers, or plan/backlog files.
