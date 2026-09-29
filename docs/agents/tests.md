# Tests

A unit test is for a function that can return the wrong value while types, schema parse, and `astro build` still succeed.

It lives next to the module that owns that behavior. It imports that function (or schema `.parse()`, or map) and asserts on the return value. The runner is `node --test`.

A table or map in source is already the contract. Do not restate it in a test.

Tests cover packages and reusable helpers. One-off starter files (pages, endpoints, head components) belong to the customer; `astro build` verifies them.

Starter verification is `astro build` / `astro check`. Page and block templates are verified by that build.
