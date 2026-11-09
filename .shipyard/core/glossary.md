# Glossary

The workflow terms. One entry per term, one or two sentences each. Kit text uses these terms and no others for the same things.

## Roles

- **Human**: The person or people who write plans with the planning agent, merge, and release the repo's own code. Each plan names its human, who answers that plan's questions.
- **Planning agent**: The interactive agent the human drafts a plan with.
- **Orchestrator bot**: The bot that runs intake, briefs the builder bot for each phase, gives the phase verdict and keeps the plan record.
- **Builder bot**: The bot that builds one phase.
- **Reviewer bot**: The bot that runs preflight and reviews each phase; its review is advisory.
- **Interactive agent**: An agent working with the human in a session, such as the planning agent, or any agent the human talks to.
- **Bot**: An agent that runs autonomously, with no human in the session, started by a trigger.
- **Role mapping**: The part of the settings file naming the tool that fills each role, and how each tool is started.

## Structure

- **Workflow**: A process from a trigger to an outcome, such as planning, building or the weekly drift check. It produces PRs of one or more PR shapes.
- **Trigger**: The event that starts a workflow; each workflow names its own.
- **Trigger label**: A PR label that names the workflow to run; a human adding it is the approval to start. It stays until merge.
- **Hold label**: A label a human adds to stop a PR's work at the next done condition; removing it resumes.
- **Waiting label**: The label a bot adds when work stops at a human step; the human's removal resumes it.
- **Dispatcher**: The CI piece the repo's CI workflow runs on label events; it starts the role the role mapping names.
- **Human step**: A workflow step that waits for the plan's human. Agents ask nothing outside human steps and spec questions.
- **Done condition**: What a workflow step leaves visible in the repo or on the PR to mark it finished, such as a commit or a headed comment.
- **Answer skill**: The skill any interactive agent runs to show the human's waiting questions, post the answers and remove the waiting labels.
- **PR shape**: The structure of one kind of PR, given by the same fields for every shape: who opens it, branch, what it may touch, review, verification evidence and merge.
- **Practice**: Rules shared by all workflows, such as git, testing or verification.
- **House rules**: Opinions a person or a repo layers on top of the workflows, kept in the repo's agent rules.
- **Agent rules**: The repo's rules for how agents work in it, in the agent rules folder the settings file names.
- **Adopting repo**: A repo that uses shipyard.
- **Kit**: Shipyard's workflow files: core and the modules, each with its reference text, skills, templates and CI pieces. A repo keeps the parts it takes in `.shipyard/`.
- **Core**: The part of the kit every adopting repo takes; it works with a human and a planning agent alone.
- **Module**: An optional part of the kit, such as building, dispatch or verification. Its index names the modules and roles it needs.
- **Part**: Core or one module. Each is a folder in the kit, and in `.shipyard/` once the repo takes it.
- **Kit glossary**: This file: the managed file in core that defines the workflow terms.
- **Repo's glossary**: The adopting repo's own glossary, at the glossary path the settings file names, for its terms that aren't workflow terms.
- **Skill**: Instructions an agent loads and runs, kept in a `SKILL.md` file.
- **Discovery stub**: A small skill file in one tool's skills folder that points to the skill's single source file.
- **Template**: A file in the kit that a repo copies and then owns.
- **Managed file**: A file shipyard owns in an adopting repo. Updates replace it, so the repo never edits it.
- **Repo-owned file**: A file the adopting repo owns, such as a copied template or its specs. Shipyard never changes it after copying; removing shipyard deletes only the settings file, with `.shipyard/`.
- **Settings file**: `.shipyard/settings.yml`, the repo-owned file stating the repo's conventions, such as the role mapping, branch names and folder paths. Skills and CI pieces read it.
- **AGENTS.md block**: The marked block shipyard keeps in the repo's AGENTS.md, pointing agents to the settings file and listing the trigger labels and skills.
- **CI workflow**: A GitHub Actions workflow. Always called this, never just "workflow".
- **CI piece**: A GitHub Action in the kit that the repo's own CI workflows call at a release tag.
- **Release**: A tagged version of shipyard, numbered by semver, with a changelog entry. Kit text calls an adopting repo's own releases "the repo's own release", never just "release".
- **Version record**: The file in `.shipyard/` naming the release the repo's managed files came from, with a checksum per managed file.

## Specs and plans

