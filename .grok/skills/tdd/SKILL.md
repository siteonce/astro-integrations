---
name: tdd
description: 'Test-driven development: the red → green loop at public seams. TRIGGER when: implementing a handoff, feature, or fix test-first; writing, moving, or splitting tests; "red-green-refactor". DO NOT TRIGGER when: refactoring behind existing tests, or reviewing a branch.'
---

# Test-driven development

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd) (MIT, see `LICENSE`).

TDD is the red → green loop. This skill makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle.

Read `CONTEXT.md` so test names use the project's terms. Read the product file that covers the area (`docs/product/`). Tests are part of that documentation: [Tests document behavior](../../../docs/product/index.md#tests-document-behavior). Placement and runner: `docs/agents/tests.md`.

## What a good test is

A test checks behavior through a public interface, not implementation details. The code can change entirely; the test shouldn't. A good test reads like a specification: "publishes listing chunks per locale and omits page 1 as a number" says what the package can do, and it survives refactors because it doesn't depend on internal structure.

Examples: [tests.md](tests.md). Mocking: [mocking.md](mocking.md).

## Seams: where tests go

A **seam** is the public boundary a test calls: where you observe behavior without reaching inside. Tests sit at seams, never against internals.

- **Package:** its seam is its exports (`package.json` `exports`). Tests live in the package's `test/` folder and import the package by name (`@siteonce/astro-intl`), so they cannot reach an internal module. Each test file covers one section of the package's product file.
- **Single-module helper** (a demo util): its seam is the module. The test sits beside it.

**Test only at agreed seams.** The handoff's agreement names the seams and the test names. With no handoff, write the seams and test names down and confirm them with Marc before writing a test. You can't test everything; agreeing up front puts the effort on the critical paths and the complex logic.

When the shape of the interface itself is in question, read [`docs/agents/builders.md`](../../../docs/agents/builders.md) (write surface, read surface, the deletion test) and raise it with Marc rather than reshaping it inside the loop.

## Anti-patterns

- **Implementation-coupled:** mocks an internal module, imports a module the package doesn't export, or verifies through a side channel instead of the interface. The tell: the test breaks on a refactor although behavior didn't change.
- **Tautological:** the expected value is computed the way the code computes it, so the test passes by construction and can never disagree with the code. Expected values come from an independent source: a literal, a worked example, the product file.
- **Horizontal slicing:** writing all tests first, then all the code. Bulk tests check _imagined_ behavior: they test the shape of things, miss real changes, and fix the test structure before the implementation is understood. Work in **vertical slices**: one test → one implementation → repeat. Each test is a tracer bullet that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first and run it; see it fail for the reason you expect. Then write only enough code to pass it. No speculative features, no code for tests not yet written.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to review (`review-spec`), not the red → green cycle.
- **Moving existing tests** is the exception to red first: the behavior already exists. Move one product-file section at a time, keep source unchanged, and compare coverage (`node --test --experimental-test-coverage`) before and after so no case is lost silently.
