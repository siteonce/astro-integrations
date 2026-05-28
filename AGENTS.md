# astro-stack — architectural context

This file holds the stable architecture for `astro-stack`: what it is,
how we work, the decisions that shape every piece of code, the threads
that cross phases, and the named modules everything references. It's
auto-loaded by Claude Code / Cursor / Codex when working in this repo —
every session has this content in context without needing to read it
explicitly.

**Phase-by-phase work lives in `TODO.md`.** When implementing a phase,
read this file once for orientation, then work from the phase section
in `TODO.md`. Anchoring decisions referenced from phases (e.g.,
*"per Anchoring → Error policy"*) live here.

---

## What this is

`astro-stack` is the foundation for every Astro site built on this stack —
both personal sites and client work. The library
(`@gravitysupport/astro-lib`) is the product; the starter is a thin shell
that wires it in.

The north star is **plug-and-play, set-and-forget**:

- A new site should be runnable end-to-end the moment `degit` finishes.
  No mandatory setup before the first preview.
- Baseline web infrastructure — `robots.txt`, RSS feed, sitemap, favicon,
  OG images, SEO `<head>`, JSON-LD, analytics shim, staging auth — ships
  *on* by default with simple, sensible defaults. The consumer doesn't
  enable these features; they're already there, generating correct output
  from whatever `siteConfig.ts` contains.
- Where configuration is unavoidable, it lives in one place
  (`starter/src/config/*.ts`) and is the *only* place a consumer touches
  to brand a project.
- Everything is modular at the file level. A consumer can pluck out an
  Astro component, a Svelte primitive, an OG template, a Zod schema, or a
  rehype plugin and use only what they need. Pluck apart, pluck back
  together. The integration wires the defaults; the named exports cover
  everything beyond that.
- Updates to the lib (new components, fixed defaults, refined rules)
  propagate to every consuming site via `pnpm update` — including the
  Tier-2 agent rule content under `rules/`.

In short: this is a module system for Astro sites. The library carries
the opinions, the patterns, the baseline infrastructure, and the agent
context. The starter is the socket those opinions plug into.

---

## Working mode

**Implementation has begun. Next phase: 3 (HTML / SEO skeleton).**

Phases 0-A (structural cleanup), 0-B (Biome/Prettier, tsconfig, build
strategy, Husky), 1 (Foundations), and 2 (Config layer) are complete —
`pnpm check` is the live pre-commit gate.
The earlier brainstorm-only restriction has been lifted. Work the active
phase in `TODO.md`, one phase per session, without widening scope into
adjacent phases.

**Delivery flow.** Once implementation begins, work lands via plain
commits to `main`. No PR workflow for this TODO — `pnpm check` is still
the local gate, but there is no review step before merge. Squash logic
into sensible commits as you go.

**NPM publishing is post-TODO.** The lib is consumed via `workspace:*`
for the duration of this TODO. Do not set up the publish flow, version
bumping, or release tooling inside any phase. It lands after every
phase in `TODO.md` is worked down. See **Out of scope** below.

---

## Anchoring decisions

These shape every item in `TODO.md`. Change one and the list shifts.

- **Boundary.** `packages/astro-lib` is the framework (components, schemas,
  helpers, OG pipeline, edge-fn helpers, integrations, agent rules for
  patterns). `starter/` is a thin shell that wires lib in and supplies
  populated config + content + project-specific templates.
  *If it's identical across every consuming project → lib. If it's a
  project choice → starter.*
- **Target Astro version.** Astro 6.x. Svelte, Node, and pnpm majors
  follow whatever the installed lockfile pins; resolve specifics via
  Context7 before generating code that names a version or API surface.
- **Framework default.** Svelte for everything. Astro only when forced —
  `<head>` injection or other Astro-only lifecycle hooks (`Base`, `Seo`,
  `Schema`, `Analytics`, `Favicon`). Unhydrated Svelte components in Astro
  ship zero JS.
- **Package shape.** The lib is a dual-purpose package: a regular module
  for named imports (`import { Container } from '@gravitysupport/astro-lib/components'`)
  *and* an Astro integration registered in `astro.config.mjs`
  (`integrations: [astroLib(opts)]`). The integration handles lifecycle-
  bound work (rehype plugin, OG middleware, partytown/sitemap/i18n setup,
  startup config validation).
