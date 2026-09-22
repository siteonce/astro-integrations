---
name: write-spec
description: 'Write a feature handoff at .scratch/plans/<name>.md in the voice of docs/product/. TRIGGER when: user asks to write a spec, nail down a feature, or /write-spec. DO NOT TRIGGER when: the user wants an existing handoff implemented, reviewed against the branch, or folded into docs/.'
user-invocable: true
argument-hint: '[feature name]'
---

# Write spec

Write the handoff a later session implements. Format: [references/handoff.md](references/handoff.md).

## Procedure

1. **Read the agreement.** Read `CONTEXT.md`, `docs/product/index.md`, and the product file for this area. Use those terms. Done when the consumer and the `Touches` path are named.

2. **Close the open questions.** Ask only what the request left unanswered, in this order. Wait while 4 or 5 has no answer.
   1. Which consumer: the visitor, the customer who copies the snapshot, or the app calling a package?
   2. Which file in `docs/product/` owns this, and which sentence is missing or now wrong?
   3. What does Astro, or the current package, already do here?
   4. After this change, what can that consumer rely on?
   5. What does this change refuse, including the convenient version?
   6. Which function can return the wrong value while types, schema parse, and `astro build` still succeed? If none, the check is the build.
   7. What is outside this change?

   Done when 4 and 5 are answered.

3. **Write the file.** Write `.scratch/plans/<kebab-name>.md` in the handoff format. `Touches` is the file from question 2. `Agreement` is the answer to 4, limited to reliance Astro or the current package does not already give (question 3). `Refuse` is the answer to 5. `Change` is the bounded work, including the answer to 7. `Check` is the answer to 6. Leave the file untracked. Done when the file matches the handoff format.

4. **Report the path.** Reply with `.scratch/plans/<kebab-name>.md`. Done when that path is in the reply.
