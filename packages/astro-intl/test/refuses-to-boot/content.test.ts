import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createIntl, createIntlSchema, defineIntl, slug } from '@siteonce/astro-intl';
import { intlHooks, resolvedRoute, siteRootRoute, stubAstroModules, writeViews } from '../astro.ts';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
  linkedCollections,
  relation,
} from '../fixtures.ts';

/** Astro i18n that `intlConfig()` writes when startup succeeds. */
const writtenI18n = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
      fallbackType: 'redirect',
    },
  },
};

const contentConfigImportsRuntime =
  '@siteonce/astro-intl: src/content.config.ts imports @siteonce/astro-intl/runtime. Astro loads the content config before page modules exist, so astro:config/server is unavailable there. Read locales from your intl config instead.';

const legacyContentConfigImportsRuntime =
  '@siteonce/astro-intl: src/content/config.mts imports @siteonce/astro-intl/runtime. Astro loads the content config before page modules exist, so astro:config/server is unavailable there. Read locales from your intl config instead.';

/**
 * Writes content-config files under the temp project's `src` and returns the hooks.
 * Keys are paths relative to `src`.
 */
async function contentProject(t: TestContext, files: Readonly<Record<string, string>>) {
  const hooks = await intlHooks(t, intlConfig());
  for (const [name, source] of Object.entries(files)) {
    const file = join(hooks.root, 'src', name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
  }
  return hooks;
}

/**
 * Locales `en` and `fr`. Translated `authors` and `tags`. Untranslated `sources`.
 * A localized map is exactly the keys `en` and `fr`.
 */
function contentSchema() {
  return createIntlSchema(
    defineIntl({
      locales: ['en', 'fr'],
      defaultLocale: 'en',
      collections: {
        translated: ['authors', 'tags'],
        untranslated: ['sources'],
      },
    }),
  );
}

function schemaIssues(parsed: {
  success: boolean;
  error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
}) {
  assert.equal(parsed.success, false);
  if (parsed.success || parsed.error === undefined) {
    throw new Error('expected the schema to reject the value');
  }
  return parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

/**
 * Zod issues from `safeParse`: count, paths, and a key the value names.
 * These issues have no intl prefix. The wording is zod's.
 */
function refusesAt(
  parsed: Parameters<typeof schemaIssues>[0],
  expected: readonly { path: readonly PropertyKey[]; key?: string }[],
): void {
  const issues = schemaIssues(parsed);
  assert.equal(issues.length, expected.length);
  assert.deepEqual(
    issues.map((issue) => issue.path),
    expected.map((issue) => issue.path),
  );
  for (const [index, issue] of expected.entries()) {
    if (issue.key !== undefined) assert.ok(issues[index]?.message.includes(`"${issue.key}"`));
  }
}

/** `createIntl` over translated blog and authors, and untranslated sources and roles. */
function loadIntl(
  collections: Readonly<Record<string, readonly CollectionEntry[]>>,
  loaded?: string[],
) {
  return createIntl(
    intlConfig({
      routes: [
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          view: 'post',
          collection: 'blog',
        },
      ],
      collections: {
        translated: ['blog', 'authors'],
        untranslated: ['sources', 'roles'],
      },
    }),
    { loaders: collectionLoaders(collections, { loaded, strict: true }) },
  );
}

describe('The content config directly imports `@siteonce/astro-intl/runtime`. Read locales from the intl config.', () => {
  // A direct import is a static import, a side-effect import, export-from, or import().
  const directImports = [
    `import { locales } from '@siteonce/astro-intl/runtime';`,
    `import { locales } from "@siteonce/astro-intl/runtime";`,
    `import locales from '@siteonce/astro-intl/runtime';`,
    `import type { Locale } from '@siteonce/astro-intl/runtime';`,
    `import '@siteonce/astro-intl/runtime';`,
    `import "@siteonce/astro-intl/runtime";`,
    `import\n  '@siteonce/astro-intl/runtime';`,
    `import {\n  locales,\n} from '@siteonce/astro-intl/runtime';`,
    `export { locales } from '@siteonce/astro-intl/runtime';`,
    `export * from "@siteonce/astro-intl/runtime";`,
    `export type { Locale } from '@siteonce/astro-intl/runtime';`,
    `const locales = await import('@siteonce/astro-intl/runtime');`,
    `import(\n  "@siteonce/astro-intl/runtime"\n);`,
    `import { id } from '@siteonce/astro-intl';\nimport { locales } from '@siteonce/astro-intl/runtime';`,
  ];

  // A different specifier, a longer specifier, or a quoted mention is not that import.
  // Without a semicolon, the next line is a new statement. A quoted mention there is not an import.
  const notDirectImports = [
    `import { id, locale } from '@siteonce/astro-intl';\nexport { id, locale };\n`,
    `import { id, locale } from '@siteonce/astro-intl';`,
    `import { locales } from '@siteonce/astro-intl/sorting';`,
    `import { locales } from '@siteonce/astro-intl/runtime/extra';`,
    `import { locales } from '@siteonce/astro-intl/runtime.ts';`,
    `const spec = '@siteonce/astro-intl/runtime';`,
    `import { id } from '@siteonce/astro-intl';\nconst spec = '@siteonce/astro-intl/runtime';`,
    `import { locales } from "@siteonce/astro-intl/runtime';`,
    `const zod = await import('zod');\nconst spec = '@siteonce/astro-intl/runtime';`,
    `import { id } from '@siteonce/astro-intl';\n// locales come from '@siteonce/astro-intl/runtime'`,
    `import { defineCollection } from 'astro:content'\nconst note = '@siteonce/astro-intl/runtime'`,
  ];

  it('refuses when the content config directly imports @siteonce/astro-intl/runtime', async (t) => {
    for (const source of directImports) {
      const hooks = await contentProject(t, { 'content.config.ts': source });
      await assert.rejects(() => hooks.setup(), { message: contentConfigImportsRuntime }, source);
    }
  });

  it('refuses when the legacy content config directly imports @siteonce/astro-intl/runtime', async (t) => {
    const hooks = await contentProject(t, {
      'content/config.mts': `export { locales } from '@siteonce/astro-intl/runtime';\n`,
    });
    await assert.rejects(() => hooks.setup(), { message: legacyContentConfigImportsRuntime });
  });

  it('boots when the content config imports @siteonce/astro-intl', async (t) => {
    for (const source of notDirectImports) {
      const hooks = await contentProject(t, { 'content.config.ts': source });
      await hooks.setup();
      assert.deepEqual(hooks.updates, [writtenI18n], source);
    }
  });

  it('boots when no content config exists', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await hooks.setup();
    assert.deepEqual(hooks.updates, [writtenI18n]);
  });

  it('boots when the content config does not import @siteonce/astro-intl/runtime', async (t) => {
    // content.config.mjs is the content config. The later content.config.ts is not read.
    const earlier = await contentProject(t, {
      'content.config.mjs': `import { id } from '@siteonce/astro-intl';\n`,
      'content.config.ts': `import { locales } from '@siteonce/astro-intl/runtime';\n`,
    });
    await earlier.setup();

    // content.config.ts is the content config. The legacy content/config.ts is not read.
    const modern = await contentProject(t, {
      'content.config.ts': `import { id } from '@siteonce/astro-intl';\n`,
      'content/config.ts': `import('@siteonce/astro-intl/runtime');\n`,
    });
    await modern.setup();

    assert.deepEqual(earlier.updates, [writtenI18n]);
    assert.deepEqual(modern.updates, [writtenI18n]);
  });
});

