# Verification

Verification means running the real artifact the way a user or consumer would and capturing what happened. Tests are code that backs the spec; they are not verification.

- Agents verify their own work, so they can keep going until it works without waiting on the human.
- A Change is verified once its Evidence line's verification has run on the real artifact and its evidence was captured.
- A Change's Evidence line can ask for more than the repo's minimums, never less.
- A run in the human's own browser isn't isolated from the human. Ask them to leave the machine alone during it, and to check any effect the agent can't read.

## Evidence

- Verification evidence is what a run captures: screenshots, traces, requests and responses, transcripts, files written.
- It is never committed. It goes to whoever judges the work, who opens only what they need.
- The evidence list names each piece: what was driven, the file, and what it shows. A trace or long log comes with a one-line summary, such as "no console errors over a 30 s session".
- The PR gets one verification line per verified piece of work: plain text saying what was verified and how, such as `verified: signup form at mobile and desktop, no console errors`. No media and no links to runs, which expire.
- Verification can be rerun on the final branch. If the human wants to see something at handoff, an agent reruns it then.
