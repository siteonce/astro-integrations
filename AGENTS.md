# astro-stack

- **Vocabulary** — use terms from `CONTEXT.md`; respect its _Avoid_ entries.

## Standing constraints

- **Primary builders.** Agents are the primary builders of this snapshot and of content sites built from it. Prefer well-supported tools with small setup and low lookup over human-authoring comfort; the right tool still wins. Follow a human’s setup; say so if it’s a bad choice.
- **Tooling.** The pre-commit gate must pass — never bypass it.
- **Version policy.** Never infer package/framework versions from training data. Framework and dependency majors are whatever the installed lockfile pins. Resolve via an MCP docs server or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Authoring language.** Svelte for UI. Astro only when forced — `<head>` injection or other Astro-only lifecycle.
- **Interactivity ladder.** Climb and stop at the first rung that works: (1) platform/CSS; (2) a few lines of vanilla JS in an Astro `<script>`; (3) a hydrated Svelte island (`client:*`) only for genuinely stateful reactive logic, not mere show/hide. A hydrated island is never the default first step.
- **Config vs env.** Secrets and environment-dependent values go in `.env` (typed via `astro:env`). Structured static values go in the app’s `src/config/*.ts`. Never inline either in components or pages; never put secrets in config files.
- **Error policy.** If a problem can be known without rendering a particular request, fail loudly at startup (or build start) and abort — schema parse failure, missing required config, unknown route/collection that config can name up front, missing required env. Prefer pushing checks to startup. If the same class of condition can only be detected while rendering a specific response, skip or no-op and log at that path so one bad optional resolution does not take down the page.
- **AGENTS.md pairing.** `docs/agents/architecture.md`

## Agent skills

### Issue tracker

`docs/agents/issue-tracker.md`

### Triage labels

`docs/agents/triage-labels.md`

### Domain docs

`docs/agents/domain.md`
