import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import {
  collectionEntry,
  collectionLoaders,
  intlConfig,
  relation,
  warningsFrom,
} from '../fixtures.ts';

describe('entry rows', { concurrency: 1 }, () => {
  it('publishes a named entry at the written tail', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      {
        loaders: collectionLoaders({
          pages: [
            collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
            collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
          ],
        }),
      },
    );

    const home = await intl.staticPaths('/en/[...index]');
    assert.equal(home.length, 1);
    assert.equal(home[0]?.props.path, '/');
    assert.equal(home[0]?.props.entry?.id, 'home-en');
    const homeDe = await intl.staticPaths('/de/[...index]');
    assert.equal(homeDe[0]?.props.entry?.id, 'home-de');
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/', de: '/' });
  });

  it('keeps the same pairing id in another collection as a record', async () => {
    const author = collectionEntry('authors', 'home-author', {
      id: 'home',
      locale: 'en',
      name: 'Home',
    });
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages', 'authors'] },
      }),
      {
        loaders: collectionLoaders({
          pages: [
            collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
            collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
          ],
          authors: [author],
        }),
      },
    );

    assert.equal(await intl.getRelated('en', relation('authors', 'home')), author);
    assert.deepEqual(await intl.getAlternatePaths('authors/home'), {});
    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('authors', 'home')), undefined);
  });

  it('warns when a named entry is missing in the default locale and publishes no path for that gap', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      {
        loaders: collectionLoaders({
          pages: [collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' })],
        }),
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, [
      '@repo/astro-intl: default-locale sibling missing for entryId "pages/home" (defaultLocale "en").',
    ]);
    assert.deepEqual(await intl.staticPaths('/en/[...index]'), []);
    const homeDe = await intl.staticPaths('/de/[...index]');
    assert.equal(homeDe.length, 1);
    assert.equal(homeDe[0]?.props.path, '/');
    assert.equal(homeDe[0]?.props.entry?.id, 'home-de');
    assert.equal(await intl.getContentByPath('en', '/'), undefined);
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { de: '/' });
    assert.deepEqual(await intl.getPairedSlugs(), [{ locale: 'de', slug: '/' }]);
  });

  it('warns when a named entry matches no locale and publishes no path', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      { loaders: collectionLoaders({ pages: [] }) },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, [
      '@repo/astro-intl: default-locale sibling missing for entryId "pages/home" (defaultLocale "en").',
    ]);
    assert.deepEqual(await intl.staticPaths('/en/[...index]'), []);
    assert.deepEqual(await intl.staticPaths('/de/[...index]'), []);
    assert.equal(await intl.getContentByPath('en', '/'), undefined);
    assert.equal(await intl.getContentByPath('de', '/'), undefined);
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), {});
    assert.deepEqual(await intl.getPairedSlugs(), []);
  });

  it('omits a missing non-default locale on a named entry without a warning', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'blog',
            collection: { name: 'pages', entry: 'blog' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      {
        loaders: collectionLoaders({
          pages: [collectionEntry('pages', 'blog-en', { id: 'blog', locale: 'en' })],
        }),
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, []);
    const blog = await intl.staticPaths('/en/blog/[...index]');
    assert.equal(blog.length, 1);
    assert.equal(blog[0]?.props.path, 'blog');
    assert.equal(blog[0]?.props.entry?.id, 'blog-en');
    assert.deepEqual(await intl.staticPaths('/de/artikel/[...index]'), []);
    assert.equal(await intl.getContentByPath('de', 'artikel'), undefined);
    assert.deepEqual(await intl.getAlternatePaths('pages/blog'), { en: 'blog' });
    assert.deepEqual(await intl.getPairedSlugs(), [{ locale: 'en', slug: 'blog' }]);
  });

  it('warns when a {slug} row names an entry no locale has', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: { name: 'blog', entry: 'ghost' },
          },
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
        ],
        collections: { translated: ['blog', 'pages'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [],
          pages: [
            collectionEntry('pages', 'about-en', { id: 'about', locale: 'en' }),
            collectionEntry('pages', 'about-de', { id: 'about', locale: 'de' }),
          ],
        }),
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, [
      '@repo/astro-intl: default-locale sibling missing for entryId "blog/ghost" (defaultLocale "en").',
    ]);
    assert.deepEqual(await intl.getAlternatePaths('blog/ghost'), {});
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'ueber' },
      { locale: 'en', slug: 'about' },
    ]);
  });

  it('warns nothing when a {slug} row names an entry that exists', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: { name: 'blog', entry: 'hello' },
          },
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
        ],
        collections: { translated: ['blog', 'pages'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
            collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
          ],
          pages: [
            collectionEntry('pages', 'about-en', { id: 'about', locale: 'en' }),
            collectionEntry('pages', 'about-de', { id: 'about', locale: 'de' }),
          ],
        }),
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, []);
    assert.deepEqual(await intl.getAlternatePaths('blog/hello'), {
      en: 'blog/hello',
      de: 'artikel/hallo',
    });
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel/hallo' },
      { locale: 'de', slug: 'ueber' },
      { locale: 'en', slug: 'about' },
      { locale: 'en', slug: 'blog/hello' },
    ]);
  });

  it('warns nothing for a listing row', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'index',
            collection: 'blog',
          },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en' }),
            collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de' }),
          ],
        }),
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, []);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'en', slug: 'blog' },
    ]);
  });
});
