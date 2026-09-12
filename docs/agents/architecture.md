# AGENTS.md architecture — in-place rules + pairing

The snapshot is the product. Agent rules live in the `AGENTS.md` of the directory they govern. There is no separate rule-sync path and no package-shipped copy under `.agents/`.

## The pairing invariant

**Every `AGENTS.md` in this repo MUST have a sibling `CLAUDE.md` whose entire content is `@AGENTS.md`. No exceptions.** Claude Code auto-loads only `CLAUDE.md` files (and their `@`-imports), never a bare `AGENTS.md`; the stub closes that gap. Codex and Cursor read `AGENTS.md` directly, so the stub is a harmless no-op for them.

Enforcement is manual today — see `docs/out-of-scope.md`.

## Placement

- **Root `AGENTS.md`** — vocabulary, and standing constraints that apply repo-wide (pre-commit gate, version policy, pairing, authoring language, interactivity ladder, config vs env, error policy, source comments).
- **Nested `AGENTS.md`** — local rules for that subtree. Self-contained: do not import a shared rule file from another directory. A path pointer to a sibling `AGENTS.md` is fine.

Package files (`packages/*/AGENTS.md`) cover how to edit the package. App files (`apps/marketing/**/AGENTS.md`) cover how to use it in the site.

## Nested AGENTS.md required sections

Every nested `AGENTS.md` in this monorepo uses these sections as needed:

- **Scope** — thin framing for the subtree.
- **Conventions** — local rules agents follow while editing (directives, dependency direction, file-local bans).
- **Out of scope** — hard-stop agent boundaries only when a one-line stop is load-bearing; not product-boundary essays.

Nested files hold **agent rules only** — terse directives and pointers. Live product rules live in nested `AGENTS.md`. Do not cite `docs/adr/` from an agent file — ADRs record the trade-off; they are not a rule home. Glossary: `CONTEXT.md`.

## Self-describing files

Codex walks `AGENTS.md` from root to cwd and does not follow `@import`. Cursor's cross-directory `@` behavior is undocumented. Nested files stay self-describing enough to give context without following an import. Do not put load-bearing rule content behind an `@`-import.
