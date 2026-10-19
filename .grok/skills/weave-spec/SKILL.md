---
name: weave-spec
description: 'Fold a finished plan into docs/product/ after the build. When unresolved issues exist, list them and edit nothing. TRIGGER when: user asks to weave a spec, fold a handoff or brief into docs, or /weave-spec. DO NOT TRIGGER when: the user wants the handoff written, implemented, or reviewed.'
user-invocable: true
argument-hint: '[handoff, brief, or plan name]'
---

# Weave spec

Fold a finished plan into `docs/product/` after the build.

Handoff format: [../write-spec/references/handoff.md](../write-spec/references/handoff.md).

## Procedure

1. **Open the plan.** The argument may be a handoff name, a brief path, or a plan directory name. Resolve `<name>` from it. When the argument is omitted, resolve the handoff as the handoff format describes.

   Read `docs/plans/<name>/brief.md` when that file exists or the user passed it. Read `.scratch/plans/<name>.md` when that handoff exists. One of the two files is enough to start. Neither file: stop.

   When `docs/product/` exists, read `index.md` and the topic files it links. Also read every file named in the brief's `## Product` section.

   Done when a brief or a handoff is open, or this step stopped.

2. **List unresolved issues.** Unresolved means any of these:
   1. The brief has a `## Didn't go as planned` entry (`Planned:` present). The heading plus its instruction sentence is not an entry.
   2. A `Would change` or `Would add` sentence in the brief is not true in the tree.
   3. A `docs/product/` sentence is no longer true in the tree, and the brief did not propose that change. The "before" side of a `Would change` line is a proposed change, so it is kind 2, not kind 3.

   Open questions in the brief do not, by themselves, make the list unresolved.

   When a handoff is open and an `Agreement` sentence is not true in the tree, that sentence blocks the edit too.

   When anything here is unresolved, stop. Write nothing and delete nothing. Leave `docs/product/` as it was. The reply lists every issue with its kind, the sentence, and what the tree does instead. An `Agreement` miss has no kind number. Do not promote `Built instead` into `docs/product/`. Do not add a **Today** note to weave past a mismatch. The user resolves the list (change the tree, or change the brief or handoff), then runs weave again.

   Done when the list is empty and every open `Agreement` sentence is true in the tree.

3. **Edit the product files.** Apply brief `Would change` and `Would add` sentences the tree meets. Write them in the voice of the owning product file. When `CONTEXT.md` exists, read it and use its terms.

   When a `.scratch` handoff is also open, apply its `Agreement`. Add a `Refuse` line only when that refusal stays true after this change. Do not write the same sentence twice.

   When `docs/product/` does not exist, create the directory and an index. The index says these files are what the packages do. When the target product file does not exist, create it and link it from the index.

   Done when those sentences are in the owning files.

4. **Record a standing build rule.** When no handoff is open, skip this step. When a handoff is open and the change revealed a build rule the source will not show, add it to the existing `docs/agents/` file that owns the topic. When no file owns it, stop, leave the handoff in place, and name the gap.

   Done when that rule is in the owning file, no such rule showed up, or no handoff is open.

5. **Delete the handoff.** Delete the `.scratch` handoff only after the edits succeed. Do not delete `brief.md`. The reply names the product lines that changed.

   Done when any handoff that was open is deleted, any brief that was open is still in place, and the reply names the lines.