- **Public API shape.** Consumer-facing import paths are pinned here
  because downstream imports are painful to refactor once settled. The
  `exports` field *internals* (conditions, `dist/` vs `src/` resolution,
  types layout) are implementation detail and land in Phase 1, resolved
  via Context7 against current Astro 6 + pnpm conventions.
  - `@gravitysupport/astro-lib` → integration default export
  - `@gravitysupport/astro-lib/components/*` — flat. Astro and Svelte
    components mixed; file extension (`.astro` / `.svelte`) discloses
    the type. Splitting by framework hides the signal that Astro
    components are the exception (head-injection only, per
    `COMPONENTS.md`).
  - `@gravitysupport/astro-lib/schemas/config/*` — Zod schemas for
    config files (siteConfig, i18nConfig, ogConfig, authConfig,
    seoConfig).
  - `@gravitysupport/astro-lib/schemas/content/*` — content collection
    schemas (prose, future collections).
  - `@gravitysupport/astro-lib/helpers/*`
  - `@gravitysupport/astro-lib/scss/foundation`
  - `@gravitysupport/astro-lib/scss/mixins/*` — both individual mixin
    files (`scss/mixins/typography`, etc.) *and* a barrel
    (`scss/mixins`) that `@forward`s the lot, so consumers can pull one
    mixin or all of them.
- **Config format.** TypeScript files with Zod schemas. Schema in lib,
  populated values in starter, validated at startup. Split per concern in
  `starter/src/config/` (`siteConfig.ts`, `i18nConfig.ts`, `ogConfig.ts`,
  `authConfig.ts`, `seoConfig.ts`).
- **Config vs env policy.** Secrets and environment-dependent values →
  `.env` (read via `astro:env` for typed access). Structured static values
  → `src/config/*.ts`. Never inline either in components or pages.
- **State.** Astro Sessions for server-side per-user state across requests;
  nanostores for cross-island client state; Svelte `$state` for
  within-island state.
- **No `<style>` block in low-level components**, per
  `packages/astro-lib/COMPONENTS.md`. `ab-` is the reserved class prefix.
- **Fonts.** `@fontsource/*` packages from npm. No `src/fonts/` directory.
  Import the font face CSS once in a global stylesheet, set the
  `--font-stack-*` token to the family name.
