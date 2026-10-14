# Good and bad tests

Runner: `node --test`. Assertions: `node:assert/strict`. Intl tests follow [Shape of a test](../../../docs/agents/tests.md#shape-of-a-test).

## Good tests

**Integration-style:** test through the real public interface, not mocks of internal parts.

```ts
// GOOD: observable behavior through the package's exports
import { createIntl, defineIntl } from '@repo/astro-intl';

it('omits href when a sibling is missing', async () => {
  const intl = createIntl(config, { loaders });
  assert.deepEqual(await intl.localeSwitcherLinks('en', 'blog/only'), [
    { locale: 'en', current: true, sibling: true },
    { locale: 'de', current: false, sibling: false },
  ]);
});
```

Traits:

- Tests behavior a caller cares about.
- Uses the public interface only.
- Survives internal refactors.
- Names WHAT, not HOW.
- One logical assertion per test.

## Bad tests

**Implementation-detail tests:** coupled to internal structure.

```ts
// BAD: imports an internal module the package doesn't export
import { pairCollections } from '../src/pairing.ts';

it('pairCollections builds byLocalePath', () => {
  const index = pairCollections(config, collections);
  assert.ok(index.byLocalePath.has('de:artikel/hallo'));
});
```

Red flags:

- Importing from `src/` instead of the package name.
- Mocking an internal module.
- Asserting on call counts or call order.
- Breaks on a refactor with no behavior change.
- The name describes HOW, not WHAT.
- Verifying through a side channel instead of the interface.

```ts
// BAD: verifies through the file system instead of the interface
it('writes the sitemap data file', async () => {
  await runBuild(root);
  assert.ok(existsSync(join(root, 'dist/_intl/sitemap.json')));
});

// GOOD: verifies through what the package hands the app
it('attaches pairing alternates and x-default from the entry', async () => {
  const item = await astroIntl(config).sitemap.serialize({
    url: 'https://example.com/en/blog/hello/',
  });
  assert.deepEqual(item.links, [/* literal alternates */]);
});
```

**Tautological tests:** the expected value restates the implementation, so the test passes by construction.

```ts
// BAD: expected value recomputed the way the code computes it
it('counts listing pages', () => {
  const expected = Math.ceil(entries.length / pageSize);
  assert.equal(pageCount(entries, pageSize), expected);
});

// GOOD: expected value is an independent literal
// (listingTails: a helper in this test file that reads tails through the exports)
it('publishes three pages for five entries at page size 2', async () => {
  assert.deepEqual(await listingTails('en'), ['blog', 'blog/2', 'blog/3']);
});
```
