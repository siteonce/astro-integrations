---
name: implement-spec
description: 'Implement the Change section of a .scratch/plans/ handoff so its Agreement holds. TRIGGER when: user asks to implement a spec, build from a handoff, or /implement-spec. DO NOT TRIGGER when: the handoff still needs writing, or the user wants a mismatch review or a docs fold.'
user-invocable: true
argument-hint: '[plan name]'
---

# Implement spec

Implement one handoff. Format: [../write-spec/references/handoff.md](../write-spec/references/handoff.md).

## Procedure

1. **Open the handoff.** Resolve the file as the handoff format describes. Done when one file is open.

2. **Read the constraints.** Read the handoff, the `Touches` file, and `CONTEXT.md`. When `Check` names a function, read `docs/agents/tests.md`. Done when `Agreement`, `Refuse`, and `Change` are in view.

3. **Make the change.** Implement `Change` so `Agreement` holds. Keep the work inside `Refuse`. When `Check` names a function, add the unit test `docs/agents/tests.md` describes for that return value. When `Check` is absent, add no unit test. Done when that work is in the tree, or an `Agreement` sentence blocks it.

4. **Leave Agreement intact.** When the tree cannot satisfy an `Agreement` sentence, stop and name that sentence. Update `Change` to record what landed. Leave the file untracked. Done when `Agreement` is unchanged and any gap is named in the reply.
