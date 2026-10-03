import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import { intlHooks } from '../astro.ts';
import {
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
} from '../fixtures.ts';

/** Validation error `createIntl` throws. Each cause is one prettified issue, arrow line included. */
function failed(...causes: string[]): string {
  const body = causes.map((cause) => `✖ ${cause}`).join('\n');
  return `@repo/astro-intl: intl config failed validation.\n${body}`;
}

function refuses(config: IntlConfigInput, message: string, label?: string): void {
  assert.throws(() => createIntl(config), { message }, label ?? message);
}

/** A config that parses. `createIntl` validates when it is called. */
function parses(config: IntlConfigInput): void {
  assert.ok(createIntl(config));
}

const pageSlug = { en: 'blog/{page}', de: 'artikel/{page}' };

/** Blog listing whose later pages use `slug`. Page 1 is `blog` / `artikel`. */
function listing(slug: { en: string; de: string } = pageSlug, pageSize = 10): IntlConfigInput {
  return intlConfig({
    routes: [
      {
        slug: { en: 'blog', de: 'artikel' },
        view: 'x',
        collection: 'blog',
        pagination: { pageSize, slug },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

describe('refuses to boot', () => {
  describe('intl config', () => {
    it('refuses an intl config that fails validation', () => {
      refuses(
        {
          locales: ['en'],
          defaultLocale: 'en',
          routing: { prefixDefaultLocale: 'no' },
        } as unknown as IntlConfigInput,
        failed(
          'Invalid input: expected boolean, received string\n  → at routing.prefixDefaultLocale',
        ),
      );
    });

    it('aborts startup when the intl config does not survive a JSON round trip', async (t) => {
      const hooks = await intlHooks(t, {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: () => true },
      } as unknown as IntlConfigInput);
      const error = hooks.error;
      assert.equal(hooks.integration, undefined);
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        '@repo/astro-intl: intl config does not survive a JSON round trip at "routing.prefixDefaultLocale".',
      );
    });

    it('does not abort startup when an intl config key is undefined', async (t) => {
      const hooks = await intlHooks(t, {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: undefined },
      });
      await hooks.setup();
      assert.equal(hooks.error, undefined);
      assert.deepEqual(hooks.updates, [
        {
          i18n: {
            defaultLocale: 'en',
            locales: ['en'],
            routing: {
              prefixDefaultLocale: false,
              redirectToDefaultLocale: false,
              fallbackType: 'redirect',
            },
          },
        },
      ]);
    });

    it('accepts viewRendering build and request and refuses anything else', () => {
      const base = {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
      } satisfies IntlConfigInput;
      parses(base);
      parses({ ...base, viewRendering: 'build' });
      parses({ ...base, viewRendering: 'request' });
      refuses(
        { ...base, viewRendering: 'live' } as unknown as IntlConfigInput,
        failed('Invalid option: expected one of "build"|"request"\n  → at viewRendering'),
      );
    });

    it('accepts field name overrides on a translated collection', async () => {
      const intl = createIntl(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'pages',
            },
          ],
          collections: {
            translated: ['pages'],
            fields: { pages: { id: 'uid', locale: 'lang', slug: 'path' } },
          },
        }),
        {
          loaders: collectionLoaders({
            pages: [
              collectionEntry('pages', 'home-en', { uid: 'home', lang: 'en', path: 'home' }),
              collectionEntry('pages', 'home-de', { uid: 'home', lang: 'de', path: 'start' }),
            ],
          }),
        },
      );
      assert.deepEqual(await intl.getPairedSlugs(), [
        { locale: 'de', slug: 'artikel/start' },
        { locale: 'en', slug: 'blog/home' },
      ]);
    });

    it('refuses an empty field name', () => {
      const rows = [
        ['id', 'collections.fields.pages.id'],
        ['locale', 'collections.fields.pages.locale'],
        ['slug', 'collections.fields.pages.slug'],
      ] as const;
      for (const [key, path] of rows) {
        refuses(
          {
            locales: ['en'],
            defaultLocale: 'en',
            collections: { translated: ['pages'], fields: { pages: { [key]: '' } } },
          },
          failed(`Too small: expected string to have >=1 characters\n  → at ${path}`),
          key,
        );
      }
    });

    it('refuses a collection name used as a key of collections', () => {
      refuses(
        {
          locales: ['en'],
          defaultLocale: 'en',
          collections: { pages: { id: 'uid' } },
        } as unknown as IntlConfigInput,
        failed('Unrecognized key: "pages"\n  → at collections'),
      );
    });

    it('refuses a top-level entryId and a field named entryId', () => {
      refuses(
        {
          locales: ['en', 'de'],
          defaultLocale: 'en',
          routing: { prefixDefaultLocale: true },
          entryId: 'collectionFolder',
        } as unknown as IntlConfigInput,
        failed('Unrecognized key: "entryId"'),
      );
      refuses(
        {
          locales: ['en', 'de'],
          defaultLocale: 'en',
          routing: { prefixDefaultLocale: true },
          collections: {
            translated: ['pages'],
            fields: { pages: { entryId: 'frontmatter' } },
          },
        } as unknown as IntlConfigInput,
        failed('Unrecognized key: "entryId"\n  → at collections.fields.pages'),
      );
    });

    it('a collection name repeats, or sits in both translated and untranslated', () => {
      refuses(
        intlConfig({ collections: { translated: ['posts', 'posts', 'posts'] } }),
        failed('collections.translated lists "posts" more than once'),
      );
      refuses(
        intlConfig({ collections: { untranslated: ['roles', 'roles'] } }),
        failed('collections.untranslated lists "roles" more than once'),
      );
      refuses(
        intlConfig({
          collections: { translated: ['authors'], untranslated: ['authors'] },
        }),
        failed('"authors" is in both collections.translated and collections.untranslated'),
      );
    });

    it('a fields key is not in translated', () => {
      refuses(
        intlConfig({
          collections: {
            translated: ['posts'],
            untranslated: ['sources'],
            fields: { sources: { id: 'uid' } },
          },
        }),
        failed('collections.fields key "sources" is not in collections.translated'),
      );
    });
  });

  describe('route rows', () => {
    it('a route row names a collection that is not in translated', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'pages',
            },
          ],
          collections: { untranslated: ['pages'] },
        }),
        failed('collection "pages" is not in collections.translated'),
      );
    });

    it('allows a {slug} row on a translated collection', () => {
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'pages',
            },
          ],
          collections: { translated: ['pages'] },
        }),
      );
    });

    it('normalizes a collection string and { name, entry } to the flat pair', async () => {
      const blog = [
        collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
        collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
      ];
      const slug = { en: 'blog', de: 'artikel' };

      async function paths(collection: 'blog' | { name: 'blog'; entry?: string }) {
        const intl = createIntl(
          intlConfig({
            routes: [{ slug, view: 'x', collection }],
            collections: { translated: ['blog'] },
          }),
          { loaders: collectionLoaders({ blog }) },
        );
        return intl.staticPaths('/en/blog/[...index]');
      }

      const tail = {
        params: { index: undefined },
        props: {
          locale: 'en',
          route: { slug, view: 'x', collection: 'blog' },
          path: 'blog',
          entry: undefined,
        },
      };
      assert.deepEqual(await paths('blog'), [tail]);
      assert.deepEqual(await paths({ name: 'blog' }), [tail]);
      assert.deepEqual(await paths({ name: 'blog', entry: 'hello' }), [
        {
          params: { index: undefined },
          props: {
            locale: 'en',
            route: { slug, view: 'x', collection: 'blog', entry: 'hello' },
            path: 'blog',
            entry: blog[0],
          },
        },
      ]);
    });

    it('refuses a collection value that is not a name or { name, entry }', () => {
      const slug = { en: 'blog', de: 'artikel' };
      const base = {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        collections: { translated: ['blog'] },
      };
      refuses(
        {
          ...base,
          routes: [{ slug, view: 'x', collection: 'blog', entry: 'hello' }],
        } as unknown as IntlConfigInput,
        failed('Unrecognized key: "entry"\n  → at routes[0]'),
      );
      const atCollection = failed('Invalid input\n  → at routes[0].collection');
      refuses(
        {
          ...base,
          routes: [{ slug, view: 'x', collection: { entry: 'hello' } }],
        } as unknown as IntlConfigInput,
        atCollection,
      );
      refuses(
        {
          ...base,
          routes: [{ slug, view: 'x', collection: {} }],
        } as unknown as IntlConfigInput,
        atCollection,
      );
    });

    it('allows an entry row beside a {slug} row', () => {
      // The pairing id is `collection.entry`. A sibling `entry` key is not a row field.
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'blog',
              fallbackView: 'missing',
            },
            {
              slug: { en: 'hello', de: 'hallo' },
              view: 'x',
              collection: { name: 'blog', entry: 'hello' },
            },
          ],
          collections: { translated: ['blog'] },
        }),
      );
    });

    it('{page} is in the row slug', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{page}', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('{page} belongs in pagination.slug in locale "en"'),
      );
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{page}', de: 'artikel/{page}' },
              collection: 'blog',
              view: 'blog',
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed(
          '{page} belongs in pagination.slug in locale "en"',
          '{page} belongs in pagination.slug in locale "de"',
        ),
      );
    });

    it('pagination is on a row with no collection, an entry, or a {slug} row', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              pagination: { pageSize: 10, slug: pageSlug },
            },
          ],
        }),
        failed('pagination requires a collection'),
      );
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: { name: 'blog', entry: 'hello' },
              pagination: { pageSize: 10, slug: pageSlug },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pagination cannot name an entry'),
      );
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pagination cannot sit on a {slug} row'),
      );
    });

    it('allows pagination beside one {slug} row', () => {
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug },
            },
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'blog',
            },
          ],
          collections: { translated: ['blog'] },
        }),
      );
    });

    it('allows two pagination rows on one collection', () => {
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'a',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug },
            },
            {
              slug: { en: 'news', de: 'neu' },
              view: 'b',
              collection: 'blog',
              pagination: { pageSize: 5, slug: { en: 'news/{page}', de: 'neu/{page}' } },
            },
          ],
          collections: { translated: ['blog'] },
        }),
      );
    });

    it('pagination.slug and the row slug name different locales', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: {
                pageSize: 10,
                slug: { en: 'blog/{page}', de: 'artikel/{page}', fr: 'journal/{page}' },
              },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pagination.slug and slug name different locales (de, en vs de, en, fr)'),
      );
    });

    it('pagination.slug is not a {page} tail', () => {
      for (const slug of ['blog/{page}/more', 'blog/x{page}', '{page}/blog', 'pre{page}']) {
        refuses(
          listing({ en: slug, de: 'artikel/{page}' }),
          failed('{page} must be one whole final segment in locale "en"'),
          slug,
        );
      }
      refuses(
        listing({ en: 'blog/{slug}/{page}', de: 'artikel/{page}' }),
        failed('a tail cannot hold both {page} and {slug} in locale "en"'),
      );
    });

    it('allows a root listing and a pagination tail with its own segment', () => {
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: '/', de: '/' },
              view: 'home',
              collection: 'posts',
              pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
            },
          ],
          collections: { translated: ['posts'] },
        }),
      );
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: {
                pageSize: 10,
                slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
              },
            },
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'x',
              collection: 'blog',
            },
          ],
          collections: { translated: ['blog'] },
        }),
      );
    });

    it('pagination.pageSize is not a positive integer', () => {
      for (const pageSize of [0, 1.5]) {
        refuses(
          listing(pageSlug, pageSize),
          failed('pagination.pageSize must be a positive integer'),
          String(pageSize),
        );
      }
    });

    it('a top-level pageSize', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pageSize: 10,
            } as unknown as NonNullable<IntlConfigInput['routes']>[number],
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pageSize moved to pagination.pageSize\n  → at routes[0].pageSize'),
      );
    });

    it('pagination.view names the wrong locales', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: {
                pageSize: 10,
                slug: pageSlug,
                view: { en: 'archive' },
              },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pagination.view keys must be the configured locales (de, en)'),
      );
    });

    it('a row sets fallbackView without {slug}', () => {
      const about = { slug: { en: 'about', de: 'ueber' }, view: 'about' };
      refuses(
        intlConfig({ routes: [{ ...about, fallbackView: 'missing' }] }),
        failed('fallbackView needs a {slug} row'),
      );
      refuses(
        intlConfig({ routes: [{ ...about, fallbackView: false }] }),
        failed('fallbackView needs a {slug} row'),
      );
    });

    it('allows fallbackView false on a {slug} row, and a config fallbackView with no {slug} row', () => {
      parses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'post',
              collection: 'blog',
              fallbackView: false,
            },
          ],
          collections: { translated: ['blog'] },
        }),
      );
      parses(
        intlConfig({
          fallbackView: 'missing',
          routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
        }),
      );
    });

    it('refuses a row fallbackView of true', () => {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'post',
              collection: 'blog',
              fallbackView: true,
            } as unknown as NonNullable<IntlConfigInput['routes']>[number],
          ],
          collections: { translated: ['blog'] },
        }),
        failed('Invalid input\n  → at routes[0].fallbackView'),
      );
    });

    it('refuses a view name that includes a file extension or is not a path', () => {
      const home = { slug: { en: '/', de: '/' } };
      refuses(
        intlConfig({ routes: [{ ...home, view: 'home.astro' }] }),
        failed('view "home.astro" includes a file extension'),
      );
      refuses(
        intlConfig({ routes: [{ ...home, view: 'blog/../post' }] }),
        failed('view "blog/../post" is not a path'),
      );
      refuses(
        intlConfig({ routes: [{ ...home, view: 'blog//post' }] }),
        failed('view "blog//post" is not a path'),
      );
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: {
                pageSize: 10,
                slug: pageSlug,
                view: 'archive.astro',
              },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('pagination.view "archive.astro" includes a file extension'),
      );
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
              view: 'post',
              collection: 'blog',
              fallbackView: 'missing.astro',
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('view "missing.astro" includes a file extension'),
      );
      refuses(
        intlConfig({
          fallbackView: 'missing.astro',
          routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
        }),
        failed('view "missing.astro" includes a file extension'),
      );
    });

    it('refuses view keys that are not the configured locales', () => {
      refuses(
        intlConfig({
          routes: [{ slug: { en: '/', de: '/' }, view: { en: 'home', fr: 'accueil' } }],
        }),
        failed('view keys must be the configured locales (de, en)'),
      );
    });

    it('refuses a route slug that omits a locale', () => {
      refuses(
        intlConfig({
          routes: [{ slug: { en: 'blog/{slug}' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        failed('route collection "blog" slug missing locale "de"'),
      );
    });

    it('refuses a {slug} token that is not the final segment', () => {
      for (const slug of ['{slug}', '/{slug}', 'blog/{slug}/more']) {
        refuses(
          intlConfig({
            routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
            collections: { translated: ['blog'] },
          }),
          failed(
            'route collection "blog" slug for locale "en" must use {slug} as the final segment',
          ),
          slug,
        );
      }
    });

    it('refuses a {slug} pattern with no collection', () => {
      refuses(
        intlConfig({
          routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x' }],
        }),
        failed('{slug} pattern has no collection', '{slug} pattern has no collection'),
      );
    });

    it('refuses two pattern rows for one collection', () => {
      refuses(
        intlConfig({
          routes: [
            { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
            {
              slug: { en: 'news/{slug}', de: 'neuigkeiten/{slug}' },
              view: 'x',
              collection: 'blog',
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed('two pattern rows name collection "blog"'),
      );
    });

    it('refuses a repeated section in one locale', () => {
      // de names artikel and schlagworte. Only the repeated en section is refused.
      refuses(
        intlConfig({
          routes: [
            { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
            {
              slug: { en: 'blog/{slug}', de: 'schlagworte/{slug}' },
              view: 'x',
              collection: 'tags',
            },
          ],
          collections: { translated: ['blog', 'tags'] },
        }),
        failed('duplicate section "blog" for locale "en"'),
      );
    });
  });
});
