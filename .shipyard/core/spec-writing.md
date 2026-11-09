# Spec writing

The spec states what the codebase does and refuses. It lives in the spec folder the settings file names.

## What belongs in the spec

A record belongs in the spec if changing it needs the human's approval and a test could cite it: who the codebase is for, its promise, its behavior, its refusals and its direction. It changes when the human changes their mind. A rename or a new helper doesn't get a line.

## Where other records go

| Record | Home |
| --- | --- |
| Front door, status line and reading order | the spec index, copied from [the template](templates/spec-index.md) |
| Behavior of one area | one spec file per area |
| Where code and spec differ | a Today note in that area's file, deleted when the gap closes |
| Parked and refused ideas | a later file in the spec folder |
| Terms | the repo's glossary |
| How agents work in the repo | the agent rules |
| A decision's outcome | the spec file it changes |
| A reason agents need, such as a rejected alternative | one sentence beside the rule it explains |
| Intended work | a plan |
| The history of a decision | the PR and git history, never read by default |

## Writing it

- Dry reference text: what holds, stated plainly. No tutorials, no history, no reasoning beyond the one-sentence reason a rule needs.
- Terms from the kit glossary and the repo's glossary. A new concept gets a glossary entry before it is used.
- The spec index lists every spec file. Adding or removing a file updates the index in the same commit.

## Spec and plans

- A plan is the approval for a spec change: each Change's Spec line states what the spec says after it.
- Spec text for a Change is written before the tests and code that back it, in its own commit.
- Spec text no Spec line calls for needs the plan's human. A spec question stops the work on that point until the human decides.
- A glossary entry that only defines a term an approved Change's text already uses counts as covered by that text. It is flagged on the PR. Changing an existing term's meaning needs the plan's human.
