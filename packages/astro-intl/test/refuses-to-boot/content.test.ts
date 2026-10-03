import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { createIntl, createIntlSchema, defineIntl, slug } from '@repo/astro-intl';
import { intlHooks } from '../astro.ts';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
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
  '@repo/astro-intl: src/content.config.ts imports @repo/astro-intl/runtime. Astro loads the content config before page modules exist, so astro:config/server is unavailable there. Read locales from your intl config instead.';

const legacyContentConfigImportsRuntime =
  '@repo/astro-intl: src/content/config.mts imports @repo/astro-intl/runtime. Astro loads the content config before page modules exist, so astro:config/server is unavailable there. Read locales from your intl config instead.';

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
 * Blog posts point at a translated author, an untranslated source, and an untranslated role.
 */
function linkedEntries(): Record<string, CollectionEntry[]> {
  const post = (locale: 'en' | 'de', leaf: string) =>
    collectionEntry('blog', `hello-${locale}`, {
      id: 'hello-world',
      locale,
      slug: leaf,
      author: relation('authors', 'ada'),
      source: relation('sources', 'astro'),
      role: relation('roles', 'editor'),
    });
  return {
    blog: [post('en', 'hello-world'), post('de', 'hallo-welt')],
    authors: [
      collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
      collectionEntry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada DE' }),
    ],
    sources: [collectionEntry('sources', 'astro', { name: 'Astro' })],
    roles: [collectionEntry('roles', 'editor', { name: { en: 'Editor', de: 'Redakteur' } })],
  };
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

describe('the content config directly imports @repo/astro-intl/runtime', () => {
  // A direct import is a static import, a side-effect import, export-from, or import().
  const directImports = [
    `import { locales } from '@repo/astro-intl/runtime';`,
    `import { locales } from "@repo/astro-intl/runtime";`,
    `import locales from '@repo/astro-intl/runtime';`,
    `import type { Locale } from '@repo/astro-intl/runtime';`,
    `import '@repo/astro-intl/runtime';`,
    `import "@repo/astro-intl/runtime";`,
    `import\n  '@repo/astro-intl/runtime';`,
    `import {\n  locales,\n} from '@repo/astro-intl/runtime';`,
    `export { locales } from '@repo/astro-intl/runtime';`,
    `export * from "@repo/astro-intl/runtime";`,
    `export type { Locale } from '@repo/astro-intl/runtime';`,
    `const locales = await import('@repo/astro-intl/runtime');`,
    `import(\n  "@repo/astro-intl/runtime"\n);`,
    `import { id } from '@repo/astro-intl';\nimport { locales } from '@repo/astro-intl/runtime';`,
  ];

  // A different specifier, a longer specifier, or a quoted mention is not that import.
  const notDirectImports = [
    `import { id, locale } from '@repo/astro-intl';\nexport { id, locale };\n`,
    `import { id, locale } from '@repo/astro-intl';`,
    `import { locales } from '@repo/astro-intl/sorting';`,
    `import { locales } from '@repo/astro-intl/runtime/extra';`,
    `import { locales } from '@repo/astro-intl/runtime.ts';`,
    `const spec = '@repo/astro-intl/runtime';`,
    `import { id } from '@repo/astro-intl';\nconst spec = '@repo/astro-intl/runtime';`,
    `import { locales } from "@repo/astro-intl/runtime';`,
  ];

  it('fails startup when the content config directly imports @repo/astro-intl/runtime', async (t) => {
    for (const source of directImports) {
      const hooks = await contentProject(t, { 'content.config.ts': source });
      await assert.rejects(() => hooks.setup(), { message: contentConfigImportsRuntime }, source);
    }
  });

  it('fails startup when the legacy content config directly imports @repo/astro-intl/runtime', async (t) => {
    const hooks = await contentProject(t, {
      'content/config.mts': `export { locales } from '@repo/astro-intl/runtime';\n`,
    });
    await assert.rejects(() => hooks.setup(), { message: legacyContentConfigImportsRuntime });
  });

  it('boots when the content config imports @repo/astro-intl', async (t) => {
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

  it('boots when the content config does not import @repo/astro-intl/runtime', async (t) => {
    // content.config.mjs is the content config. The later content.config.ts is not read.
    const earlier = await contentProject(t, {
      'content.config.mjs': `import { id } from '@repo/astro-intl';\n`,
      'content.config.ts': `import { locales } from '@repo/astro-intl/runtime';\n`,
    });
    await earlier.setup();

    // content.config.ts is the content config. The legacy content/config.ts is not read.
    const modern = await contentProject(t, {
      'content.config.ts': `import { id } from '@repo/astro-intl';\n`,
      'content/config.ts': `import('@repo/astro-intl/runtime');\n`,
    });
    await modern.setup();

    assert.deepEqual(earlier.updates, [writtenI18n]);
    assert.deepEqual(modern.updates, [writtenI18n]);
  });
});

describe('a name in translated or untranslated is not a content collection', () => {
  it('fails when a translated name is not a content collection', async () => {
    const intl = createIntl(
      intlConfig({ collections: { translated: ['pages', 'blog', 'authors'] } }),
      { loaders: collectionLoaders({ pages: [], blog: [] }, { strict: true }) },
    );
    await assert.rejects(() => intl.getPairedSlugs(), {
      message: '@repo/astro-intl: collections.translated: "authors" is not a content collection.',
    });
  });

  it('fails when an untranslated name is not a content collection', async () => {
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
      message: '@repo/astro-intl: collections.untranslated: "sources" is not a content collection.',
    });
  });
});

describe('relation() names a collection neither collections.translated nor collections.untranslated lists', () => {
  it('throws when relation() names a collection in neither list', () => {
    const { relation: relationSchema } = contentSchema();
    assert.throws(
      () => {
        // @ts-expect-error relation name is not in the config lists
        return relationSchema('ghost');
      },
      {
        message:
          '@repo/astro-intl: relation("ghost") is in neither collections.translated nor collections.untranslated.',
      },
    );
  });
});

describe('a relation points at a collection neither collections.translated nor collections.untranslated lists', () => {
  it('fails load when entry data holds a relation to a collection in neither list', async () => {
    const collections = linkedEntries();
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
        '@repo/astro-intl: relation points at "ghost", which neither collections.translated nor collections.untranslated lists (blog:hello-en).',
    });
  });

  it('fails getRelated for a collection in neither list and does not fetch it', async () => {
    const loaded: string[] = [];
    const intl = loadIntl(linkedEntries(), loaded);
    await intl.getPairedSlugs();
    assert.deepEqual(loaded, ['blog', 'authors', 'sources', 'roles']);

    await assert.rejects(() => intl.getRelated('en', relation('ghost', 'x')), {
      message:
        '@repo/astro-intl: relation points at "ghost", which neither collections.translated nor collections.untranslated lists.',
    });
    assert.deepEqual(loaded, ['blog', 'authors', 'sources', 'roles']);
  });
});

