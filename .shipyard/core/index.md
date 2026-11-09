# Core

The part of the kit every adopting repo takes. It works with a human and a planning agent alone.

Needs: no other part.
Roles: human, planning agent.

## Contents

- [Glossary](glossary.md): the workflow terms.
- [Roles](roles.md): what each role does and what its tool needs.
- [Plans](plans.md): the planning workflow, the plan format and the plan check.
- [Spec writing](spec-writing.md): what goes in the spec and how it is written.
- [Human steps and done conditions](human-steps.md): when agents stop for the human, and how a step shows it is done.
- [House rules](house-rules.md): where a repo keeps its opinions.
- [PR shapes](pr-shapes/index.md): the fields every PR shape fills, and the plan, docs-only and hotfix PR shapes.
- Practices, which apply to every workflow: [git](practices/git.md), [testing](practices/testing.md), [verification](practices/verification.md).
- Templates, copied once and then owned by the repo:
  - [Settings file](templates/settings.yml), copied to `.shipyard/settings.yml`
  - [AGENTS.md block](templates/agents-block.md), added to the repo's AGENTS.md
  - [Plan](templates/plan.md), copied for each plan
  - [Spec index](templates/spec-index.md), copied to the spec folder as `index.md`
  - [Agent rules index](templates/agent-rules-index.md), copied to the agent rules folder as `index.md`
  - [Glossary](templates/context.md), copied to the glossary path
- [Notice](NOTICE.md): outside sources whose text the kit adapts, with their licenses. Keep it with the copied files.

## How the kit is written

- Each part's index has a Needs line, whose first sentence names the parts it needs by folder name, such as `core, dispatch.`, and a Roles line.
- Each workflow names its trigger, its steps, the roles that take part and the PR shapes it produces.
- Each PR shape fills the fields in [PR shapes](pr-shapes/index.md).
- Kit text names roles, never tools, and uses only terms from the glossary.
- The kit holds mechanics only. Opinions are house rules.
