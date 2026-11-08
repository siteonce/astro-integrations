# Agents

How agents work in this repo. What the codebase does is in the spec, not here.

## Reading order

1. The kit glossary, `.shipyard/core/glossary.md`
2. The repo's glossary, `CONTEXT.md`
3. The spec index, `docs/product/index.md`
4. This file

## Rules

- The standing constraints in `AGENTS.md`, and the files it links in this folder, apply to plan work too. Each rule keeps one home, so this file doesn't repeat them.
- A push to `main` runs CI's `verify` job, then its `release` job while the repository variable `RELEASE_ENABLED` is `true`, as it is now. With pending changesets, `release` opens or updates the Version Packages pull request; with none, it publishes `@siteonce/astro-intl` to npm. So merging a plan's PR with a changeset opens that pull request, and merging the Version Packages pull request publishes. Tags set nothing off.

## House rules

- Shipyard plans the big work. A change big enough for a plan follows `.shipyard/core/plans.md` and Building plans below, including commits and pushes on the plan's branch. Smaller work keeps this repo's own flow: a handover to another agent (`MEMORY.md`, Design, then handover) or the spec skills in `.grok/skills/`. When it's unclear whether a change needs a plan, ask the human.

## Building plans

- The planning agent builds an approved plan in the same session, with the human watching: it adds the phases, builds and verifies each one, and keeps the plan record. The plan's PR takes core's plan PR shape.

## Commands

See `commands` and `seams` in `.shipyard/settings.yml`.