- **Spec**: The text in the spec folder the settings file names that states what the codebase does and refuses. Tests can cite it.
- **Today note**: A note in a spec marking where code and spec differ; deleted when the gap closes.
- **North star**: Where the codebase is heading, and why.
- **Plan**: A file stating one piece of intended work: its human, goal, Changes and phases. Once done, it is the record of what got done.
- **Change**: One thing the human wants true once a plan is built, such as a behavior, a documented step or a refactor, approved with the plan. Its Spec line states it and its Evidence line names what proves it.
- **Spec line**: The part of a Change that states what the spec will say after it, or, for a Change that edits no spec, `none` and what is true after it.
- **Evidence line**: The part of a Change that names the verification evidence proving it. Checks are always required and not listed.
- **Plan PR**: Core's PR shape for one plan and all of its work, in a repo that builds plans its own way.
- **Phased PR**: The building module's PR shape for one plan, built phase by phase on the plan's own PR.
- **Docs-only PR**: Core's PR shape for a change to documentation alone, outside any plan.
- **Hotfix PR**: Core's PR shape for a fix to a defect in the repo's own released code, outside any plan.
- **Plan check**: An inspection of a plan for its required items. It never judges plan quality.
- **Intake**: The orchestrator bot checks an approved plan against the repo, raises gaps with the plan's human, and splits the Changes into phases.

## Phases

- **Phase**: One step of a plan, built and reviewed on its own. It delivers one or more Changes.
- **Tests box**: The part of a phase that names a seam and the behavior its tests assert, for a phase that changes code a seam reaches.
- **Code box**: The part of that phase that names what makes its tests pass.
- **Work box**: The part of a phase that changes no code a seam reaches: it names what the phase changes and, where that is code, why no seam reaches it.
- **Notes line**: The line added to a phase when it's done: its verification line, deviations, blockers, and answers that changed the work.
- **Preflight**: The reviewer bot reads one phase against the specs before it is built, lists open questions and sets the phase's scope.
- **Phase brief**: The orchestrator bot's instructions to the builder bot for one phase: goal, resolved facts, scope and limits.
- **Restatement**: The builder bot's own-words summary of its phase, checked against the plan before any change.
- **Spec rule**: When the builder bot may write spec text without asking: only behavior the plan names, and nothing existing changed or removed.
- **Extra spec lines**: Spec text the builder bot wrote that no Spec line called for. Listed in the phase report for review.
- **Seam**: Where tests touch the code, such as a package's exports or an app's routes. Each repo names its own.
- **Spike**: A throwaway experiment an agent runs to learn how or whether something works. Its work never lands in the PR.
- **Phase report**: The builder bot's closing account of a phase: what changed, check results, extra spec lines, test changes with reasons, the evidence list and spike findings.
- **Review**: The reviewer bot's findings on a phase's code and spec.
- **Blocking finding**: A finding that cites a plan or spec line and must be fixed. Findings without one are nits.
- **Phase verdict**: The orchestrator bot's combined judgment of a phase, from its own reading, the review and the verification evidence.
- **Fix round**: A pass where the builder bot brings code and tests back in line with the spec. It never changes the spec.
- **Spec question**: A finding that the spec itself is wrong, unclear or can't be built. Work stops and the plan's human decides.
- **Plan record**: The commit, by whoever builds the plan, that ticks a finished phase's boxes and adds its notes to the plan.
- **Status comment**: The one PR comment the orchestrator bot edits in place with phase status and open questions.
- **Handoff**: The final PR comment that hands finished work to the plan's human.
- **Repo fix**: A change that stops a repeated mistake, tried in order: architecture, types, lint or CI, a test, docs.
- **Sizing log**: One row per phase comparing estimated hours with what the run took.

## Verification

- **Check**: An inspection that doesn't run the real thing, such as types, build, tests, a plan check or a drift check.
- **Verification**: Running the real artifact the way a user or consumer would and capturing what happened. Tests are not verification.
- **Surface**: The way a user or consumer touches the codebase, such as a web page, an API, a library or a CLI; not a screen. The settings file names the repo's surfaces.
- **Verification evidence**: What a verification run captures: screenshots, traces, requests and responses, transcripts.
- **Evidence list**: The list naming each piece of verification evidence: what was driven, the file, what it shows. In the building module, it is part of the phase report.
- **Verification line**: One line of text on the PR saying what was verified and how.
- **Verification skill**: The repo's own skill for launching, driving and observing its codebase: a CLI in the repo, a `SKILL.md` and a Feature Map.
- **Feature Map**: The verification skill's index of features: how to reach and drive each one, and what end state proves it works.
- **Test-change signals**: Signs a test change weakens a test: a looser assertion, a deleted case whose code remains, changed expected values under an unchanged name, a test that reads internals.
- **Weekly drift check**: A weekly run that maintains the verification skill, flags specs and agent rules that no longer match the code, and reviews dependency update PRs.
- **Drift report**: The file a weekly drift check commits to its drift check PR, listing its findings for the human; deleted before the PR merges.
- **Drift check PR**: The PR one weekly drift check run opens so the human can examine its drift report.
- **Drift-risk list**: Areas prone to drift that the agent rules list, checked by each weekly drift check.
- **Dependency update PR**: A PR that updates a dependency, opened by the repo's dependency update tool and reviewed by each weekly drift check.
