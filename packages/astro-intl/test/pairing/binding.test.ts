import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import {
  absoluteLocaleUrl,
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  relativeLocaleUrl,
} from '../fixtures.ts';

const paired = {
  translated: ['blog', 'authors'],
  untranslated: ['sources', 'roles'],
};

describe('createIntl binding', () => {
  it('gives each config its own paths', async () => {
    const blog = [
      collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
      collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
    ];
    const loaders = collectionLoaders({ blog });
    const posts = createIntl(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: paired,
      }),
      { loaders },
    );
    const news = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'news/{slug}', de: 'nachrichten/{slug}' },
            view: 'post',
            collection: 'blog',
          },
        ],
        collections: paired,
      }),
      { loaders },
    );

    assert.deepEqual(await posts.getAlternatePaths('blog/hello'), {
      en: 'blog/hello',
      de: 'artikel/hallo',
    });
    assert.deepEqual(await news.getAlternatePaths('blog/hello'), {
      en: 'news/hello',
      de: 'nachrichten/hallo',
    });
  });

  it('loads only the collections the config lists', async () => {
    const blog = [
      collectionEntry('blog', 'x-en', { id: 'x', locale: 'en', slug: 'x' }),
      collectionEntry('blog', 'x-de', { id: 'x', locale: 'de', slug: 'x-de' }),
    ];
    const cases: {
      label: string;
      input: IntlConfigInput;
      entries: Readonly<Record<string, readonly CollectionEntry[]>>;
      names: readonly string[];
    }[] = [
      {
        label: 'no untranslated',
        input: intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'post',
              collection: 'blog',
            },
          ],
          collections: { translated: ['blog'] },
        }),
        entries: { blog },
        names: ['blog'],
      },
      {
        label: 'no collections',
        input: intlConfig({
          routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
        }),
        entries: {},
        names: [],
      },
    ];

    for (const { label, input, entries, names } of cases) {
      const loaded: string[] = [];
      const intl = createIntl(input, { loaders: collectionLoaders(entries, { loaded }) });
      await intl.getPairedSlugs();
      assert.deepEqual(loaded, names, label);
    }
  });

  it('loads each collection once across concurrent first calls', async () => {
    const blog = [
      collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
      collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
    ];
    let calls = 0;
    const intl = createIntl(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        // blog, authors, sources, roles — four collection reads, one load.
        collections: paired,
      }),
      {
        loaders: {
          async getCollection(name) {
            calls += 1;
            return name === 'blog' ? blog : [];
          },
          getAbsoluteLocaleUrl: absoluteLocaleUrl,
          getRelativeLocaleUrl: relativeLocaleUrl,
        },
      },
    );

    await Promise.all([intl.getPairedSlugs(), intl.getSitemapEntries()]);
    assert.equal(calls, 4);
  });

  it('looks up a sibling by collection/id and by public path', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
          {
            slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
            view: 'tag',
            collection: 'tags',
          },
        ],
        collections: { translated: ['blog', 'tags'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'hello-world/en', {
              id: 'hello-world',
              locale: 'en',
              slug: 'hello-world',
            }),
            collectionEntry('blog', 'hello-world/de', {
              id: 'hello-world',
              locale: 'de',
              slug: 'hallo-welt',
            }),
          ],
          tags: [
            collectionEntry('tags', 'announcements/en', {
              id: 'announcements',
              locale: 'en',
              slug: 'announcements',
            }),
            collectionEntry('tags', 'announcements/de', {
              id: 'announcements',
              locale: 'de',
              slug: 'ankuendigungen',
            }),
          ],
        }),
      },
    );

    assert.equal((await intl.getContentByPath('en', 'blog/hello-world'))?.id, 'hello-world/en');
    assert.equal(
      (await intl.getContentByPath('de', 'schlagworte/ankuendigungen'))?.id,
      'announcements/de',
    );
    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(await intl.getAlternatePaths('tags/announcements'), {
      en: 'tags/announcements',
      de: 'schlagworte/ankuendigungen',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('de', 'artikel/hallo-welt'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'missing'), {});
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'de', slug: 'schlagworte/ankuendigungen' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'tags/announcements' },
    ]);

    const sitemap = await intl.getSitemapEntries();
    const helloEn = sitemap.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    assert.deepEqual(helloEn, {
      locale: 'en',
      path: 'blog/hello-world',
      loc: 'https://example.com/en/blog/hello-world',
      alternates: {
        en: 'https://example.com/en/blog/hello-world',
        de: 'https://example.com/de/artikel/hallo-welt',
      },
      entryId: 'blog/hello-world',
      xDefault: 'https://example.com/en/blog/hello-world',
    });
  });
});
