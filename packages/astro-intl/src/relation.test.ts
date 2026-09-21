import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { defineIntl } from './define-intl.ts';
import { type CollectionEntryLike, pairCollections } from './pairing.ts';
import {
  assertRelations,
  collectRelations,
  localized,
  localizedValue,
  relation,
  resolveRelation,
} from './relation.ts';

const locales = ['en', 'de'] as const;

function entry(
  collection: string,
  astroId: string,
  data: Record<string, unknown>,
  filePath?: string,
): CollectionEntryLike {
  return { id: astroId, collection, data, filePath };
}

describe('relation schema', () => {
  it('parses a pairing id into { collection, id }', () => {
    const schema = z.object({ author: relation('authors') });
    assert.deepEqual(schema.parse({ author: 'demo' }), {
      author: { collection: 'authors', id: 'demo' },
    });
  });

  it('rejects an empty pairing id', () => {
    assert.throws(() => relation('authors').parse(''));
  });
});

describe('localized', () => {
  const schema = localized(z.string().min(1), locales);

  it('requires every locale key', () => {
    assert.deepEqual(schema.parse({ en: 'Editor', de: 'Redakteur' }), {
      en: 'Editor',
      de: 'Redakteur',
    });
    assert.equal(schema.safeParse({ en: 'Editor' }).success, false);
  });

  it('rejects an extra locale key', () => {
    assert.equal(
      schema.safeParse({ en: 'Editor', de: 'Redakteur', fr: 'Rédacteur' }).success,
      false,
    );
  });

  it('reads one locale from a parsed map', () => {
    const field = schema.parse({ en: 'Editor', de: 'Redakteur' });
    assert.equal(localizedValue(field, 'de'), 'Redakteur');
  });
});

describe('collectRelations', () => {
  it('finds parsed relation objects and skips other maps', () => {
    const found = collectRelations({
      author: { collection: 'authors', id: 'demo' },
      name: { en: 'Editor', de: 'Redakteur' },
      tags: ['announcements'],
    });
    assert.deepEqual(found, [{ collection: 'authors', id: 'demo' }]);
  });
});

describe('assertRelations / resolveRelation', () => {
  const config = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    collections: {
      blog: { slugField: 'slug' },
      authors: {},
    },
  });

  const authors = [
    entry('authors', 'demo/en', { id: 'demo', locale: 'en', name: 'Demo Author' }),
    entry('authors', 'demo/de', { id: 'demo', locale: 'de', name: 'Demo-Autor' }),
  ];
  const clients = [entry('clients', 'acme', { name: 'Acme', url: 'https://acme.example' })];
  const roles = [entry('roles', 'editor', { name: { en: 'Editor', de: 'Redakteur' } })];
  const blog = [
    entry('blog', 'hello-world/en', {
      id: 'hello-world',
      locale: 'en',
      slug: 'blog/hello-world',
      author: { collection: 'authors', id: 'demo' },
      client: { collection: 'clients', id: 'acme' },
      role: { collection: 'roles', id: 'editor' },
    }),
    entry('blog', 'hello-world/de', {
      id: 'hello-world',
      locale: 'de',
      slug: 'artikel/hallo-welt',
      author: { collection: 'authors', id: 'demo' },
      client: { collection: 'clients', id: 'acme' },
      role: { collection: 'roles', id: 'editor' },
    }),
  ];

  function paired(collections: Record<string, CollectionEntryLike[]>) {
    return pairCollections(config, {
      blog: collections.blog ?? [],
      authors: collections.authors ?? [],
    });
  }

  it('accepts listed records, locale-free files, and inline-map files', () => {
    const collections = { blog, authors, clients, roles };
    const pairing = paired(collections);
    assert.doesNotThrow(() =>
      assertRelations({
        locales: config.locales,
        listed: config.collections ?? {},
        pairing,
        collections,
      }),
    );
    assert.equal(
      resolveRelation(
        'de',
        { collection: 'authors', id: 'demo' },
        {
          listed: config.collections ?? {},
          pairing,
          collections,
        },
      ).data.name,
      'Demo-Autor',
    );
    assert.equal(
      resolveRelation(
        'de',
        { collection: 'clients', id: 'acme' },
        {
          listed: config.collections ?? {},
          pairing,
          collections,
        },
      ).id,
      'acme',
    );
  });

  it('fails when a listed sibling is missing in the source locale', () => {
    const collections = {
      blog,
      authors: [authors[0]],
      clients,
      roles,
    };
    const pairing = paired(collections);
    assert.throws(
      () =>
        assertRelations({
          locales: config.locales,
          listed: config.collections ?? {},
          pairing,
          collections,
        }),
      /relation authors\/demo is missing locale "de"/,
    );
  });

  it('fails when a locale-free id is missing', () => {
    const collections = { blog, authors, clients: [], roles };
    const pairing = paired(collections);
    assert.throws(
      () =>
        assertRelations({
          locales: config.locales,
          listed: config.collections ?? {},
          pairing,
          collections,
        }),
      /relation clients\/acme is missing/,
    );
  });
});
