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

Listing pages stay at the same depth as entry slugs (`blog/2`, not `blog/page/2`). The demo keeps `blog/{page}` beside `blog/{slug}` on purpose; the on-demand `{page}`/`{slug}` startup clash stays as a case users will hit and learn from (stated 2026-09-28).

**Why:** Simplifying routing must not sacrifice these — "optimizing in the wrong direction."

**How to apply:** When routes overlap, change the patterns so they no longer overlap; don't collapse routes.

## OG's open build break

`packages/astro-og-image` is parked, and the demo doesn't register `ogImage()`. Registering it breaks `astro build` in `packages/astro-og-image/src/route-data.ts`: Open Graph generation requires a collection entry, and paired tails with no entry (home, listings) have none. The planned fix is `.scratch/plans/og-image-update.md`, for when OG is revived.

**Why:** Marc disabled it until that fix lands, then parked OG when intl moved here.

**How to apply:** Don't wire OG into the demo, fix it, or touch its files inside unrelated work. Skipping the throw in `route-data.ts` is not a fix.

## Intl stays bundler-neutral

Intl and its sitemap options stay bundler-neutral. No virtual modules, Vite plugins, `define`, or aliases. Astro's public integration APIs and Astro's own virtual modules are fine.

**Why:** Marc removed the virtual module on purpose. Astro may swap Vite, and end users' processors are unknown.

**How to apply:** Don't add a virtual module, Vite plugin, `define`, or alias to carry intl config or sitemap data. `astro:content` and `astro:i18n` stay allowed.

## Apps are never boxed in

Apps must be able to build whatever they want on top of our packages. A package supplies data and pieces the app can compose. The app can add to, wrap, or replace every piece the package hands it. It can also skip the package's convenience path and build the same result from the same data. Example: the app controls every sitemap URL, alternate, and filter, with or without `@astrojs/sitemap`.

Hidden plumbing is fine. Injected hidden routes, files, or folders (such as `_intl/`) are welcome when they ease integration or carry data the app needs to build. Magic is harmful only when it takes a decision away from the app.

**Why:** Marc is concerned about apps losing control. He is not concerned about hidden injected plumbing that eases cumbersome integration (stated 2026-09-30).

**How to apply:** When designing a package API, check that the app can extend, wrap, or replace each piece. Check that the raw data stays reachable without the convenience path. Don't reject hidden plumbing on "no magic" grounds when it helps the app build and takes no choice away.

## Don't restore removed shapes

These were removed or rejected on purpose; agents kept bringing them back:

- `src/routes/`, `src/pages/_pages`, the locale catch-all, and a two-row `{page}` listing (listings are one row with `pagination`)
- `src/content/relations.ts` (relations are inline in `content.config.ts`), a `clients` relation
- `setListingEntries` / `listingQuery` (views pass `sort` or `order` to `listingPaths`), an intl `messages` dir or catalog-file check
- A sibling `entry` key on a route row (it lives in `collection: { name, entry? }`)
- Pairing keyed by `filePath` or Astro `entry.id` (the key is `<collection>/<data.id>`)
- A redirect to the locale home for a missing translation (disable the switcher link; use `fallbackView`)
- Demo tests for pageName, the slugify German map, or localeFolder
- `setIntlConfig`, a global intl runtime, `reservedPaths`, and a separate intl sitemap package (once `@repo/astro-intl-sitemap`)

**How to apply:** Before reintroducing any of these, ask Marc.

## astro-intl.dev is a different library

The public astro-intl.dev package is an unrelated message library (`[lang]` segment, request-scoped translations, middleware rewrites). It doesn't pair translations, inject routes, or emit hreflang.

**How to apply:** Don't borrow its patterns for `@siteonce/astro-intl`.

## Gotchas

- **Stopping `astro dev`:** Astro 7's `astro dev` detaches. Stop it with `astro dev stop`, and read its output with `astro dev logs`.
- **`@siteonce/astro-intl/runtime` in the content config:** `@siteonce/astro-intl/runtime` can't be imported from `src/content.config.ts`. The `astro` Vite environment lacks `virtual:astro:pages`. Intl fails startup on a direct import. A transitive import still shows Astro's raw error.
- **Editing `intl.config.ts` or `routes.config.ts`:** Stop and start `astro dev` after editing `intl.config.ts` or `routes.config.ts`. A restart keeps the old config.
- **`astro check` hides type errors in `intl.config.ts`:** `astroIntl(intlConfig)` in `astro.config.mjs` parses the config while Astro loads it, so an invalid config stops with `Unable to load your Astro config`. `tsc --noEmit -p apps/demo` shows the type error, next to the existing `getCollection(name)` errors in intl's source.
- **Zod 4 nested defaults:** `.default({})` doesn't apply inner defaults; use `.prefault({})`.
- **Prerendered 404s still emit a file** (Astro 7.3.4): returning `new Response(null, { status: 404 })` from a prerendered route doesn't drop it.
- **Temporary adapter experiments:** revert the Node adapter, `viewRendering: 'request'`, and any test content before staging; `@astrojs/node` isn't a standing dependency.
- **`pnpm install` fails on sharp:** `--ignore-scripts` still links the workspace.
- **`biome.json` is strict JSON:** no comments.
- **No `.md` under `src/pages/`:** it becomes a route, so no nested `AGENTS.md` there.
- **Intl's `source` condition:** everything in the repo resolves `@siteonce/astro-intl` to `src/` through the `source` export condition: package tests, Stryker, both tsconfigs (`customConditions`), and the demo's scripts and Vite plugin. A new entry point (a script, a test harness, a Vite config) must add it, or it resolves `dist/`, which doesn't exist until a build. `pnpm smoke` is the only check on `dist/`.
- **Zod in intl:** intl imports `astro/zod`, never `zod`. Its own `zod` would put intl's schema pieces from one zod copy into schemas the app builds with Astro's copy.

## Release gotchas

- **Version Packages pull request:** the release job opens it with `GITHUB_TOKEN`, so no CI runs on it. `verify` runs after the merge, before `release` publishes.
- **Publishing by hand:** a fallback only; CI publishes. npm needs Marc's security key, which needs an interactive terminal. From an agent's shell, `pnpm publish` stops with `ERR_PNPM_OTP_NON_INTERACTIVE`, so Marc runs it in his own terminal.
- **Bumping a pinned action:** `pnpm/action-setup` and `changesets/action` use annotated tags, so the SHA a tag ref points at is the tag object, not the commit. Get the commit with `gh api repos/<owner>/<repo>/git/tags/<sha>`.
- **The trusted publisher names `ci.yml`:** renaming the workflow breaks publishing. Its fields can't be edited. Delete it and create a new one on npmjs.com, ticking "Allow `npm publish`" (newer publishers default to staged publishing only).
