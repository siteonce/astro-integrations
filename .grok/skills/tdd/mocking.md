# When to mock

Mock at **system boundaries** only. Here that is:

- Astro's modules (`astro:content`, `astro:i18n`). A package takes them as injected functions, e.g. `createIntl(config, { loaders: { getCollection, getRelativeLocaleUrl, getAbsoluteLocaleUrl } })`.
- Astro's integration hooks. Call the hook with a plain object holding the params the hook reads.
- The file system. Use a fresh temp dir per test (`mkdtemp`) and remove it after.
- Time and randomness.

Don't mock:

- Your own modules.
- Internal collaborators.
- Anything in this repo.

A test never imports from an app (`apps/*`). Fixtures are written in the test, or built by the package's `test/fixtures.ts`.

## Designing for mockability

At a boundary, shape the interface so a test can pass a fake in.

**1. Inject the dependency.**

```ts
// Easy to fake
function createIntl(config, options?: { loaders?: IntlLoaders }) {
  /* … */
}

// Hard to fake
function createIntl(config) {
  const { getCollection } = await import('astro:content');
  /* … */
}
```

**2. One function per operation, not one generic function.**

```ts
// GOOD: each fake returns one shape
const loaders = {
  getCollection: async (name) => fixtures[name] ?? [],
  getRelativeLocaleUrl: (locale, path = '') => `/${locale}/${path}`,
};

// BAD: the fake needs branching to answer each caller
const loaders = {
  call: async (op, ...args) => {
    /* switch on op */
  },
};
```

One function per operation means:

- Each fake returns one specific shape.
- No branching in test setup.
- A reader sees which boundary a test uses.
- Each operation keeps its own types.
