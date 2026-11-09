# PR shapes

A PR shape is the structure of one kind of PR. Every shape fills the same fields:

| Field | States |
| --- | --- |
| Who opens it | The role that opens the PR |
| Branch | Where the branch starts and how it is named, by the settings file's branch names |
| What it may touch | The paths and kinds of change the PR may hold |
| Review | Who reviews it, and against what |
| Verification evidence | What verification the PR needs, beyond the checks every PR runs |
| Merge | Who merges it, and when |

Each module that produces a PR shape holds it as one file. Core holds the shapes any repo can use:

- [Plan PR](plan.md)
- [Docs-only PR](docs-only.md)
- [Hotfix PR](hotfix.md)
