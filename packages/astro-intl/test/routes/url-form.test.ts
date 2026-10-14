import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import { type IntlSetupOptions, intlHooks } from '../astro.ts';
import {
  absoluteLocaleUrl,
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  intlConfig,
  relation,
  relativeLocaleUrl,
} from '../fixtures.ts';

type UrlCall = { locale: string; path: string | undefined };

/**
 * Blog `hello`: en slug `hello`, de slug `hallo`.
 * Blog `only`: en slug `only`, no German sibling.
 * Notes `one`: pairing id field `key`, en slug `one`, de slug `eins`.
 * Pages `home` in both locales. Authors `ada` is English only.
 * `sources` is untranslated and empty.
 */
function entryCollections(): Record<string, CollectionEntry[]> {
  return {
    blog: [
      collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
      collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
      collectionEntry('blog', 'only-en', { id: 'only', locale: 'en', slug: 'only' }),
    ],
    notes: [
      collectionEntry('notes', 'one-en', { key: 'one', locale: 'en', slug: 'one' }),
      collectionEntry('notes', 'one-de', { key: 'one', locale: 'de', slug: 'eins' }),
    ],
    pages: [
      collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
      collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
    ],
    authors: [collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en' })],
    sources: [],
  };
}

function open() {
  const relativeCalls: UrlCall[] = [];
  const absoluteCalls: UrlCall[] = [];
  const intl = createIntl(
    intlConfig({
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        { slug: { en: 'notes/{slug}', de: 'notizen/{slug}' }, view: 'note', collection: 'notes' },
        { slug: { en: '/', de: '/' }, view: 'home', collection: { name: 'pages', entry: 'home' } },
      ],
      collections: {
        translated: ['blog', 'notes', 'pages', 'authors'],
        untranslated: ['sources'],
        fields: { notes: { id: 'key' } },
      },
    }),
    {
      loaders: collectionLoaders(entryCollections(), {
        strict: true,
        relative: (locale, path) => {
          relativeCalls.push({ locale, path });
          return relativeLocaleUrl(locale, path);
        },
        absolute: (locale, path) => {
          absoluteCalls.push({ locale, path });
          return absoluteLocaleUrl(locale, path);
        },
      }),
    },
  );
  return { intl, relativeCalls, absoluteCalls };
}

async function startupLog(
  t: TestContext,
  trailingSlash: IntlSetupOptions['trailingSlash'],
  buildFormat: IntlSetupOptions['buildFormat'],
) {
  const hooks = await intlHooks(t, intlConfig());
  await hooks.setup({ trailingSlash, buildFormat });
  return hooks.log;
}

