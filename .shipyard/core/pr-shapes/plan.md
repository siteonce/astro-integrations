# Plan PR

A PR that holds one plan and all of its work, for a repo that builds plans its own way. A repo that takes the building module uses its phased PR instead.

| Field | Plan PR |
| --- | --- |
| Who opens it | The planning agent, at the end of the [planning workflow](../plans.md#planning-workflow), from the plan's branch |
| Branch | The plan's branch, named by `branches.plan` in the settings file. It holds the plan file and all of the plan's work |
| What it may touch | The plan file and what its phases name |
| Review | The plan's human, against the plan's Changes and the spec |
| Verification evidence | What each Change's Evidence line names, captured by whoever builds the plan and shown to the plan's human. The PR gets only verification lines |
| Merge | The plan's human, once each Change is verified |
