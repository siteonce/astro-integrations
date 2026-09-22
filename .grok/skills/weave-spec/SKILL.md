---
name: weave-spec
description: "Lift a handoff's Agreement into the docs/product/ file it names, then delete the handoff. TRIGGER when: user asks to weave a spec, fold a handoff into docs, or /weave-spec. DO NOT TRIGGER when: the user wants the handoff written, implemented, or reviewed."
user-invocable: true
argument-hint: '[plan name]'
---

# Weave spec

Fold one finished handoff into the docs, then delete it. Format: [../write-spec/references/handoff.md](../write-spec/references/handoff.md).

## Procedure

1. **Open the handoff.** Resolve the file as the handoff format describes. Done when one file is open and its `Touches` path exists under `docs/product/`.

2. **Match the tree.** Compare `Agreement` to the tree. When a sentence describes behavior the tree does not have, and the user has not accepted that lag, stop and name the sentence. Leave the handoff in place. Done when every `Agreement` sentence is true in the tree, or the user has accepted a named lag.

3. **Edit the product file.** Add the `Agreement` sentences `Touches` is missing. Add a `Refuse` line only when that refusal stays true after this change. When the user accepted a lag, record it as a **Today** note in `Touches`, as `docs/product/index.md` describes. Write in the voice of that file. Use terms from `CONTEXT.md`. Done when `Touches` states the reliance and any durable refusal.

4. **Record a standing build rule.** When the change revealed a build rule the source will not show, add it to the existing `docs/agents/` file that owns the topic. When no file owns it, stop, leave the handoff in place, and name the gap. Done when that rule is in the owning file, or no such rule showed up.

5. **Delete the handoff.** Delete the handoff only after steps 2 through 4 finish without a stop. Done when the path is gone and the reply names the docs lines that changed.