- **Icons.** `astro-icon` consuming `src/icons/` for project SVGs.
- **Tooling.** Biome 2 for JS/TS/JSON, Prettier + `prettier-plugin-astro`
  for `.astro` files (Biome doesn't parse Astro). `pnpm check` is the
  single pre-commit command.
- **TS config layout.** No project references, no `paths` mapping. A
  shared strict base at the repo root (`tsconfig.json`); lib and starter
  extend it. Starter→lib type resolution rides the pnpm workspace symlink
  + the lib's `exports`/`types` (Phase 1), not a `paths` alias. Starter
  extends `["astro/tsconfigs/strict", "../tsconfig.json"]` to keep Astro's
  jsx/types idioms on top of the monorepo baseline. *Rationale:* the lib
  is consumed as source (no `dist/` during the TODO), there is no
  incremental build graph to order, and references add `composite`/
  build-order friction against set-and-forget. (Decided 2026-05-23, Phase
  0-B — supersedes the "decide before Phase 1" note.)
- **Build & declarations.** Source-shipped, **ESM-only, no bundler**. The
  lib ships `.ts`/`.svelte`/`.astro`/`.tsx`/`.scss` source; `noEmit: true`
  (Astro runs TS directly). `.d.ts` emit (`tsc --emitDeclarationOnly` over
  the pure-TS surfaces: helpers, schemas, integration) is a *publish-time*
  concern and lands post-TODO with the publish flow — not inside any
  phase. *Rationale:* `.svelte`/`.astro` cannot be meaningfully
  pre-bundled for a downstream Astro/Vite pipeline, bundling fights the
  "pluck out a single file" north star, and the Astro 6 ecosystem is ESM
  end-to-end (no CJS consumers to serve). (Decided 2026-05-23, Phase 0-B.)
- **Version policy.** Never infer package/framework versions from training
  data. Resolve via Context7 MCP
  (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) or
  read the installed `package.json` / `pnpm-lock.yaml` before generating
  code that names a version, API surface, or feature.
- **Testing posture.** No formal test framework for v1. Verify by build
  + visual inspection. Revisit when lib surface area justifies it
  (Vitest for helpers/schemas, Playwright for integration). Recorded so
  it isn't relitigated each phase.
- **Error policy.** Loud at startup when the error is statically
  resolvable (schema parse, missing config, unknown route/collection
  reference, missing required env var). Silent skip / no-op at runtime
  when the same condition can only be detected at render time, so a
  malformed config does not break the whole render. Log at the runtime
  fallback path. Applies project-wide: config validation, OG element
  resolution, content visibility, edge functions. Implementations should
  push checks to startup wherever possible.
- **AGENTS.md architecture (three tiers).** Distributable rule content
  is separated from auto-activating instruction files so we don't
  pollute every consumer agent's context with files meant for the lib
  team, and vice versa.
  - **Tier 1 — Internal dev.** Repo-root `AGENTS.md` (this file, loaded
    via root `CLAUDE.md` → `@AGENTS.md`) and any per-directory `AGENTS.md`
    inside the monorepo. Read by Codex/Cursor when working in that
    subtree; **Claude Code does not auto-load nested `AGENTS.md`** (only
    `CLAUDE.md`), so a nested `AGENTS.md` we want Claude Code to pick up
    needs a sibling one-line `CLAUDE.md` stub — see the Tier-3 note below.
    Covers how we build and ship.
  - **Tier 2 — Consumer-facing rules (lib-shipped).** Plain markdown
    in `packages/astro-lib/rules/`. *Not* named AGENTS.md, so it does
    not auto-activate. Imported by reference from consumer files.
    Updated by us, delivered via `pnpm update`.
  - **Tier 3 — Consumer-owned.** Per directory, the starter ships a
    content-bearing `AGENTS.md` **plus a one-line `CLAUDE.md` stub**
    (`@AGENTS.md`) so both Claude Code (via `CLAUDE.md`) and Codex/Cursor
    (via `AGENTS.md`) auto-load it. The `AGENTS.md` imports Tier-2 rules
    via a path relative to itself (e.g.
    `@../../.agents/lib-rules/<area>.md`) plus leaves space for the
    consumer's own additions. Owned by the consumer after degit; lib-rule
    content auto-refreshes on `pnpm update`.
  - **Distribution mechanism (sync-rules).** Tier-2 files do not live
    in `node_modules/` at read time. The lib ships
    `packages/astro-lib/scripts/sync-rules.mjs`, which copies
    `rules/*.md` into the consumer at `.agents/lib-rules/`. Wired two
    ways:
    - **Automatic** via the lib's `postinstall` hook. `pnpm update`
      runs lifecycle scripts the same way `pnpm install` does, so a
      single `postinstall` covers both — pnpm has no `postupdate`
      hook and none is needed. Consumers must permit the script via
      `pnpm-workspace.yaml`'s `allowBuilds` (or `package.json`
      `pnpm.onlyBuiltDependencies` for non-monorepo consumers); the
      starter ships with this pre-set.
    - **Manual** via `pnpm run sync-rules`, exposed from
      `starter/package.json` so it survives `degit`. Useful for
      re-syncing without a full install cycle.

    Claude Code resolves `@`-paths **relative to the importing file**
    (verified against docs 2026-05-23), not the repo root — so the
    depth-correct form is `@../.agents/lib-rules/<area>.md` from
    `src/AGENTS.md` and `@../../.agents/lib-rules/<area>.md` from
    `src/<sub>/AGENTS.md`. `..` traversal works; node_modules layout is
    irrelevant because the rules are synced into the repo, not read from
    `node_modules/`. `.agents/lib-rules/` is **committed** to git (not
    gitignored): cold clones and CI need the rule content available
    before any install runs.
  - **Per-tool import support is uneven** (spike 2026-05-22, re-verified
    2026-05-23). Claude Code's `@filepath` syntax is the reference
    target — but Claude Code auto-loads only `CLAUDE.md`, **not** nested
    `AGENTS.md`; hence the per-directory `CLAUDE.md` stub. Max import
    depth is five hops. Cursor's `.cursor/rules/*.mdc` supports
    `@filename.ext` but cross-directory behavior is undocumented. Codex
    has no `@import` mechanism at all — the synced files still ship as
    part of the repo, but Codex relies on walking AGENTS.md from root to
    cwd. Fallback: Tier-3 AGENTS.md files stay self-describing enough to
    give context even when an import isn't followed.

---

## Cross-phase threads

Some concerns span multiple phases. Each phase will be implemented in a
fresh context window — these notes exist so the agent picking up one
piece is aware of the others and doesn't redesign decisions made
elsewhere. If you're implementing any task tagged below, read the whole
thread first.

### Env-aware / Netlify context

A single concern (read environment, decide visibility/auth/availability)
woven across:

- **Anchoring → Config vs env policy.** The rule everything else
  follows: secrets and env-dependent values go through `astro:env`;
  structured static values live in `src/config/*.ts`.
