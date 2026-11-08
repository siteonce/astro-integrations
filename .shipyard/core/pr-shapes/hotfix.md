# Hotfix PR

A PR that fixes a defect in the repo's own released code, outside any plan.

| Field | Hotfix PR |
| --- | --- |
| Who opens it | The human, or an agent the human asks |
| Branch | From the default branch. If the default branch holds unreleased work that can't ship, from the repo's last release tag instead |
| What it may touch | Only the fix and its test |
| Review | The human |
| Verification evidence | A verification run showing the defect gone, on the surface where it appeared |
| Merge | The human, who then tags the repo's own release from the merged branch |

A fix branched from the repo's release tag lands on the default branch too, by a second PR on the same day.
