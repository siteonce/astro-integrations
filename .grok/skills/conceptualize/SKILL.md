---
name: conceptualize
description: 'Reach conceptual agreement on an idea or change by interviewing against CONTEXT.md and docs/product/. TRIGGER when: the user asks to discuss a concepte or brainstorm an idea, or think a change through before building.'
user-invocable: true
disable-model-invocation: true
---

# Conceptualize

Reach conceptual agreement on the user's idea or requested change. Before the first question, read `CONTEXT.md` and the `docs/product/` files that cover the area. Work from those files and from what the user says.

This skill does not edit workspace files, write to memory, or start follow-up work. The agreement is a plan. It might not be built.

Interview the user about their idea or requested changes until ambiguity around it is resolved. Map this as a design tree: every decision branches into the decisions that hang off it.

Work the tree in rounds. The frontier is every decision whose prerequisites are already settled: the questions you can ask now without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

When a check fires on something the user just said, that question is on the next frontier. Do not leave it for a later round.

- **Glossary.** When the user uses a term that conflicts with `CONTEXT.md`, ask which meaning holds. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"
- **Fuzzy language.** When the user uses a vague or overloaded term, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."
- **Product docs.** When the user states how something works, check whether `docs/product/` agrees. A contradiction goes on the frontier: quote the doc and the claim, and ask which holds.
- **Scenarios.** When a frontier decision is about how concepts relate, stress-test the boundary in that question. Invent concrete scenarios that probe edge cases and force a precise boundary.

Format a round like so:

```md
**Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

**Recommended:** - <your recommended answer>

---

**Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

**Recommended:** - <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a later round, not this one.

Finding facts is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The decisions are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. State that understanding and ask the user to confirm it. A correction is new input: recompute the frontier and keep going. Once they confirm, ask what to do next. Options: update `CONTEXT.md`, write a handoff with `/write-spec`, edit, or something else they name. Then stop.
