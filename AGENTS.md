# astro-stack — architectural context

This file holds the **always-true invariants** for `astro-stack` — the directives that shape every piece of code regardless of what you're working on. It's auto-loaded every session, so it stays lean: rules here, everything else one hop away.

- **Vocabulary** — component and module names live in the root **`CONTEXT.md`** glossary. Use its terms; respect its _Avoid_ entries.
- **Reference detail** — lives in **`docs/`**, read on demand; its index (`docs/AGENTS.md`) auto-loads when you enter and routes you to spec assertions (`docs/spec/`), decision records (`docs/adr/`), and the remaining deep-dives.
- **Phase work** — lives in **`docs/plans/`**; do not read unless you need to.

---

## Anchoring decisions

- **Boundary.** Identical across every consuming project → lib (`@gravitysupport/astro-lib`); project choice → `starter/`. → `docs/spec/north-star.md`
- **Framework default & interactivity ladder.** Svelte only (no React); climb the ladder and stop at the first rung that works. → `docs/spec/interactivity.md`
- **Public API.** Consumer import paths are pinned — read `docs/spec/public-api.md` before adding or changing any consumer-facing import path.
- **Config.** Schemas in lib, values in starter `src/config/`; secrets/env → `.env` via `astro:env`; never inline either. Lib/Svelte read config only via `virtual:astro-lib/config` — never `starter/src/config`, never config-via-props. → `docs/spec/config.md`, access path in `docs/spec/public-api.md`
- **State.** Use the right layer for the lifetime; nanostores only for ≥2 hydrated islands — never a reason to hydrate. → `docs/spec/state.md`
- **Astro ↔ Svelte data boundary.** Per-request context is never importable by Svelte; cross once at the `.astro` composition root as minimal props. → `docs/spec/request-data.md`
- **No `<style>` block in low-level components**, per `packages/astro-lib/COMPONENTS.md`. `ab-` is the reserved class prefix.
- **Call-site styling (Panda CSS).** Panda `css({…})` is the call-site escape hatch only — no token layer; it never replaces the `componentStyle` knob mechanism or the SCSS foundation/restyling. Wiring: `packages/astro-lib/PANDA-CSS.md`.
- **Tooling.** The pre-commit gate must pass — never bypass it. `pnpm check` is the manual whole-repo pass; `pnpm typecheck` + build gate in CI. Formatter/linter wiring is authoritative in the tool configs, not here.
- **Build & TS layout.** Do not add a bundler, project references, or `paths` mapping. → `docs/spec/build-and-ts.md`
- **Version policy.** Never infer package/framework versions from training data. Resolve via an MCP docs server or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Testing posture.** No formal test framework unless the change area already has one. Verify with build and visual inspection.
- **Error policy.** Loud at startup when statically resolvable; silent skip + log at render-time-only failures. → `docs/spec/error-policy.md`
- **AGENTS.md pairing.** Every `AGENTS.md` MUST have a `CLAUDE.md` sibling whose content is `@AGENTS.md`. Architecture (tiers, nested sections, sync-rules): `docs/spec/agents-architecture.md`.

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
