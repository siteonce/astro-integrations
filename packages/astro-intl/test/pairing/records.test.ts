import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  relation,
} from '../fixtures.ts';

function bind(config: IntlConfigInput, collections: Record<string, readonly CollectionEntry[]>) {
  return createIntl(config, { loaders: collectionLoaders(collections) });
}

describe('records', () => {
  it('keeps a translated collection with no entry URL as records', async () => {
    const adaEn = collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' });
    const adaDe = collectionEntry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada' });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'blog',
            collection: { name: 'pages', entry: 'blog' },
          },
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['pages', 'blog', 'authors'] },
      }),
      {
        pages: [
          collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
          collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
          collectionEntry('pages', 'blog-en', { id: 'blog', locale: 'en' }),
          collectionEntry('pages', 'blog-de', { id: 'blog', locale: 'de' }),
        ],
        blog: [
          collectionEntry('blog', 'hello-en', {
            id: 'hello-world',
            locale: 'en',
            slug: 'hello-world',
          }),
          collectionEntry('blog', 'hello-de', {
            id: 'hello-world',
            locale: 'de',
            slug: 'hallo-welt',
          }),
          collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
        ],
        authors: [adaEn, adaDe],
      },
    );

    assert.equal(await intl.getRelated('en', relation('authors', 'ada')), adaEn);
    assert.equal(await intl.getRelated('de', relation('authors', 'ada')), adaDe);
    assert.deepEqual(await intl.getAlternatePaths('authors/ada'), {});
    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('authors', 'ada')), undefined);
    assert.equal(await intl.getRelativeEntryUrl('de', relation('authors', 'ada')), undefined);
    assert.equal(await intl.getContentByPath('en', 'authors/ada'), undefined);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: '/' },
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: '/' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
  });

  it('keeps unnamed entries as records and publishes a named entry at the written tail', async () => {
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
      { notes: [aboutEn, aboutDe, otherEn] },
    );

    assert.deepEqual(await intl.getAlternatePaths('notes/about'), { en: 'about', de: 'ueber' });
    assert.equal(await intl.getContentByPath('en', 'about'), aboutEn);
    assert.equal(await intl.getContentByPath('de', 'ueber'), aboutDe);
    assert.equal(await intl.getContentByPath('en', 'ignored'), undefined);
    assert.equal(await intl.getRelated('en', relation('notes', 'other')), otherEn);
    assert.deepEqual(await intl.getAlternatePaths('notes/other'), {});
    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('notes', 'other')), undefined);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'ueber' },
      { locale: 'en', slug: 'about' },
    ]);
  });
});
