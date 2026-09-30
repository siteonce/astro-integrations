# Agent Memory

> Shared memory for every agent in this repo.
>
> Workspace memory only: this repo's decisions, workflows, and gotchas. Notes about the user, the machine, other repos, or a specific agent tool stay in that tool's own memory. Don't record what the repo already says (code, docs, `CONTEXT.md`, git history). Remove an entry once it stops being true.

## Design, then handover

In design discussions, discuss only — never edit repo files. Once agreed, write a handover for another agent to implement, then review that agent's result.

**Why:** Marc separates design from implementation and uses the designing agent (claude) as designer and reviewer (stated 2026-09-27).

**How to apply:** No repo edits during these discussions, even small doc notes. Edit only when Marc explicitly asks for that specific change. Where the handover goes:

- **Default:** the OS temp dir (`$TMPDIR/<kebab-name>.md`). Most handovers are implemented right away. Give Marc the full resolved path, not `$TMPDIR`.
- **Only when Marc says it's for later:** the gitignored `.scratch/plans/<kebab-name>.md`, until it's time to implement it.

## Spec skills run one per session

The spec skills under `.grok/skills/` (write-spec, implement-spec, review-spec, weave-spec) each run in a fresh session. write-spec normally asks confirm-or-correct questions; when Marc says to just write the handoff, skip them. implement-spec leaves the handoff's Agreement unchanged. `/conceptualize` is human-only (`disable-model-invocation`); never invoke it on your own.

**Why:** Feature work is handed across sessions, and `/conceptualize` was being auto-invoked.

**How to apply:** Start each skill in its own session. Don't invoke `/conceptualize` or `/issue-loop` unless Marc asks.

## Commits

Commit only when Marc asks, or when the handoff being implemented has an explicit Commit section. Never push unless asked. Conventional prefix, lowercase subject, scope optional. `Refs #N` only when the issue exists; never Fixes or Closes. Never amend — new work goes in new commits.

**Why:** Commits and pushes happened unasked, and a handoff's Commit section was once missed as the request.

**How to apply:** Inspect status, diff, and log. Stage the requested work by name and leave unrelated changes unstaged. Let the pre-commit gate run. Report the SHA and how far the branch is ahead of origin.

## Milestone walks need a fresh agent per issue

Walk a GitHub milestone with the issue-loop skill (`.grok/skills/issue-loop/`), which spawns a new subagent per issue. Don't use a scheduled or looping agent: each fire resumes the previous fire's transcript, so issues aren't independent. Check readiness with the `dependencies/blocked_by` REST endpoint; `is:blocked` search is unreliable.

**Why:** An earlier timer-driven walk carried each issue's context into the next.

**How to apply:** Start a walk only when Marc asks. One fresh agent per issue; the parent orchestrates and doesn't implement.

## CONTEXT.md is glossary only

`CONTEXT.md` defines words, not boundaries. Some entries still describe package scope and behavior; Marc considers that a misuse and plans to clean it up (noted 2026-09-29).

**Why:** An agent once argued sorting helpers didn't belong in astro-intl based on `CONTEXT.md`'s scope wording. Marc corrected it.

**How to apply:** Use `CONTEXT.md` for vocabulary. Decide where code belongs from package contracts, such as what intl requires from views.

## Intl keeps per-view routes

Each view stays its own injected Astro route: per-view render mode (prerender vs on demand) and per-page CSS splitting are non-negotiable. A single catch-all dispatcher (`[...path]` rendering views via `import.meta.glob`) was rejected on 2026-09-26 for losing both.

Listing pages stay at the same depth as entry slugs (`blog/2`, not `blog/page/2`). The starter keeps `blog/{page}` beside `blog/{slug}` on purpose; the on-demand `{page}`/`{slug}` startup clash stays as a case users will hit and learn from (stated 2026-09-28).

**Why:** Simplifying routing must not sacrifice these — "optimizing in the wrong direction."

**How to apply:** When routes overlap, change the patterns so they no longer overlap; don't collapse routes.

## Leave ogImage() commented out

`ogImage()` is commented out in `apps/starter/astro.config.mjs`. Restoring it breaks `astro build` in `packages/astro-og-image/src/route-data.ts`: Open Graph generation requires a collection entry, and paired tails with no entry (home, listings) have none. The planned fix is `.scratch/og-image-update.md`.

**Why:** Marc disabled it until that fix lands.

**How to apply:** Don't restore it, fix it, or clean its now-unused imports inside unrelated work. Skipping the throw in `route-data.ts` is not a fix.

## Don't restore removed shapes

These were removed or rejected on purpose; agents kept bringing them back:

- `apps/marketing`, `packages/astro` (`siteonce()`, `virtual:app/*`)
- `src/routes/`, `src/pages/_pages`, the locale catch-all, and a two-row `{page}` listing (listings are one row with `pagination`)
- `src/content/relations.ts` (relations are inline in `content.config.ts`), a `clients` relation
- `setListingEntries` / `listingQuery` (views pass `sort` or `order` to `listingPaths`), an intl `messages` dir or catalog-file check
- A sibling `entry` key on a route row (it lives in `collection: { name, entry? }`)
- Pairing keyed by `filePath` or Astro `entry.id` (the key is `<collection>/<data.id>`)
- A redirect to the locale home for a missing translation (disable the switcher link; use `fallbackView`)
- Starter tests for pageName, the slugify German map, or localeFolder

**How to apply:** Before reintroducing any of these, ask Marc.

## astro-intl.dev is a different library

The public astro-intl.dev package is an unrelated message library (`[lang]` segment, request-scoped translations, middleware rewrites). It doesn't pair translations, inject routes, or emit hreflang.

**How to apply:** Don't borrow its patterns for `@repo/astro-intl`.

## Gotchas

- **Stopping `astro dev`:** `pnpm exec astro dev` runs as `node …/astro.mjs dev`, so `pkill -f "astro dev"` misses it. Use `kill $(lsof -ti :<port> -sTCP:LISTEN)`.
- **`astro check` hides type errors in `intl.config.ts`:** it runs `astroIntl()` first, so an invalid config fails Zod validation in `loadIntlConfig`. Use `tsc -p apps/starter` to see the type error.
- **Zod 4 nested defaults:** `.default({})` doesn't apply inner defaults; use `.prefault({})`.
- **Prerendered 404s still emit a file** (Astro 7.3.4): returning `new Response(null, { status: 404 })` from a prerendered route doesn't drop it.
- **Temporary adapter experiments:** revert the Node adapter, `viewRendering: 'request'`, and any test content before staging; `@astrojs/node` isn't a standing dependency.
- **`pnpm install` fails on sharp:** `--ignore-scripts` still links the workspace.
- **`biome.json` is strict JSON:** no comments.
- **No `.md` under `src/pages/`:** it becomes a route, so no nested `AGENTS.md` there.
