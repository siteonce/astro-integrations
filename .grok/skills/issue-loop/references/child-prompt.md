# Child prompt

Fill every `{…}` from the parent. Spawn this string as `prompt`. One issue, then stop. Do not create a scheduler.

```
ISSUE_LOOP_CHILD. Fresh subagent. You cannot see the parent conversation. Do exactly one GitHub issue, then stop. Do not create a scheduler or /loop. Do not start a second issue. Do not change issue bodies.

Status back to parent must be one of:
`blocked: <reason>` | `wait: blocked` | `done: milestone empty` | `issue N, <title>, <sha>, <verification>, labels, closed`

Repo: {REPO_PATH}
Remote: {OWNER}/{REPO}
Milestone: {MILESTONE} (API milestones/{MILESTONE_NUMBER})
Branch: {BRANCH} (existing PR {PR_URL} — do not open another)
Lock: {LOCK}

Target: issue {N} — {TITLE}
{RESUME}

If the lock exists and its PID is alive: print `blocked: lock held` and exit.
Otherwise create the lock with this PID; delete it in a trap on exit.

Stay on {BRANCH}. Never commit to main. Never commit docs/plans/ unless this issue's body requires it. If git fetch/push fails on SSL, retry with GIT_SSL_NO_VERIFY=1. If `gh issue list` fails TLS, use `gh api` REST.

If any *other* open milestone issue is labeled agent:done, close it (`gh issue close N --repo {OWNER}/{REPO} --reason completed`) before working.

Claim: `gh issue view {N} --repo {OWNER}/{REPO}` (full body = spec). Ensure label agent:in-progress (remove agent:ready if present). Keep other labels. Do not close yet. Do not retarget.

Orient: `gh api repos/{OWNER}/{REPO}/milestones/{MILESTONE_NUMBER} --jq .description` — place this issue only; implement this issue's body, nothing else.
Read AGENTS.md, CONTEXT.md (_Avoid_), docs/agents/architecture.md, and nested AGENTS.md in trees you touch. Pair every new AGENTS.md with CLAUDE.md whose entire content is @AGENTS.md.

Implement on {BRANCH} only. Do not amend previous commits. Run the issue's Done test / Verification, then typecheck/lint for what you touched.

If verification failed: leave agent:in-progress, do not commit, print `blocked: <reason>`, exit.
If ok: (1) conventional commit, body `Refs #{N}` — no Fixes/Closes trailer; (2) push origin {BRANCH}; (3) `gh issue edit {N} --repo {OWNER}/{REPO} --remove-label agent:in-progress --add-label agent:done`; (4) `gh issue close {N} --repo {OWNER}/{REPO} --reason completed`; (5) print `issue {N}, title, commit SHA, verification, labels, closed`.

Parent will spawn a new fresh subagent for the next issue.
```

## `{RESUME}`

Uncommitted files and `{N}` already `agent:in-progress`:

```
Keep the current uncommitted work. Finish this issue. Do not revert it. Do not start a different issue.
```

Otherwise:

```
Start from a clean tree on {BRANCH}.
```
