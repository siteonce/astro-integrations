import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { localized, localizedValue, relation } from './relation.ts';

const locales = ['en', 'de'] as const;

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
