import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl, createIntlSchema, defineIntl, localizedValue, slug } from '@repo/astro-intl';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
  relation,
} from './fixtures.ts';

/**
 * Blog posts, authors, sources, and roles for `getRelated`.
 * Posts store a translated author, an untranslated source, and an untranslated role.
 */
function linkedCollections(): Record<string, CollectionEntry[]> {
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
    // `slug` is the exported non-empty string schema. `localized` wraps that value.
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
    // The register is not injected here, so the entry's data fields are unknown.
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
