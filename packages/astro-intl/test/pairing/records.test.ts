import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@siteonce/astro-intl';
import {
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  relation,
} from '../fixtures.ts';

function bind(
  config: IntlConfigInput,
  collections: Record<string, readonly ReturnType<typeof collectionEntry>[]>,
) {
  return createIntl(config, { loaders: collectionLoaders(collections) });
}

/** `ada` in en (`ada-en`, name Ada) and de (`ada-de`, name Ada). No route names the collection. */
function authors() {
  return [
    collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
    collectionEntry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada' }),
  ];
}

describe('records', () => {
  it('resolves a record in each locale', async () => {
    const [adaEn, adaDe] = authors();
    const intl = bind(intlConfig({ collections: { translated: ['authors'] } }), {
      authors: [adaEn, adaDe],
    });

    assert.equal(await intl.getRelated('en', relation('authors', 'ada')), adaEn);
    assert.equal(await intl.getRelated('de', relation('authors', 'ada')), adaDe);
  });

  it('publishes no alternate for a record', async () => {
    const intl = bind(intlConfig({ collections: { translated: ['authors'] } }), {
      authors: authors(),
    });

    assert.deepEqual(await intl.getAlternatePaths('authors/ada'), {});
  });

  it('returns no entry URL for a record', async () => {
    const intl = bind(intlConfig({ collections: { translated: ['authors'] } }), {
      authors: authors(),
    });

    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('authors', 'ada')), undefined);
    assert.equal(await intl.getRelativeEntryUrl('de', relation('authors', 'ada')), undefined);
  });

  it('does not find a record by public path', async () => {
    const intl = bind(intlConfig({ collections: { translated: ['authors'] } }), {
      authors: authors(),
    });

    assert.equal(await intl.getContentByPath('en', 'authors/ada'), undefined);
  });

  it('publishes no slug for a record', async () => {
    const intl = bind(
      intlConfig({
        routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
        collections: { translated: ['authors'] },
      }),
      { authors: authors() },
    );

    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'ueber' },
      { locale: 'en', slug: 'about' },
    ]);
  });

  it('publishes the entry a route names at the written tail', async () => {
    const aboutEn = collectionEntry('notes', 'about-en', {
      id: 'about',
      locale: 'en',
      path: 'ignored',
    });
    const aboutDe = collectionEntry('notes', 'about-de', {
      id: 'about',
      locale: 'de',
      path: 'ignored',
    });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'notes', entry: 'about' },
          },
        ],
        collections: {
          translated: ['notes'],
          fields: { notes: { slug: 'path' } },
        },
      }),
      { notes: [aboutEn, aboutDe] },
    );

    assert.deepEqual(await intl.getAlternatePaths('notes/about'), { en: 'about', de: 'ueber' });
    assert.equal(await intl.getContentByPath('en', 'about'), aboutEn);
    assert.equal(await intl.getContentByPath('de', 'ueber'), aboutDe);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'ueber' },
      { locale: 'en', slug: 'about' },
    ]);
  });

  it("leaves a named entry's slug unused", async () => {
    const aboutEn = collectionEntry('notes', 'about-en', {
      id: 'about',
      locale: 'en',
      path: 'ignored',
    });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'notes', entry: 'about' },
          },
        ],
        collections: {
          translated: ['notes'],
          fields: { notes: { slug: 'path' } },
        },
      }),
      {
        notes: [
          aboutEn,
          collectionEntry('notes', 'about-de', { id: 'about', locale: 'de', path: 'ignored' }),
        ],
      },
    );

    assert.equal(await intl.getContentByPath('en', 'about'), aboutEn);
    assert.equal(await intl.getContentByPath('en', 'ignored'), undefined);
  });

  it('keeps an unnamed entry as a record', async () => {
    const otherEn = collectionEntry('notes', 'other-en', {
      id: 'other',
      locale: 'en',
      path: 'other',
    });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'notes', entry: 'about' },
          },
        ],
        collections: {
          translated: ['notes'],
          fields: { notes: { slug: 'path' } },
        },
      }),
      {
        notes: [
          collectionEntry('notes', 'about-en', { id: 'about', locale: 'en', path: 'ignored' }),
          collectionEntry('notes', 'about-de', { id: 'about', locale: 'de', path: 'ignored' }),
          otherEn,
        ],
      },
    );

    assert.equal(await intl.getRelated('en', relation('notes', 'other')), otherEn);
    assert.deepEqual(await intl.getAlternatePaths('notes/other'), {});
    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('notes', 'other')), undefined);
  });
});
