# astro-stack — architectural context

This file holds the **always-true invariants** for `astro-stack` — the decisions that shape every piece of code regardless of what you're working on. It's auto-loaded by Claude Code / Cursor / Codex in every session, so it is kept deliberately lean: rules here, detail one hop away in `docs/`.

Anything that isn't always-needed lives in `docs/` and is read on demand — go there and its index (`docs/AGENTS.md`) auto-loads to route you. See the **Reference shelf** at the bottom for what's there. New instructions land by the **Placement rule**, also below.

**Phase-by-phase work lives in `plans/foundation/`.** When implementing a phase, read this file once for orientation, then work from that phase's file in `plans/foundation/` (its index `AGENTS.md` auto-loads on entry and routes you to the right `phase-N.md`). Anchoring decisions referenced from phases (e.g., _"per Anchoring → Error policy"_) live here; section references like _"see Out of scope"_ resolve in `docs/` — go there and its index routes you.

---

## What this is

`astro-stack` is the foundation for every Astro site built on this stack — both personal sites and client work. The library (`@gravitysupport/astro-lib`) is the product; the starter is a thin shell that wires it in. The north star is **plug-and-play, set-and-forget**: a site runs end-to-end the moment `degit` finishes, with baseline web infra (SEO, sitemap, RSS, OG, favicon, analytics, staging auth) on by default, and everything modular at the file level.

→ Full framing: `docs/north-star.md`.

---

## Working mode

**Implementation has begun. Next phase: 5 (Prose publishing).**

Phases 0-A (structural cleanup), 0-B (Biome/Prettier, tsconfig, build strategy, Husky), 1 (Foundations), 2 (Config layer), 3 (HTML / SEO skeleton), and 4 (Structural primitives, Svelte) are complete — `pnpm check` is the live pre-commit gate. Work the active phase in `plans/foundation/`, one phase per session, without widening scope into adjacent phases.

**Delivery flow.** Work lands via plain commits to `main`. No PR workflow for this TODO — `pnpm check` is the local gate, no review step before merge. Squash logic into sensible commits as you go.

**NPM publishing is post-TODO.** The lib is consumed via `workspace:*` for the duration of this TODO. Do not set up the publish flow, version bumping, or release tooling inside any phase. See Reference shelf → Out of scope.

---

## Anchoring decisions

These shape every item in `plans/foundation/`. Change one and the list shifts. The compressed ones point to a deep-dive for full rationale.

