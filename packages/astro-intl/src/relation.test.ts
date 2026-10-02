import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { collectRelations, localized, localizedValue, relation } from './relation.ts';

const locales = ['en', 'de'] as const;

describe('relation schema', () => {
  it('parses a pairing id into { intlRelationTarget, id }', () => {
    const schema = z.object({ author: relation('authors') });
    assert.deepEqual(schema.parse({ author: 'demo' }), {
      author: { intlRelationTarget: 'authors', id: 'demo' },
    });
  });

  it('rejects an empty pairing id', () => {
    assert.throws(() => relation('authors').parse(''));
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
