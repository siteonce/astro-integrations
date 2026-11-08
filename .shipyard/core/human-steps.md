# Human steps and done conditions

## Human steps

- A human step is a workflow step that waits for the plan's human. Each workflow, and each skill that runs one, marks its human steps.
- Agents ask nothing outside human steps and spec questions. Anything else they decide from the plan, the spec and the agent rules, and report.
- At a human step the agent says plainly what it needs, offers a recommendation, and stops. In an interactive session it asks the human directly. A bot asks on the PR.
- A spec question is a finding that the spec is wrong, unclear or can't be built. Work on that point stops and goes to the plan's human, who decides and owns any spec change.

## Done conditions

- Every workflow step ends with a done condition: something visible in the repo or on the PR that marks it finished, such as a commit with its phase prefix, a comment with its fixed header, a ticked box or a passing check.
- A fresh agent resumes from repo and PR state alone: it finds the last done condition and starts at the next step.
- A step whose done condition isn't visible is not done, whatever an agent remembers.