- **Boundary.** `packages/astro-lib` is the framework (components, schemas, helpers, OG pipeline, edge-fn helpers, integrations, agent rules for patterns). `starter/` is a thin shell that wires lib in and supplies populated config + content + project-specific templates. _If it's identical across every consuming project → lib. If it's a project choice → starter._
- **Target Astro version.** Astro 6.x. Svelte, Node, and pnpm majors follow whatever the installed lockfile pins; resolve specifics via Context7 before generating code that names a version or API surface.
- **Framework default.** Svelte for everything. Astro only when forced — `<head>` injection or other Astro-only lifecycle hooks (`Base`, `Seo`, `Schema`, `Analytics`, `Favicon`). Unhydrated Svelte components in Astro ship zero JS.
- **Package shape.** Dual-purpose: named imports (`import { Container } from '@gravitysupport/astro-lib/components'`) _and_ an Astro integration (`integrations: [astroLib(opts)]`) that owns lifecycle-bound work. → `docs/public-api.md`.
- **Public API shape.** Consumer import paths are pinned (refactoring them downstream is painful): integration default export, `/components/*`, `/schemas/config/*`, `/schemas/content/*`, `/helpers/*`, `/scss/foundation`, `/scss/mixins/*` (+ barrel). Full map + `src/` placement principle: → `docs/public-api.md`.
- **Config format.** TypeScript files with Zod schemas. Schema in lib, populated values in starter, validated at startup. Split per concern in `starter/src/config/` (`siteConfig.ts`, `i18nConfig.ts`, `ogConfig.ts`, `authConfig.ts`, `seoConfig.ts`).
- **Config vs env policy.** Secrets and environment-dependent values → `.env` (read via `astro:env` for typed access). Structured static values → `src/config/*.ts`. Never inline either in components or pages.
- **Config access (runtime).** Lib components/helpers read the consumer's config via the `virtual:astro-lib/config` virtual module (`import { siteConfig } from 'virtual:astro-lib/config'`), never by importing `starter/src/config` (the lib can't reach it). The integration validates each config at startup and serializes the parsed result into that module (Vite plugin), and types it via `injectTypes`. This is the single config-access path for all lifecycle/head components and later phases (OG, i18n). Settled Phase 3 — see `plans/foundation/phase-3.md`.
- **State.** Astro Sessions for server-side per-user state across requests; nanostores for cross-island client state; Svelte `$state` for within-island state.
- **No `<style>` block in low-level components**, per `packages/astro-lib/COMPONENTS.md`. `ab-` is the reserved class prefix.
- **Fonts & icons.** `@fontsource/*` from npm (no `src/fonts/`); `astro-icon` consuming `src/icons/`. → `docs/assets-conventions.md`.
- **Tooling.** Biome 2 for JS/TS/JSON, Prettier for `.astro` (via `prettier-plugin-astro`) and Markdown (Biome parses neither; Markdown uses `proseWrap: never` — one line per paragraph, fewest newline tokens for agent reads; humans read rendered, which reflows anyway). `pnpm check` is the single pre-commit command.
- **TS config layout.** No project references, no `paths` mapping; shared strict base at repo root, lib + starter extend it. → `docs/ts-config.md`.
- **Build & declarations.** Source-shipped, ESM-only, no bundler; `noEmit: true`. `.d.ts` emit is a publish-time concern (post-TODO). → `docs/build-strategy.md`.
- **Version policy.** Never infer package/framework versions from training data. Resolve via Context7 MCP (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) or read the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
- **Testing posture.** No formal test framework for v1. Verify by build + visual inspection. Revisit when lib surface area justifies it (Vitest for helpers/schemas, Playwright for integration).
- **Error policy.** Loud at startup when the error is statically resolvable (schema parse, missing config, unknown route/collection reference, missing required env var). Silent skip / no-op at runtime when the same condition can only be detected at render time, so a malformed config does not break the whole render. Log at the runtime fallback path. Applies project-wide: config validation, OG element resolution, content visibility, edge functions. Push checks to startup wherever possible.
- **AGENTS.md architecture (three tiers).** Every `AGENTS.md` MUST have a `CLAUDE.md` sibling that `@`-references it — Claude Code reads only `CLAUDE.md`, never bare `AGENTS.md`, so an unpaired one is invisible to it. Tier 1 internal dev (this file + nested `AGENTS.md`); Tier 2 consumer-facing rules in `packages/astro-lib/rules/` (synced into consumers at `.agents/lib-rules/` via `sync-rules`); Tier 3 consumer-owned per-dir `AGENTS.md` + `CLAUDE.md` stub. → `docs/agents-architecture.md`.

---

## Placement rule

When a new instruction or decision is created, file it by **scope of applicability**, not by when it was made — and give each fact exactly one home (AGENTS.md files point, they never duplicate):

- Always true **everywhere** → this root `AGENTS.md` (rare).
- Always true **in one area** → that area's nested `AGENTS.md`.
- Needed only while doing **one unit of work** → that phase/plan file (top-level `plans/<plan>/`, e.g. `plans/foundation/phase-3.md`).
- Occasional **reference** detail → a `docs/` deep-dive (catalog it in `docs/AGENTS.md`).

This keeps the always-loaded budget flat as the project grows. Most decisions are unit- or area-scoped and must **not** land in this file.

---

## Reference shelf → `docs/`

Detail that isn't always-needed lives in **`docs/`**, read on demand: go there and its index (`docs/AGENTS.md`) auto-loads to route you to the exact file. It covers framing & philosophy, the AGENTS/rules system, public API & package shape, build & TS-config strategy, asset conventions, cross-phase (Env-aware / Netlify) context, and project scope (out-of-scope, deferred decisions, glossary, loop checklist). Section references elsewhere (e.g. _"see Out of scope"_) resolve here.
