# Git

Rules for every workflow. Branch names and the default branch come from the settings file.

## Branches

- Each plan has one branch and one PR, which hold the plan file and all of its work.
- Several branches can be open at once; none waits for another.

## Commits

- Commit subjects use conventional prefixes, scoped by phase in plan work, so each phase can be reviewed on its own:

  | Prefix | Holds |
  | --- | --- |
  | `spec(phase-N):` | spec text for the phase |
  | `docs(phase-N):` | the phase's other changes to files in the settings file's docs paths |
  | `test(phase-N):` | tests |
  | `feat(phase-N):`, `fix(phase-N):` | code, and any other change |
  | `docs(plan):` | the plan file, from its draft to its approval |
  | `chore(plan): phases` | the phases, added to the plan before building starts |
  | `chore(phase-N): plan record` | the plan record |

- A fix after a phase's review is a `fix(phase-N):` commit for that phase.
- Work outside a plan uses the same prefixes without the phase scope, such as `spec:` for spec text. Copying or updating the kit's files is `chore:`.
- `spec` isn't a standard conventional type. A repo that lints commit types, such as with commitlint's conventional preset, adds `spec` to its allowed types.

## What agents never do

- Rewrite pushed history: no rebases, amends of pushed commits or force-pushes.
- Change git config, unless the human asks for that one change.
- Bypass hooks or checks.
- Commit to the default branch, unless the human asks for that one commit.
- Merge, tag, publish or deploy, unless the human asks for that one action.