describe('url form', () => {
  it('warns at startup when trailingSlash and build.format disagree', async (t) => {
    assert.deepEqual(await startupLog(t, 'never', 'directory'), [
      {
        level: 'warn',
        message:
          'trailingSlash "never" writes pages as folders (build.format "directory"), and many hosts add the slash back. Set build.format to "file".',
      },
    ]);
    assert.deepEqual(await startupLog(t, 'always', 'file'), [
      {
        level: 'warn',
        message:
          'trailingSlash "always" links to "/path/", but build.format "file" writes "/path.html". Set build.format to "directory".',
      },
    ]);
  });

  it('does not warn when trailingSlash and build.format agree', async (t) => {
    assert.deepEqual(await startupLog(t, 'always', 'directory'), []);
    assert.deepEqual(await startupLog(t, 'ignore', 'file'), []);
    assert.deepEqual(await startupLog(t, 'never', 'preserve'), []);
  });

  it('returns the relative url of a translated routed relation', async () => {
    const { intl, relativeCalls } = open();
    assert.equal(
      await intl.getRelativeEntryUrl('de', relation('blog', 'hello')),
      '/de/artikel/hallo/',
    );
    assert.deepEqual(relativeCalls, [{ locale: 'de', path: 'artikel/hallo' }]);
  });

  it('returns the relative url of an entry', async () => {
    const { intl } = open();
    assert.equal(
      await intl.getRelativeEntryUrl(
        'en',
        collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
      ),
      '/en/blog/hello/',
    );
  });

  it('returns the relative url when the pairing id field is renamed', async () => {
    const { intl } = open();
    assert.equal(
      await intl.getRelativeEntryUrl(
        'de',
        collectionEntry('notes', 'one-de', { key: 'one', locale: 'de', slug: 'eins' }),
      ),
      '/de/notizen/eins/',
    );
  });

  it('returns undefined when that locale publishes no url', async () => {
    const { intl, relativeCalls } = open();
    assert.equal(await intl.getRelativeEntryUrl('de', relation('blog', 'only')), undefined);
    assert.deepEqual(relativeCalls, []);
  });

  it('returns undefined for a record', async () => {
    const { intl, relativeCalls } = open();
    assert.equal(await intl.getRelativeEntryUrl('en', relation('authors', 'ada')), undefined);
    assert.deepEqual(relativeCalls, []);
  });

  it('throws when the collection is not translated', async () => {
    const { intl } = open();
    const sources = '@repo/astro-intl: collection "sources" is not in collections.translated.';
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', relation('sources', 'astro')),
      { message: sources },
      'untranslated relation',
    );
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', collectionEntry('sources', 'astro', { id: 'astro' })),
      { message: sources },
      'untranslated entry',
    );
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', relation('ghost', 'x')),
      { message: '@repo/astro-intl: collection "ghost" is not in collections.translated.' },
      'unknown collection',
    );
  });

  it('throws when the entry has no collection', async () => {
    const { intl } = open();
    await assert.rejects(() => intl.getRelativeEntryUrl('en', { id: 'x', data: { id: 'hello' } }), {
      message: '@repo/astro-intl: entry has no collection.',
    });
  });

  it('passes an empty path for the home tail', async () => {
    const { intl, relativeCalls } = open();
    assert.equal(await intl.getRelativeEntryUrl('en', relation('pages', 'home')), '/en/');
    assert.deepEqual(relativeCalls, [{ locale: 'en', path: '' }]);
  });

  it('builds an absolute url through getAbsoluteLocaleUrl', async () => {
    const { intl, relativeCalls, absoluteCalls } = open();
    assert.equal(
      await intl.getAbsoluteEntryUrl('en', relation('blog', 'hello')),
      'https://example.com/en/blog/hello',
    );
    assert.deepEqual(absoluteCalls, [{ locale: 'en', path: 'blog/hello' }]);
    assert.deepEqual(relativeCalls, []);
  });

  it('omits href when a sibling is missing', async () => {
    const { intl } = open();
    assert.deepEqual(await intl.localeSwitcherLinks('en', 'blog/only'), [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: false },
    ]);
  });

  it('omits href on the current locale and links another locale to its sibling', async () => {
    const { intl } = open();
    const links = await intl.localeSwitcherLinks('en', 'blog/hello');
    assert.deepEqual(links, [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: true, href: '/de/artikel/hallo/' },
    ]);
    assert.equal(links[0]?.href, undefined);
  });

  it('reports no siblings for an unknown path', async () => {
    const { intl, relativeCalls } = open();
    assert.deepEqual(await intl.localeSwitcherLinks('en', 'missing'), [
      { locale: 'en', current: true, sibling: false },
      { locale: 'de', current: false, sibling: false },
    ]);
    assert.deepEqual(relativeCalls, []);
  });

  it('links each other locale to its home url', async () => {
    const { intl, relativeCalls } = open();
    assert.deepEqual(await intl.localeSwitcherLinks('en', '/'), [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: true, href: '/de/' },
    ]);
    assert.deepEqual(await intl.localeSwitcherLinks('de', '/'), [
      { locale: 'en', current: false, sibling: true, href: '/en/' },
      { locale: 'de', current: true, sibling: true },
    ]);
    assert.deepEqual(relativeCalls, [
      { locale: 'de', path: '' },
      { locale: 'en', path: '' },
    ]);
  });
});