describe('A name in `translated` or `untranslated` is not a content collection.', () => {
  it('refuses when a translated name is not a content collection', async () => {
    const intl = createIntl(
      intlConfig({ collections: { translated: ['pages', 'blog', 'authors'] } }),
      { loaders: collectionLoaders({ pages: [], blog: [] }, { strict: true }) },
    );
    await assert.rejects(() => intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: collections.translated: "authors" is not a content collection.',
    });
  });

  it('refuses when an untranslated name is not a content collection', async () => {
    const intl = createIntl(
      intlConfig({
        collections: {
          translated: ['pages', 'blog', 'authors'],
          untranslated: ['sources'],
        },
      }),
      {
        loaders: collectionLoaders({ pages: [], blog: [], authors: [] }, { strict: true }),
      },
    );
    await assert.rejects(() => intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: collections.untranslated: "sources" is not a content collection.',
    });
  });
});

describe('`relation()` names a collection neither `collections.translated` nor `collections.untranslated` lists.', () => {
  it('refuses when relation() names a collection in neither list', () => {
    const { relation: relationSchema } = contentSchema();
    assert.throws(
      () => {
        // @ts-expect-error relation name is not in the config lists
        return relationSchema('ghost');
      },
      {
        message:
          '@siteonce/astro-intl: relation("ghost") is in neither collections.translated nor collections.untranslated.',
      },
    );
  });
});

