# Tests

A unit test is for a function that can return the wrong value while types, schema parse, and `astro build` still succeed.

Tests also document behavior: [Tests document behavior](../product/index.md#tests-document-behavior). Write them test-first with the `tdd` skill (`.grok/skills/tdd/`).

A test sits at its seam, the public boundary it calls. It asserts on the return value. The runner is `node --test`.

- **Package:** the seam is the package's exports. Tests live in the package's `test/` folder and import the package by name (`@repo/astro-intl`), never `src/`. Each test file covers one section of the package's product file.
- **Single-module helper** (an app util, an `astro-site` util): the seam is the module. The test sits beside it and imports that function (or schema `.parse()`, or map).

Tests stand on their own. They never import from an app. Fixtures are written in the test or built by the package's `test/fixtures.ts`.

Expected values are literals or worked examples, never computed the way the code computes them.

A table or map in source is already the contract. Do not restate it in a test.

Tests cover packages and reusable helpers. One-off starter files (pages, endpoints, head components) belong to the customer; `astro build` verifies them.

Starter verification is `astro build` / `astro check`. Page and block templates are verified by that build.
