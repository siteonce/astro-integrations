# Handoff

Path: `.scratch/plans/<kebab-name>.md`. That tree is gitignored. Leave the file untracked.

## Which file

Use the plan name the user gave. Otherwise use the only file in `.scratch/plans/`. Several files and no name: ask which one. No file: stop.

## Shape

```markdown
# <title>

Consumer: visitor | the customer who installs the package | the app calling <package> Touches: docs/product/<file>.md

## Agreement

<sentences that can be lifted into Touches unchanged>

## Refuse

<what this change will not take on>

## Change

<the bounded work for the implementer>

## Check

<function name and the return value that can be wrong while types, schema parse, and astro build still succeed>
```

Omit `Check` when the build is the verification.

`Agreement` states what the consumer can rely on. It names no modules, types, or file paths. `Refuse` includes the convenient version this change leaves out. `Change` holds modules and boundaries.