describe('A **relation** points at a collection neither `collections.translated` nor `collections.untranslated` lists.', () => {
  it('refuses when entry data holds a relation to a collection in neither list', async () => {
    const collections = linkedCollections();
    collections.blog = [
      collectionEntry('blog', 'hello-en', {
        id: 'hello-world',
        locale: 'en',
        slug: 'hello-world',
        author: relation('authors', 'ada'),
        // The field name is not the relation. The object is.
        lookalike: { intlRelationTarget: 'ghost', id: 'nope' },
      }),
    ];
    collections.authors = [
      collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
    ];
    const intl = loadIntl(collections);
    await assert.rejects(() => intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: relation points at "ghost", which neither collections.translated nor collections.untranslated lists (blog:hello-en).',
    });
  });

  it('refuses getRelated for a collection in neither list and does not fetch it', async () => {
    const loaded: string[] = [];
    const intl = loadIntl(linkedCollections(), loaded);
    await intl.getPairedSlugs();
    assert.deepEqual(loaded, ['blog', 'authors', 'sources', 'roles']);

    await assert.rejects(() => intl.getRelated('en', relation('ghost', 'x')), {
      message:
        '@siteonce/astro-intl: relation points at "ghost", which neither collections.translated nor collections.untranslated lists.',
    });
    assert.deepEqual(loaded, ['blog', 'authors', 'sources', 'roles']);
  });
});

describe('A **relation** pairing `id` is missing, the relation’s target entry is missing, or a `localized()` map has a missing or extra locale key.', () => {
  it('refuses an empty relation pairing id', () => {
    const { relation: relationSchema } = contentSchema();
    refusesAt(relationSchema('authors').safeParse(''), [{ path: [] }]);
  });

  it('refuses when a translated target has no sibling in the source locale', async () => {
    const collections = linkedCollections();
    collections.authors = [
      collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
    ];
    const intl = loadIntl(collections);
    await assert.rejects(() => intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: relation authors/ada is missing locale "de" (blog:hello-de).',
    });
  });

  it('refuses when an untranslated entry is missing a relation in another locale', async () => {
    // `locale` is en, and author ada exists only in en. The entry is still checked in de.
    const intl = loadIntl({
      blog: [],
      authors: [collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' })],
      sources: [
        collectionEntry('sources', 'astro', {
          locale: 'en',
          author: relation('authors', 'ada'),
        }),
      ],
      roles: [],
    });
    await assert.rejects(() => intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: relation authors/ada is missing locale "de" (sources:astro).',
    });
  });

  it('refuses when a list of relations names a missing target', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: 'blog',
          },
        ],
        collections: { translated: ['blog', 'tags'] },
      }),
      {
        loaders: collectionLoaders(
          {
            blog: [
              collectionEntry('blog', 'hello-en', {
                id: 'hello-world',
                locale: 'en',
                slug: 'hello-world',
                tags: [relation('tags', 'ghost')],
              }),
            ],
            tags: [],
          },
          { strict: true },
        ),
      },
    );
    await assert.rejects(() => intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: relation tags/ghost is missing locale "en" (blog:hello-en).',
    });
  });

  it('refuses a localized map that misses a locale key', () => {
    const { localized } = contentSchema();
    refusesAt(localized(slug).safeParse({ en: 'Editor' }), [{ path: ['fr'] }]);
  });

  it('refuses a localized map with an extra locale key', () => {
    const { localized } = contentSchema();
    refusesAt(localized(slug).safeParse({ en: 'Editor', fr: 'Rédacteur', de: 'Redakteur' }), [
      { path: [], key: 'de' },
    ]);
  });
});