- **Phase 2 → `authConfig.ts`.** Defines the staging-auth schema.
  Password sourced from env, not the file. Schema in lib, populated
  values in starter.
- **Phase 5 → `helpers/netlifyEnv.ts`.** Typed Netlify `CONTEXT`
  reader (`isProd()`, `isPreview()`, `isLocal()`). Single canonical
  source for all build-context branching. Anywhere else that needs to
  branch on env goes through this helper — do not re-read `CONTEXT`
  directly.
- **Phase 5 → content-status visibility.** `entry.data.status === 'published'`
  combines with `netlifyEnv` for env-aware draft handling (e.g., drafts
  visible in preview, hidden in prod).
- **Phase 8 → Staging-auth edge function.** Consumes `authConfig` +
  `netlifyEnv`. Must not duplicate either's logic — re-use only.

---

## Decisions deferred

Distinct from **Out of scope** — these *will* be decided, just not yet.
Listed so they aren't relitigated each phase.

- **Release tooling.** Changesets vs. manual tagging vs. release-please.
  Decided as part of the post-TODO publish setup, not inside a phase.
- **Test framework.** Vitest + Playwright is the likely shape but no
  setup until lib surface area justifies it (see Anchoring → Testing
  posture).
- **Svelte / Node / pnpm major versions.** Follow lockfile until a
  specific feature forces a pin.

---

## Out of scope (for now)

- Publishing `@gravitysupport/astro-lib` to npm. Explicitly deferred
  until every phase in `TODO.md` has been worked down — do not set up
  the publish flow as part of any phase. Until then, starter's
  `workspace:*` dep means starter is only runnable from inside this
  monorepo. See `README.md` for the flip-before-share procedure.
  Release mechanism (Changesets vs. manual vs. release-please) lands
  with the publish setup itself.
- A dedicated forms layer beyond the existing `mixins/form/`.
- Bits UI / Floating UI / focus-trap / tabbable. Revisit when a real
  component needs them.
- `css-declaration-sorter`. Revisit on real need.

---

## Tier-2 boilerplate content

Now lives at **`packages/astro-lib/rules/boilerplate.md`** (the live
file, synced into each consumer at `.agents/lib-rules/boilerplate.md`).
The former seed block here was promoted into that file on 2026-05-23;
this pointer replaces it so there is one canonical source. Every Tier-3
`AGENTS.md` imports it via a path relative to itself (e.g.
`@../../.agents/lib-rules/boilerplate.md`); consumers receive updates via
`pnpm update`, which re-fires the postinstall sync.

---

## Glossary

One-liner per named component / module. Authoritative spec lives in the
phase that introduces it (see `TODO.md`).

- **`Base`** — bare HTML skeleton; `<html lang>` + `<head>` slot + `<body>` slot. Phase 3.
- **`Seo`** — owns `<head>` tag emission (title, meta, OG, Twitter). Reads `seoConfig.ts`. Phase 3.
- **`Schema`** — JSON-LD emitter (Article, BreadcrumbList, Organization, WebSite). Phase 3.
- **`Analytics`** — provider tag wrapped in Partytown. Phase 3.
- **`Favicon`** — emits the standard favicon tag block (icons typically generated via the favicon.io tool, but the component is agnostic). Phase 3.
- **`Container`** — width-constraint + horizontal padding (Svelte). Phase 4.
- **`Section`** — semantic `<section>` + vertical rhythm hook (Svelte). Phase 4.
- **`Stack`** — flex column with gap (Svelte). Phase 4.
- **`SiteFrame`** — top-level page chrome wrapping `ContentArea`. Phase 4.
- **`ContentArea`** — co-located main content slot inside `SiteFrame`. Phase 4.
- **`astroLib()` integration** — default export of lib; wires rehype, OG middleware, Partytown, sitemap, i18n, config validation. Phase 1+.
- **`og/renderer`** — Satori + satori-html pipeline. Phase 7.
- **`og/cache`** — content-hash keyed PNG cache in `starter/public/og/`. Phase 7.
- **`og/resolver`** — request path → template entry in `ogConfig.pages`. Phase 7.

---

## Loop checklist

Run on every `TODO.md` re-read (Phase 0-B re-read task + any future
re-read). Covers both this file and `TODO.md`.

1. Do all Anchoring decisions still hold? Flag any that have shifted.
2. Are phases still ordered correctly? Do later phases depend on
   earlier ones that haven't landed?
3. Any new gaps surfaced by recent work that aren't captured?
4. Anything in Decisions deferred ready to promote into Anchoring?
5. Anything made stale by code that's now landed? Prune.
