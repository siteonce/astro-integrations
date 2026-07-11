# astro-stack — architectural context

This file holds the **always-true invariants** for `astro-stack` — the directives that shape every piece of code regardless of what you're working on. It's auto-loaded every session, so it stays lean: rules here, everything else one hop away.

- **Vocabulary** — component and module names live in the root **`CONTEXT.md`** glossary. Use its terms; respect its _Avoid_ entries.
- **Reference detail** — on demand via `docs/AGENTS.md`.
- **Phase work** — lives in **`docs/plans/`**; do not read unless you need to.
- **Product shape** — system assertions live in `docs/spec/` (start at `docs/spec/index.md`). Do not restate them here.

---

## Standing constraints

- **Tooling.** The pre-commit gate must pass — never bypass it. Formatter/linter wiring is authoritative in the tool configs, not here.
- **Version policy.** Never infer package/framework versions from training data. Framework and dependency majors are whatever the installed lockfile pins. Resolve via an MCP docs server (e.g. Context7) or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **AGENTS.md pairing.** Every `AGENTS.md` MUST have a sibling `CLAUDE.md` whose content is exactly `@AGENTS.md`. Architecture: `docs/spec/agents-architecture.md`.

---

## Placement rule

When a new instruction or decision is created, file it by **scope of applicability**, not by when it was made — and give each fact exactly one home (AGENTS.md files point, they never duplicate):

- Always true **everywhere** → this root `AGENTS.md` (rare).
- Always true **in one area** → that area's nested `AGENTS.md`.
- Needed only while doing **one unit of work** → that phase/plan file (`docs/plans/<plan>/`, e.g. `docs/plans/foundation/phase-3.md`).
- Occasional **reference** detail → `docs/` (spec assertion, ADR, or deep-dive; catalog it in `docs/AGENTS.md`).

This keeps the always-loaded budget flat as the project grows. Most decisions are unit- or area-scoped and must **not** land in this file.

## Logging decisions

- When a skill's procedure instructs you to record an implementation decision, append the non-obvious _why_ to `build-log.md` with the build-log append helper (`build_log.py append --dir docs/plans/<plan> --line "<one-line why>"`).
- Never read `brief-log.md`, `spec-log.md`, or `build-log.md` into context, and never edit them by hand or write to them outside that skill-instructed append.
