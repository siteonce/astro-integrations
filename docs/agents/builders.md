# Primary builders

Agents are the primary builders of these packages and of content sites built on them. Prefer well-supported tools with small setup and low lookup over human-authoring comfort; the right tool still wins.

Humans are indirect builders. They steer agents through conversation: they decide what gets built, judge the result from the agent's answers, and keep the product's agreements (`docs/product/`). They don't need to read the code or its diffs.

An agent knows the code only through what it reads: source, types, docs, and error messages. It does not see the rendered page, and it checks its work by running commands. Shape code so that reading is cheap and wrong work fails where the agent will see it.

## Small write surface

The write surface is what an app must write and know to use a package. It is the lines (imports, config keys, arguments, lines repeated in each page or view) and the facts behind them: what must be called first, what setup is required, how a call fails, and what shape a value comes back in.

- A call site passes only what the app alone decides: locale, path, entry, sort order. The package fills in what it already holds: its config, the locale list, key formats.
- Hidden facts count. A one-line call that only works if the caller knows an unstated rule ("call this first in every bundle", "this field comes back as a string despite its type") has a large write surface. Magic usually removes lines and adds facts the caller must know.
- Why: each line and each fact is something the agent must look up and can get wrong. A line that repeats a fact the package holds is a second copy; when the copies disagree, output is silently wrong. Views are copied as templates, so every line repeats in every view, and a later fix must touch each copy.
- Shrinking the surface never hides the data behind it ([No boxing in](../product/index.md#no-boxing-in)). A package hands out the raw data and pieces behind its convenience path, even though that makes its surface larger. This is a deliberate exception to hiding as much as possible.
- Check: for each line or fact at a call site, ask whether the package could know it or enforce it. If yes, the package should.

## Small read surface

The read surface is what an agent must read to predict what code does.

- The behavior of a function is visible from that function and the names it calls. It does not depend on a distant file, a naming convention, or a value set elsewhere at runtime.
- Apply the deletion test to every layer: imagine deleting it. If the complexity vanishes, it was a pass-through; delete it. If the same code would reappear in every caller, it earns its place.
- A layer that only copies, renames, or wraps fails the deletion test. A later change must be repeated in it, or gets silently dropped by it. Example: mapping config rows into the same shape loses any key added later.
- Names serve both readers. An agent finds code by searching for a name, so a name is distinctive: one name, one meaning, one hit. A human steers by talking with the agent, so a name is plain words from `CONTEXT.md` that say what the thing is or does. The agent's answer can then use the code's own names without translating them.
- Check: to change one behavior, how many files must be opened? More than the code that owns it means the read surface is too large.

## Files hold one job

- A file holds one job, and its name says which. An agent reads the whole file to find one function; unrelated code in it is spent context.
- Past about 300 lines, check whether the file holds two jobs. If so, split by job. Do not split a single job only to meet a size.
- A test sits at its seam, in its own file: [`tests.md`](tests.md).

## Wrong work fails loudly

- Prefer, in order: a type error, a startup or build failure, a test failure. Silent wrong output is the worst outcome; the agent cannot see it.
- When to fail and when to log: [`errors.md`](errors.md).

## Error messages name the fix

- An error says what is wrong, where (file, config key, entry), and what to change.
- Agents act on error text literally. A message that names a symptom ("X has not run") sends the agent to the wrong place.
- Check: could an agent fix the cause from the message alone, without reading the source that threw it?

## Types tell the truth

- A declared type matches the runtime value. Agents treat types as the spec.
- No API asks the caller for a type argument it cannot check. Take a value the code can check (a collection name) and derive the type from it.
- A cast (`as`) at a call site is a sign the API's types are wrong. Fix the API rather than copying the cast; templates spread casts to every copy.

## Same result in every run

- Behavior does not depend on which bundle, process, or import order runs the code, or on dev versus build.
- No module-level mutable state that callers must set first. No import side effects that register things. Pass values in, or bind them once in a factory.
- Why: an agent verifies a change by running a command. That check is worth nothing if another run behaves differently.

## One way per job

- One helper and one import path per job. Two ways to do the same thing get used at random and drift apart.
- When a new way replaces an old one, delete the old one in the same change, unless a human asked to keep it.
- Something kept for reference carries a comment saying so and why, so later agents don't take it for a live way.

## No false rules

- Dead code, unreachable checks, unused exports, and stale comments read as rules. An agent preserves them, copies them, and writes tests for them.
- Delete them, unless a human asked to keep them; then mark them as kept for reference (see [One way per job](#one-way-per-job)). A check that config validation already guarantees is a duplicate; keep the one at the boundary.
- Check: if deleting it changes no build, test, or output, it is not a rule.

## Deciding a gap

When the code does something the product file doesn't state, or needs a behavior it doesn't state, the agent decides:

1. Read the owning product file's exact words. A narrow sentence already decides what it leaves out.
2. Apply [`errors.md`](errors.md), [`docs/product/index.md`](../product/index.md) (No boxing in; Refuse, don't repair; Tests document behavior), and the owning file's own rules.
3. Write the answer into the product file together with its test, and list it in the report so a human can confirm or reverse it.

Ask a human first only when those rules conflict, or when the answer adds or removes a capability or a public URL.
