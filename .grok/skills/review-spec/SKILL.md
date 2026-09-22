---
name: review-spec
description: 'Compare the current change to a .scratch/plans/ handoff and resolve each mismatch with the user. TRIGGER when: user asks to review a spec, check a change against a handoff, or /review-spec. DO NOT TRIGGER when: the user wants the handoff written, the feature implemented, a general branch review, or the agreement folded into docs/.'
user-invocable: true
argument-hint: '[plan name]'
---

# Review spec

Compare one handoff to the change. Format: [../write-spec/references/handoff.md](../write-spec/references/handoff.md).

## Procedure

1. **Open the handoff.** Resolve the file as the handoff format describes. Done when one file is open.

2. **Read the change.** Read `Agreement`, `Refuse`, and `Check`. Read the diff against the merge-base with the default branch, plus uncommitted work that belongs to this change. `Change` bounds the scope. Done when each `Agreement` sentence and each `Check` has been compared to the code and tests.

3. **List mismatches.** Report each material mismatch with the handoff sentence, the code path, and what the tree does instead. Behavior the change added outside `Agreement` and `Refuse` is a mismatch. A missing `Check` test is a mismatch. Done when the list is in the reply, or the reply says the change matches the handoff.

4. **Resolve with the user.** Ask in the conversation, one mismatch at a time, whether the code or the handoff changes. Apply that choice before the next mismatch. Leave an updated handoff untracked. Done when every mismatch has their decision applied.
