# Roles

Kit text names roles, never tools. The role mapping in the settings file names the tool that fills each role and how each tool is started.

| Role | Does | Its tool needs |
| --- | --- | --- |
| Human | Writes plans with the planning agent, adds trigger labels, answers human steps and spec questions, merges, releases the repo's own code. | — |
| Planning agent | Drafts the plan with the human in an interactive session. | Reading and editing files, a shell, git |
| Orchestrator bot | Runs intake, writes phase briefs, starts the builder bot, gives the phase verdict, keeps the plan record and the status comment, escalates to the plan's human. Runs the weekly drift check. | Reading and editing files, a shell, git with push, PR comments it can edit, adding and removing labels, starting the builder bot and sending it follow-ups, starting the reviewer bot |
| Builder bot | Builds one phase: restatement, spec, tests, code, verification, phase report. | Reading and editing files, a shell, git with push to the PR's branch |
| Reviewer bot | Runs preflight and reviews each phase. Its review is advisory. | Reading the repo and the PR, PR comments, including inline review comments |

- One or more people can fill the human role. Each plan names its human, by default the person who wrote it. That person gets the plan's questions and its handoff.
- Bots run autonomously. The human and the planning agent work together interactively.
- Core needs only the human and the planning agent. Each module's index names the bots it needs.
