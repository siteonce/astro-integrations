import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
  relation,
} from '../fixtures.ts';

function pagesBlog() {
  return {
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
  };
}

function site(collections: {
  pages: CollectionEntry[];
  blog: CollectionEntry[];
  authors?: CollectionEntry[];
}) {
  return createIntl(
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
    { loaders: collectionLoaders(collections) },
  );
}

/** Warnings from the first load. Later calls reuse that load and do not warn again. */
async function warningsFrom(load: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown) => {
    lines.push(String(message));
  };
  try {
    await load();
    return lines;
  } finally {
    console.warn = original;
  }
}

describe('entry rows', { concurrency: 1 }, () => {
  it('publishes a named entry only inside its collection', async () => {
    const collections = pagesBlog();
    const author = collectionEntry('authors', 'home-author', {
      id: 'home',
      locale: 'en',
      name: 'Home',
    });
    const intl = site({ ...collections, authors: [author] });

    const home = await intl.staticPaths('/en/[...index]');
    assert.equal(home.length, 1);
    assert.equal(home[0]?.props.path, '/');
    assert.equal(home[0]?.props.entry?.id, 'home-en');
    const homeDe = await intl.staticPaths('/de/[...index]');
    assert.equal(homeDe[0]?.props.entry?.id, 'home-de');
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/', de: '/' });
    assert.equal(await intl.getRelated('en', relation('authors', 'home')), author);
    assert.deepEqual(await intl.getAlternatePaths('authors/home'), {});
    assert.equal(await intl.getAbsoluteEntryUrl('en', relation('authors', 'home')), undefined);
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

  it('warns when a named entry is missing in the default locale and publishes no path for that gap', async () => {
    const collections = pagesBlog();
    const intl = site({
      ...collections,
      pages: collections.pages.filter(
        (item) => !(item.data.id === 'home' && item.data.locale === 'en'),
      ),
      authors: [],
    });

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
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: '/' },
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
  });

  it('warns when a named entry matches no locale and publishes no path', async () => {
    const collections = pagesBlog();
    const intl = site({
      ...collections,
      pages: collections.pages.filter((item) => item.data.id !== 'home'),
      authors: [],
    });

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, [
      '@repo/astro-intl: default-locale sibling missing for entryId "pages/home" (defaultLocale "en").',
    ]);
    assert.deepEqual(await intl.staticPaths('/en/[...index]'), []);
    assert.deepEqual(await intl.staticPaths('/de/[...index]'), []);
    assert.equal(await intl.getContentByPath('en', '/'), undefined);
    assert.equal(await intl.getContentByPath('de', '/'), undefined);
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), {});
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
  });

  it('omits a missing non-default locale on a named entry without a warning', async () => {
    const collections = pagesBlog();
    const intl = site({
      ...collections,
      pages: collections.pages.filter(
        (item) => !(item.data.id === 'blog' && item.data.locale === 'de'),
      ),
      authors: [],
    });

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, []);
    const blog = await intl.staticPaths('/en/blog/[...index]');
    assert.equal(blog.length, 1);
    assert.equal(blog[0]?.props.path, 'blog');
    assert.equal(blog[0]?.props.entry?.id, 'blog-en');
    assert.deepEqual(await intl.staticPaths('/de/artikel/[...index]'), []);
    assert.equal(await intl.getContentByPath('de', 'artikel'), undefined);
    assert.deepEqual(await intl.getAlternatePaths('pages/blog'), { en: 'blog' });
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: '/' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: '/' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
  });
});
