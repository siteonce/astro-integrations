# astro-stack

- **Vocabulary** — use terms from `CONTEXT.md`; respect its _Avoid_ entries.
- **docs/** — a `docs/` tree exists; folder orientations live in `docs/AGENTS.md`.
- **Product shape** — system assertions live in `docs/spec/` (start at `docs/spec/index.md`). Do not restate them here.

## Standing constraints

- **Tooling.** The pre-commit gate must pass — never bypass it. Formatter/linter wiring is authoritative in the tool configs, not here.
- **Version policy.** Never infer package/framework versions from training data. Framework and dependency majors are whatever the installed lockfile pins. Resolve via an MCP docs server or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Authoring language.** Svelte for UI. Astro only when forced — `<head>` injection or other Astro-only lifecycle hooks (`BaseLayout`, `Seo`, `Schema`, `Favicon`, and project head components such as Analytics). An unhydrated Svelte component ships zero JS.
- **Config vs env.** Secrets and environment-dependent values go in `.env` (typed via `astro:env`). Structured static values go in the app’s `src/config/*.ts`. Never inline either in components or pages; never put secrets in config files.
- **AGENTS.md pairing.** Every `AGENTS.md` MUST have a sibling `CLAUDE.md` whose content is exactly `@AGENTS.md`. Architecture: `docs/spec/agents-architecture.md`. Nested files stay self-contained — do not import a shared rule file from another directory.
- **Capture buffers.** Treat `brief-log.md`, `spec-log.md`, and `build-log.md` as skill-owned capture buffers: open or write them only when a skill procedure requires it; never hand-edit them.
- **Spec as target.** When `docs/spec/` exists, treat it as present-tense **target** intent for the system. During active work under `docs/plans/`, code may lag the corpus — implement toward the spec; do not reconcile the corpus to incomplete shipping code.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.