describe('a relation pairing id is missing, a translated target has no sibling in the source locale, or a localized() map has a missing or extra locale key', () => {
  it('rejects an empty relation pairing id', () => {
    const { relation: relationSchema } = contentSchema();
    assert.deepEqual(schemaIssues(relationSchema('authors').safeParse('')), [
      { path: [], message: 'Too small: expected string to have >=1 characters' },
    ]);
  });

  it('fails when a translated target has no sibling in the source locale', async () => {
    const collections = linkedEntries();
    collections.authors = [
      collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
    ];
    const intl = loadIntl(collections);
    await assert.rejects(() => intl.getPairedSlugs(), {
      message: '@repo/astro-intl: relation authors/ada is missing locale "de" (blog:hello-de).',
    });
  });

  it('rejects a localized map that misses a locale key', () => {
    const { localized } = contentSchema();
    assert.deepEqual(schemaIssues(localized(slug).safeParse({ en: 'Editor' })), [
      { path: ['fr'], message: 'Invalid input: expected string, received undefined' },
    ]);
  });

  it('rejects a localized map with an extra locale key', () => {
    const { localized } = contentSchema();
    assert.deepEqual(
      schemaIssues(localized(slug).safeParse({ en: 'Editor', fr: 'Rédacteur', de: 'Redakteur' })),
      [{ path: [], message: 'Unrecognized key: "de"' }],
    );
  });
});
