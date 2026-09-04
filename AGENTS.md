# astro-stack

- **Vocabulary** — use terms from `CONTEXT.md`; respect its _Avoid_ entries.
- **Product shape** — live rules live in nested `AGENTS.md` files and `docs/adr/`. Origin of the snapshot: `docs/from-packages.md`.

## Standing constraints

- **Tooling.** The pre-commit gate must pass — never bypass it. Formatter/linter wiring is authoritative in the tool configs, not here.
- **Version policy.** Never infer package/framework versions from training data. Framework and dependency majors are whatever the installed lockfile pins. Resolve via an MCP docs server or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Authoring language.** Svelte for UI. Astro only when forced — `<head>` injection or other Astro-only lifecycle hooks (`BaseLayout`, `Seo`, `Schema`, `Favicon`, and project head components such as Analytics). An unhydrated Svelte component ships zero JS.
- **Interactivity ladder.** Climb and stop at the first rung that works: (1) platform/CSS (`popover` + `::backdrop`, `<details>`, `:has()`, `:target`) — prefer this for open/close chrome; (2) a few lines of vanilla JS in an Astro `<script>` for the rare toggle the platform cannot express; (3) a hydrated Svelte island (`client:*`) only for genuinely stateful reactive logic (derived values, re-rendering lists, live form validation), not mere show/hide. A hydrated island is never the default first step. Rationale: `docs/adr/0011`.
- **Config vs env.** Secrets and environment-dependent values go in `.env` (typed via `astro:env`). Structured static values go in the app’s `src/config/*.ts`. Never inline either in components or pages; never put secrets in config files.
- **Error policy.** If a problem can be known without rendering a particular request, fail loudly at startup (or build start) and abort — schema parse failure, missing required config, unknown route/collection that config can name up front, missing required env. Prefer pushing checks to startup. If the same class of condition can only be detected while rendering a specific response, skip or no-op and log at that path so one bad optional resolution does not take down the page.
- **AGENTS.md pairing.** Every `AGENTS.md` MUST have a sibling `CLAUDE.md` whose content is exactly `@AGENTS.md`. Architecture: `docs/agents/architecture.md`. Nested files stay self-contained — do not import a shared rule file from another directory.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.
