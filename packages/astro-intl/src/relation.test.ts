import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { defineIntl } from './define-intl.ts';
import {
  collectRelations,
  localized,
  localizedValue,
  recordedRelationNames,
  relation,
} from './relation.ts';
import { setIntlConfig } from './runtime.ts';

function emptyRecordedRelations(): void {
  const recorded = (globalThis as Record<symbol, Set<string> | undefined>)[
    Symbol.for('@repo/astro-intl/related-targets')
  ];
  recorded?.clear();
}

const locales = ['en', 'de'] as const;

describe('relation schema', () => {
  it('parses a pairing id into { target, id }', () => {
    const schema = z.object({ author: relation('authors') });
    assert.deepEqual(schema.parse({ author: 'demo' }), {
      author: { target: 'authors', id: 'demo' },
    });
  });

  it('rejects an empty pairing id', () => {
    assert.throws(() => relation('authors').parse(''));
  });
});

describe('collectRelations', () => {
  it('finds relations from collections.untranslated when nothing was recorded', () => {
    emptyRecordedRelations();
    assert.deepEqual(recordedRelationNames(), []);
    setIntlConfig(
      defineIntl({
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        collections: { untranslated: ['authors'] },
      }),
    );
    try {
      assert.deepEqual(collectRelations({ author: { target: 'authors', id: 'ada' } }), [
        { target: 'authors', id: 'ada' },
      ]);
    } finally {
      setIntlConfig(undefined);
    }
  });

  it('ignores a { target, id } whose target neither list names', () => {
    setIntlConfig(
      defineIntl({
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        collections: { translated: ['authors'] },
      }),
    );
    try {
      assert.deepEqual(
        collectRelations({
          author: { target: 'authors', id: 'ada' },
          lookalike: { target: 'ghost', id: 'nope' },
        }),
        [{ target: 'authors', id: 'ada' }],
      );
    } finally {
      setIntlConfig(undefined);
    }
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
