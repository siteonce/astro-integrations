# <Plan title>

- Status: draft
- Human: <who owns this plan's intent>
- Goal: <one sentence on what changes for the user>
- Specs touched: <spec files the Changes edit, or none>
- Out of scope: <what this plan leaves alone>

## Changes

- [ ] 1. Spec: <what the spec says after this Change, or none; what is true after it> · Evidence: <what is driven and what is captured>
- [ ] 2. Spec: <...> · Evidence: <...>

## Open questions

- <question for the human> · Recommendation: <the planning agent's answer>. Delete this line once no question is open.

## Phases

Added before building starts, by whoever builds the plan. Until then, it holds only this note and the example below, which the phases replace. A phase that changes code a seam reaches has Tests and Code boxes; any other phase has one Work box, which says why no seam reaches any code it changes:

```
### Phase 1: <name> · delivers Change 1
- [ ] Tests: <seam>: <behavior the tests assert>
- [ ] Code: <what makes them pass>

Notes: <added when the phase is done: verification line, deviations, blockers>

### Phase 2: <name> · delivers Change 2
- [ ] Work: <what it changes, such as docs, config or content>

Notes: <...>
```
