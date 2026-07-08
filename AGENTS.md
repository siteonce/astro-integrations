# astro-stack — architectural context

This file holds the **always-true invariants** for `astro-stack` — the directives that shape every piece of code regardless of what you're working on. It's auto-loaded every session, so it stays lean: rules here, everything else one hop away.

- **Vocabulary** — component and module names live in the root **`CONTEXT.md`** glossary. Use its terms; respect its _Avoid_ entries.
- **Reference detail** — lives in **`docs/`**, read on demand; its index (`docs/AGENTS.md`) auto-loads when you enter and routes you to spec assertions (`docs/spec/`), decision records (`docs/adr/`), and the remaining deep-dives.
- **Phase work** — lives in **`docs/plans/`**; do not read unless you need to.

`astro-stack` is the foundation for every Astro site built on this stack: the library (`@gravitysupport/astro-lib`) is the product; `starter/` is a thin shell that wires it in. Full framing and the set-and-forget guarantees: `docs/spec/north-star.md`.

---

## Anchoring decisions

These shape every item in `docs/plans/foundation/`. Change one and the list shifts.

- **Boundary.** `packages/astro-lib` is the framework (components, schemas, helpers, OG pipeline, edge-fn helpers, integrations, agent rules for patterns). `starter/` is a thin shell that wires lib in and supplies populated config + content + project-specific templates. _If it's identical across every consuming project → lib. If it's a project choice → starter._
- **Target Astro version.** Astro 6.x. Svelte, Node, and pnpm majors follow whatever the installed lockfile pins.
- **Framework default & interactivity ladder.** Svelte is the authoring language; React stays out. Climb the interactivity ladder and stop at the first rung that works: (1) platform/CSS (`popover`, `<details>`, `:has()`); (2) a few lines of vanilla JS in an Astro `<script>`; (3) a hydrated Svelte island (`client:*`) — only for genuinely stateful reactive logic, not mere show/hide. Author static components in Svelte; use `.astro` only when forced — head injection, Astro-only lifecycle/globals, or composing other `.astro`. → `docs/adr/0011`.
- **Public API.** Consumer import paths are pinned — refactoring them downstream is painful. Read `docs/spec/public-api.md` (package shape, full path map, `src/` placement principle) before adding or changing any consumer-facing import path.
- **Config format.** TypeScript files with Zod schemas. Schema in lib, populated values in starter, validated at startup. Split per concern in `starter/src/config/` (`siteConfig.ts`, `i18nConfig.ts`, `ogConfig.ts`, `authConfig.ts`, `seoConfig.ts`).
- **Config vs env policy.** Secrets and environment-dependent values → `.env` (read via `astro:env` for typed access). Structured static values → `src/config/*.ts`. Never inline either in components or pages.
- **Config access (runtime).** Lib components/helpers read the consumer's config via the `virtual:astro-lib/config` virtual module (`import { siteConfig } from 'virtual:astro-lib/config'`), never by importing `starter/src/config` (the lib can't reach it). This is the single config-access path for all lifecycle/head components and later phases (OG, i18n). Svelte imports config from the virtual module directly — never receives it through props.
- **State.** Astro Sessions for server-side per-user state across requests; Svelte `$state` for within-island state; Svelte `setContext`/`getContext` to share down one island's subtree; nanostores **only** for state shared across ≥2 hydrated islands — never a reason to hydrate. → `docs/adr/0012`.
- **Astro ↔ Svelte data boundary.** Per-request/route context (`Astro.url`, `params`, `currentLocale`, `locals`, `cookies`) is **never** importable by Svelte; it enters once at the `.astro` composition root and is passed only to the few components that need it, never drizzled over every child. Hydrated-island props must be JSON-serializable; slotted children don't hydrate. Centralize the _source_ (middleware→`Astro.locals`), never the _destination_. → `docs/adr/0013`.
- **No `<style>` block in low-level components**, per `packages/astro-lib/COMPONENTS.md`. `ab-` is the reserved class prefix.
- **Call-site styling (Panda CSS).** Panda `css({…})` is the call-site escape hatch only — no token layer; it never replaces the `componentStyle` knob mechanism or the SCSS foundation/restyling. → `packages/astro-lib/PANDA-CSS.md`.
- **Tooling.** Biome 2 for JS/TS/JSON, Prettier for `.astro` (via `prettier-plugin-astro`) and Markdown (Biome parses neither; Markdown uses `proseWrap: never` — one line per paragraph, fewest newline tokens for agent reads). Pre-commit runs `lint-staged` (Biome/Prettier over staged files, auto-restaged); `pnpm check` is the manual whole-repo pass; `pnpm typecheck` + build gate in CI.
- **Build & TS layout.** Source-shipped, ESM-only, no bundler, `noEmit: true`; no project references, no `paths` mapping — shared strict base at repo root, lib + starter extend it. → `docs/spec/build-and-ts.md`, rationale in `docs/adr/0020` + `docs/adr/0021`.
- **Version policy.** Never infer package/framework versions from training data. Resolve via Context7 MCP (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) or read the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Testing posture.** No formal test framework for v1. Verify by build + visual inspection. Revisit when lib surface area justifies it (Vitest for helpers/schemas, Playwright for integration).
- **Error policy.** Loud at startup when the error is statically resolvable (schema parse, missing config, unknown route/collection reference, missing required env var). Silent skip / no-op at runtime when the same condition can only be detected at render time, so a malformed config does not break the whole render. Log at the runtime fallback path. Applies project-wide: config validation, OG element resolution, content visibility, edge functions. Push checks to startup wherever possible.
- **AGENTS.md pairing.** Every `AGENTS.md` MUST have a `CLAUDE.md` sibling whose content is `@AGENTS.md` — Claude Code reads only `CLAUDE.md`, so an unpaired file is invisible to it. The three-tier architecture (internal dev / lib-shipped consumer rules / consumer-owned) and nested-file required sections: `docs/spec/agents-architecture.md`.

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
