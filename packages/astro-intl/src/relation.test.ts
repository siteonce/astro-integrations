import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { defineIntl } from './define-intl.ts';
import { collectRelations, createIntlSchema, localizedValue } from './relation.ts';

const config = defineIntl({
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  collections: {
    translated: ['authors', 'tags'],
    untranslated: ['sources'],
  },
});
const { relation, localized } = createIntlSchema(config);

describe('relation schema', () => {
  it('parses a pairing id into { intlRelationTarget, id }', () => {
    const schema = z.object({ author: relation('authors'), source: relation('sources') });
    assert.deepEqual(schema.parse({ author: 'demo', source: 'astro' }), {
      author: { intlRelationTarget: 'authors', id: 'demo' },
      source: { intlRelationTarget: 'sources', id: 'astro' },
    });
  });

  it('rejects an empty pairing id', () => {
    assert.throws(() => relation('authors').parse(''));
  });

  it('throws when the name is in neither list', () => {
    assert.throws(
      () => {
        // @ts-expect-error relation name is not in the config lists
        return relation('ghost');
      },
      {
        message:
          '@repo/astro-intl: relation("ghost") is in neither collections.translated nor collections.untranslated.',
      },
    );
  });
});

describe('collectRelations', () => {
  it('collects objects whose keys are exactly intlRelationTarget and id', () => {
    assert.deepEqual(
      collectRelations({
        author: { intlRelationTarget: 'authors', id: 'ada' },
        unlisted: { intlRelationTarget: 'ghost', id: 'nope' },
        lookalike: { target: 'ghost', id: 'nope' },
      }),
      [
        { intlRelationTarget: 'authors', id: 'ada' },
        { intlRelationTarget: 'ghost', id: 'nope' },
      ],
    );
  });
});

describe('localized', () => {
  const schema = localized(z.string().min(1));

  it('requires every locale key from the config', () => {
    assert.deepEqual(schema.parse({ en: 'Editor', fr: 'Rédacteur' }), {
      en: 'Editor',
      fr: 'Rédacteur',
    });
    assert.equal(schema.safeParse({ en: 'Editor' }).success, false);
  });

  it('rejects an extra locale key', () => {
    assert.equal(
      schema.safeParse({ en: 'Editor', fr: 'Rédacteur', de: 'Redakteur' }).success,
      false,
    );
  });

  it('reads one locale from a parsed map', () => {
    const field = schema.parse({ en: 'Editor', fr: 'Rédacteur' });
    assert.equal(localizedValue(field, 'fr'), 'Rédacteur');
  });
});
