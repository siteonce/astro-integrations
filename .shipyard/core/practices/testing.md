# Testing

## Layers

1. Checks: types, schema parsing, build. They don't run the real thing.
2. Tests at seams.
3. Verification: running the real artifact (see [verification](verification.md)).

Tests are not verification. A Change is done only when it is verified.

## What gets a test

- Only behavior that can be wrong while the checks pass.
- Tests sit at seams. The repo names its seams in the settings file, such as a package's exports or an app's routes. A test never reaches past a seam into internals.
- Literal expected values. No tautologies, no tables restated from the source.
- Mocks only at system boundaries.
- Each test passes two checks: breaking the behavior fails it; changing internals without changing behavior keeps it green.
- Tests assert on small fragments, never print or deep-compare large blobs such as data URIs, binaries or whole documents. Large output can crash the run that reads it.

## Changing a test

- Every change to an existing test states its reason: the spec line it follows, a refactor or rename, a removed feature, or a stronger test.
- A test change that alters asserted behavior comes with the spec change it follows.
- Review looks for the test-change signals: an assertion moved from exact to loose, a case deleted while its code remains, expected values changed under an unchanged test name, a test that reads source or internals.
- Loosening an assertion or deleting a case whose code remains is a blocking finding unless its stated reason holds.

Adapted in part from mattpocock/skills; see the [notice](../NOTICE.md#mattpocockskills).
