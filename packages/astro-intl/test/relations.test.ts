import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl, createIntlSchema, defineIntl, localizedValue, slug } from '@repo/astro-intl';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
  linkedCollections,
  relation,
} from './fixtures.ts';

/**
 * Locales `en` and `de`, default `en`, with the default locale prefixed.
 * Blog is routed at `blog/{slug}` and `artikel/{slug}`, so each post needs a slug.
 * `authors` is a translated record collection. `sources` and `roles` are untranslated.
 * A collection name absent from the map throws `missing <name>`.
 * `loaded`, when passed, receives each name `getCollection` is called with.
 */
function relationsIntl(
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

describe('relations', () => {
  it('parses an id into a relation naming its collection', () => {
    const { relation: relationSchema } = createIntlSchema(
      defineIntl({
        locales: ['en', 'fr'],
        defaultLocale: 'en',
        collections: {
          translated: ['authors', 'tags'],
          untranslated: ['sources'],
        },
      }),
    );

    const author = relationSchema('authors').parse('ada');
    const authorTarget: 'authors' = author.intlRelationTarget;
    assert.deepEqual(author, { intlRelationTarget: 'authors', id: 'ada' });
    assert.equal(authorTarget, 'authors');

    const source = relationSchema('sources').parse('astro');
    const sourceTarget: 'sources' = source.intlRelationTarget;
    assert.deepEqual(source, { intlRelationTarget: 'sources', id: 'astro' });
    assert.equal(sourceTarget, 'sources');
  });

  it('parses a localized map with every configured locale', () => {
    const { localized } = createIntlSchema(
      defineIntl({ locales: ['en', 'fr'], defaultLocale: 'en' }),
    );
    const field = localized(slug).parse({ en: 'Editor', fr: 'Rédacteur' });
    assert.deepEqual(field, { en: 'Editor', fr: 'Rédacteur' });
  });

  it('reads one locale from a localized map', () => {
    const { localized } = createIntlSchema(
      defineIntl({ locales: ['en', 'fr'], defaultLocale: 'en' }),
    );
    const field = localized(slug).parse({ en: 'Editor', fr: 'Rédacteur' });
    assert.equal(localizedValue(field, 'fr'), 'Rédacteur');
  });

  it('throws when a localized field omits the locale', () => {
    assert.throws(() => localizedValue({ en: 'Editor' }, 'de'), {
      message: '@repo/astro-intl: localized field missing locale "de".',
    });
  });

  it('resolves a translated target in the locale passed to getRelated', async () => {
    const intl = relationsIntl(linkedCollections());
    assert.deepEqual(await intl.getRelated('en', relation('authors', 'ada')), {
      id: 'ada-en',
      collection: 'authors',
      data: { id: 'ada', locale: 'en', name: 'Ada' },
    });
    assert.deepEqual(await intl.getRelated('de', relation('authors', 'ada')), {
      id: 'ada-de',
      collection: 'authors',
      data: { id: 'ada', locale: 'de', name: 'Ada DE' },
    });
  });

  it('resolves a translated target a {slug} row routes', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'tags/{slug}', de: 'schlagwort/{slug}' },
            view: 'tag',
            collection: 'tags',
          },
        ],
        collections: { translated: ['tags'] },
      }),
      {
        loaders: collectionLoaders({
          tags: [collectionEntry('tags', 'astro-en', { id: 'astro', locale: 'en', slug: 'astro' })],
        }),
      },
    );
    assert.deepEqual(await intl.getRelated('en', relation('tags', 'astro')), {
      id: 'astro-en',
      collection: 'tags',
      data: { id: 'astro', locale: 'en', slug: 'astro' },
    });
  });

  it('resolves a translated target an entry row publishes at a written tail', async () => {
    // The {slug} row requires a slug. The entry row publishes `featured` and does not use it.
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: 'blog',
          },
          {
            slug: { en: 'featured', de: 'hervorgehoben' },
            view: 'featured',
            collection: { name: 'blog', entry: 'pin' },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [collectionEntry('blog', 'pin-en', { id: 'pin', locale: 'en', slug: 'pin-slug' })],
        }),
      },
    );
    assert.deepEqual(await intl.getRelated('en', relation('blog', 'pin')), {
      id: 'pin-en',
      collection: 'blog',
      data: { id: 'pin', locale: 'en', slug: 'pin-slug' },
    });
  });

  it("resolves a translated target in the entry's locale when the locale field is renamed", async () => {
    const intl = createIntl(
      intlConfig({
        collections: {
          translated: ['blog', 'authors'],
          fields: { blog: { locale: 'lang' } },
        },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'hello-en', {
              id: 'hello-world',
              lang: 'en',
              author: relation('authors', 'ada'),
            }),
          ],
          authors: [collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' })],
        }),
      },
    );
    assert.deepEqual(await intl.getRelated('en', relation('authors', 'ada')), {
      id: 'ada-en',
      collection: 'authors',
      data: { id: 'ada', locale: 'en', name: 'Ada' },
    });
  });

  it('loads an entry whose data holds null and undefined fields', async () => {
    const intl = createIntl(
      intlConfig({
        collections: { translated: ['blog', 'authors'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'hello-en', {
              id: 'hello-world',
              locale: 'en',
              author: relation('authors', 'ada'),
              note: null,
              extra: undefined,
            }),
          ],
          authors: [collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' })],
        }),
      },
    );
    assert.deepEqual(await intl.getRelated('en', relation('authors', 'ada')), {
      id: 'ada-en',
      collection: 'authors',
      data: { id: 'ada', locale: 'en', name: 'Ada' },
    });
  });

  it('resolves an untranslated target by collection entry id and ignores the locale', async () => {
    const intl = relationsIntl(linkedCollections());
    const entry = {
      id: 'astro',
      collection: 'sources',
      data: { name: 'Astro' },
    };
    assert.deepEqual(await intl.getRelated('en', relation('sources', 'astro')), entry);
    assert.deepEqual(await intl.getRelated('de', relation('sources', 'astro')), entry);
  });

  it('returns a localized field unchanged for localizedValue to read', async () => {
    const intl = relationsIntl(linkedCollections());
    const role = await intl.getRelated('de', relation('roles', 'editor'));
    assert.deepEqual(role, {
      id: 'editor',
      collection: 'roles',
      data: { name: { en: 'Editor', de: 'Redakteur' } },
    });
    // Entry data is untyped here, so the locale map is read as a record.
    const name = role.data.name as Record<string, string>;
    assert.equal(localizedValue(name, 'de'), 'Redakteur');
  });

  it('fails when an untranslated collection entry id is missing', async () => {
    const collections = linkedCollections();
    collections.sources = [];
    const intl = relationsIntl(collections);
    await assert.rejects(() => intl.getRelated('de', relation('sources', 'astro')), {
      message: '@repo/astro-intl: relation sources/astro is missing (blog:hello-en).',
    });
  });

  it('requires the collection entry id for an untranslated target', async () => {
    const collections = linkedCollections();
    collections.sources = [
      collectionEntry('sources', 'file-astro', { id: 'astro', name: 'Astro' }),
    ];
    const intl = relationsIntl(collections);
    await assert.rejects(() => intl.getRelated('de', relation('sources', 'astro')), {
      message: '@repo/astro-intl: relation sources/astro is missing (blog:hello-en).',
    });
  });

  it('ignores a field that is not { intlRelationTarget, id }', async () => {
    const loaded: string[] = [];
    const intl = relationsIntl(
      {
        blog: [
          collectionEntry('blog', 'hello-en', {
            id: 'hello-world',
            locale: 'en',
            slug: 'hello-world',
            author: relation('authors', 'ada'),
            lookalike: { target: 'ghost', id: 'nope' },
          }),
        ],
        authors: [collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' })],
        sources: [collectionEntry('sources', 'astro', { name: 'Astro' })],
        roles: [collectionEntry('roles', 'editor', { name: { en: 'Editor', de: 'Redakteur' } })],
      },
      loaded,
    );
    assert.deepEqual(await intl.getRelated('en', relation('authors', 'ada')), {
      id: 'ada-en',
      collection: 'authors',
      data: { id: 'ada', locale: 'en', name: 'Ada' },
    });
    assert.equal(loaded.includes('ghost'), false);
  });
});
