# Tests

A unit test is for a function that can return the wrong value while types, schema parse, and `astro build` still succeed.

Tests also document behavior: [Tests document behavior](../product/index.md#tests-document-behavior). Write them test-first with the `tdd` skill (`.grok/skills/tdd/`).

A test sits at its seam, the public boundary it calls. It asserts on the return value. The runner is `node --test`.

- **Package:** the seam is the package's exports. Tests live in the package's `test/` folder and import the package by name (`@repo/astro-intl`), never `src/`. Biome's `noRestrictedImports` enforces this in `packages/*/test/`. Each test file covers one section of the package's product file.
- **Single-module helper** (an app util, an `astro-site` util): the seam is the module. The test sits beside it and imports that function (or schema `.parse()`, or map).

Tests stand on their own. They never import from an app. Fixtures are written in the test or built by the package's `test/fixtures.ts`.

Expected values are literals or worked examples, never computed the way the code computes them.

A table or map in source is already the contract. Do not restate it in a test.

## Tests the code can't bend

- Tests for new behavior come first, in their own step, failing. The step that makes them pass does not edit them. When an agent implements against tests another step wrote, `test/` is read-only for it through a permission rule, not an instruction.
- An expected value changes only with the product file. A change that edits an expected value or drops an assertion, without a matching `docs/product/` change, is wrong. The report lists each test change beside the product line it follows.

Each package's `test` script sets a coverage floor over `src/` (`--test-coverage-lines`, `-branches`, `-functions`), and the run fails below it. Raise a floor when coverage rises. Never lower one to make a change pass. Coverage shows what ran, not what a test checks.

## Shape of a test

An intl test is a specification an agent copies. The named tests are the examples.

1. **Name the behavior**, in [`intl.md`](../product/intl.md) and [`CONTEXT.md`](../../CONTEXT.md) words: what, not how. A refusal's `describe` is the `intl.md` bullet, word for word. Its tests are "refuses …" and "boots when …". Model: `refuses-to-boot/views.test.ts`. A bare bullet, or a name that says how, is the wrong shape.
2. **Place it** in the file for the section that states the behavior (`intl.md`; sitemap is [`publishing.md`](../product/publishing.md)). `describe` blocks follow that section's order.
3. **Put the setup on screen.** Write the rows and entries the behavior needs in the test, so each expected value sits against that input. Builders come from `fixtures.ts` and `astro.ts`. A helper two files copy moves there (`warningsFrom`, `linkedEntries` / `linkedCollections`, `renderingConfig`, `boot`). A file-level helper is fine when its doc comment states every fact the expectations rely on (`missingIntl`: "`solo` is the default-locale entry with no German sibling"). Model: `fields` "aborts when a routed slug is not one segment". A test whose rows and entries the reader must look up elsewhere, or that builds more than the behavior needs, hides the check.
4. **One behavior per test.** Asserts may show it in each locale, or over a list of inputs. A list loops with the input as the assert label (`config` "refuses when {page} is not one whole final segment"). Several behaviors, or many asserts over several exports, is the wrong shape.
5. **Assert the return value against literals.** `deepEqual` on the object or array the export returns, whole, or projected to the fields the behavior is about (listing tails); `equal` for a single value. Never recomputed. Models: `url-form` `localeSwitcherLinks` tests; `path-helpers` "returns the written tail when the row names no entry".
6. **Assert a refusal in full** when the message is intl's. It is the fix the reader gets, and the test is its only record. A zod-written issue goes through `refusesAt`: prefix, issue count, paths, named keys. Sit each refusal beside the nearest input that boots or loads (`astro-config`, `content`, and `routes` do). A refusal with no neighboring input that boots hides the boundary. Rewording an intl message is a test change the report lists beside the new message. It needs no product-file line unless the fix the message names changes.
7. **Comment only a fact a literal depends on.** ("Eleven entries fill two pages of ten, so the listing publishes blog/2.")

## Mutation testing

Run it only when a human asks or approves, each time. A full `astro-intl` run takes about an hour.

Stryker makes one small edit to `src/` at a time (a mutant) and runs the tests. A mutant that survives is a change no test noticed. `packages/astro-intl/stryker.config.json` holds the setup; reports land in `.scratch/stryker/`. From `packages/astro-intl`:

```sh
pnpm --package=@stryker-mutator/core --package=typescript@$(node -p "require('../../package.json').devDependencies.typescript") dlx stryker run
```

`--mutate src/path.ts` (or a range, `src/path.ts:8-12`) limits a run to one file. Ask first all the same.

A survivor is evidence, not a task. Sort it before changing anything:

- A behavior the product file promises and no test checks: add a test at the seam.
- Code no input through the exports can observe: remove it ([deletion test](builders.md#small-read-surface)).
- A change to message wording, or one that changes no behavior: leave it.

The score is not a target. No `// Stryker disable` comments.

Tests cover packages and reusable helpers. One-off starter files (pages, endpoints, head components) belong to the customer; `astro build` verifies them.

Starter verification is `astro build` / `astro check`. Page and block templates are verified by that build.
