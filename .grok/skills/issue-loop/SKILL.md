---
name: issue-loop
description: 'Walk a GitHub milestone one issue at a time by spawning a fresh subagent per issue. TRIGGER when: issue loop, walk the milestone, sequential milestone issues, fresh subagent per issue, or /issue-loop. DO NOT TRIGGER when: /loop, scheduler_create, CI/PR watches, local .scratch tickets, or implementing one named issue in this conversation.'
user-invocable: true
argument-hint: '[milestone]'
---

# Issue loop

<specification>
<goal>Walk a GitHub milestone by implementing one ready issue per fresh subagent until none remain open.</goal>
<principle>Independent issues get a new session.</principle>
<constraints>
- Parent orchestrates; children implement
- One live child at a time, on the named feature branch, existing PR only
- This TUI session is the worker — it must stay open
- Standing constraints live in AGENTS.md; children read them there
</constraints>
<success-criteria>
- No scheduler task remains for this walk
- Every child is `spawn_subagent` with `resume_from` omitted
- Every child lands at most one issue, or returns `blocked:` / `wait: blocked`
- Parent stops on `done: milestone empty`, `wait: blocked`, or `blocked:`
</success-criteria>
<error-handling>
- `wait: blocked` → report, stop; re-run this skill later
- `blocked: <reason>` → report, leave `agent:in-progress`, stop
- Dirty tree and an open `agent:in-progress` issue → that issue is the only legal target; keep the uncommitted files
</error-handling>
</specification>

`/loop` and `scheduler_create` fork the previous fire (`session_kind: subagent_resume`). Issue N's transcript stays in the window for N+1. This skill chains new subagents instead.

## Procedure

1. **Lock inputs.** From the user, else infer: `owner/repo` (git remote), milestone title or number, feature branch (current), existing draft PR (do not open another), lock `/tmp/<repo>-<milestone>-issue-loop.lock`. Done when all five are written down.

2. **Disarm the timer.** `scheduler_list`; delete any task whose prompt is this walk. Kill any in-flight subagent still running that walk. Remove the lock if its PID is dead. Done when no matching scheduled task remains.

3. **Housekeep.** Close every _open_ milestone issue labeled `agent:done` (`gh issue close N --repo owner/repo --reason completed`). Prefer `gh api` REST if `gh issue list` fails TLS. Native blocked-by unblocks only after the blocker is closed. Done when no open `agent:done` issue remains.

4. **Pick one.** If the worktree is dirty and an open milestone issue is `agent:in-progress`, that number is the target. Else list open milestone issues; for each, GET `/repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by` (do not trust `is:blocked` search); ready = every blocker closed or missing; pick the lowest number. Done when the target is one issue number, or a stop status is known.

5. **Stop or spawn.** No open issues → print `done: milestone empty`, stop. Open but none ready → print `wait: blocked`, stop. Else load [references/child-prompt.md](references/child-prompt.md), fill placeholders, `spawn_subagent` with `subagent_type: general-purpose`, `background: true`, `isolation: none`, and **omit** `resume_from`. Done when that child id is running.

6. **Relay.** On child completion, take its one-line status. Success → step 3 with a **new** spawn (never `resume_from` that child). Any other status → report it and stop. Do not implement in the parent. Do not poll the child.