describe('A literal file route sits on an entry URL that a `{slug}` row publishes (`src/pages/blog/hello.astro` beside the entry `hello`). Only the build checks this. `astro dev` serves the file route.', () => {
  /**
   * Builds `blog/{slug}` (en) and `artikel/{slug}` (de), resolves these literal project
   * file routes, then runs the build's data route. The stubbed `blog` collection holds
   * `hello-world` in en and `hallo-welt` in de.
   */
  async function dataRoute(t: TestContext, files: readonly string[]) {
    const hooks = await intlHooks(
      t,
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
        ],
        collections: { translated: ['blog'] },
      }),
    );
    await writeViews(hooks.root, ['post']);
    await hooks.setup({ command: 'build' });
    await hooks.routesResolved([
      ...files.map((pattern) =>
        resolvedRoute({
          entrypoint: join('src', 'pages', 'file.astro'),
          pattern,
          isPrerendered: true,
          origin: 'project',
        }),
      ),
      siteRootRoute(),
    ]);
    const data = hooks.injected.find((route) => route.pattern === '/_intl/sitemap-entries.json');
    assert.ok(data);
    return (await import(pathToFileURL(String(data.entrypoint)).href)) as {
      GET(): Promise<{ text(): Promise<string> }>;
    };
  }

  it('refuses when a literal file route sits on an entry URL', async (t) => {
    const route = await dataRoute(t, ['/de/artikel/hallo-welt']);
    const astroModules = stubAstroModules();
    try {
      await assert.rejects(() => route.GET(), {
        message:
          '@siteonce/astro-intl: file route "/de/artikel/hallo-welt" shadows "/de/artikel/hallo-welt/", ' +
          'the URL that entry blog:hello-de publishes in locale "de". Astro serves the file route there, ' +
          "while the sitemap and the siblings' hreflang point at the entry. " +
          "Remove or move the file route, or change the entry's slug.",
      });
    } finally {
      astroModules.deregister();
    }
  });

  it('builds when a literal file route sits on no entry URL', async (t) => {
    // `hallo-welt` is the de slug. The en section publishes `hello-world` only.
    const route = await dataRoute(t, ['/en/blog/hallo-welt', '/en/blog', '/de/hello-world']);
    const astroModules = stubAstroModules();
    try {
      const response = await route.GET();
      assert.deepEqual(
        (JSON.parse(await response.text()) as { loc: string }[]).map((entry) => entry.loc),
        ['https://example.com/de/artikel/hallo-welt', 'https://example.com/en/blog/hello-world'],
      );
    } finally {
      astroModules.deregister();
    }
  });

  it('builds when a literal file route sits under a listing section', async (t) => {
    // The file carries the entry slug `hello-world` and sits under the listing section `news`.
    // The entry section is `blog`. One entry per locale fills page 1 only.
    const hooks = await intlHooks(
      t,
      intlConfig({
        routes: [
          {
            slug: { en: 'news', de: 'nachrichten' },
            view: 'index',
            collection: 'blog',
            pagination: { pageSize: 10, slug: { en: 'news/{page}', de: 'nachrichten/{page}' } },
          },
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
        ],
        collections: { translated: ['blog'] },
      }),
    );
    await writeViews(hooks.root, ['index', 'post']);
    await hooks.setup({ command: 'build' });
    await hooks.routesResolved([
      resolvedRoute({
        entrypoint: join('src', 'pages', 'file.astro'),
        pattern: '/en/news/hello-world',
        isPrerendered: true,
        origin: 'project',
      }),
      siteRootRoute(),
    ]);
    const data = hooks.injected.find((route) => route.pattern === '/_intl/sitemap-entries.json');
    assert.ok(data);
    const route = (await import(pathToFileURL(String(data.entrypoint)).href)) as {
      GET(): Promise<{ text(): Promise<string> }>;
    };
    const astroModules = stubAstroModules();
    try {
      const response = await route.GET();
      assert.deepEqual(
        (JSON.parse(await response.text()) as { loc: string }[]).map((entry) => entry.loc),
        [
          'https://example.com/de/artikel/hallo-welt',
          'https://example.com/de/nachrichten',
          'https://example.com/en/blog/hello-world',
          'https://example.com/en/news',
        ],
      );
    } finally {
      astroModules.deregister();
    }
  });
});
