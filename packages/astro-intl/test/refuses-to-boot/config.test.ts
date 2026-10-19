import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { createIntl } from '@siteonce/astro-intl';
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
  return `@siteonce/astro-intl: intl config failed validation.\n${body}`;
}

function refuses(config: IntlConfigInput, message: string, label?: string): void {
  assert.throws(() => createIntl(config), { message }, label ?? message);
}

const validationPrefix = '@siteonce/astro-intl: intl config failed validation.';

/** Prefix, issue count, each `→ at` path, and any key the config names. */
function refusesAt(
  config: IntlConfigInput,
  issues: readonly { at?: string; key?: string }[],
  label?: string,
): void {
  assert.throws(
    () => createIntl(config),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const lines = error.message.split('\n');
      assert.equal(lines[0], validationPrefix, label);
      assert.equal(lines.filter((line) => line.startsWith('✖ ')).length, issues.length, label);
      assert.deepEqual(
        lines.flatMap((line) => (line.startsWith('  → at ') ? [line.slice('  → at '.length)] : [])),
        issues.flatMap((issue) => (issue.at === undefined ? [] : [issue.at])),
        label,
      );
      for (const issue of issues) {
        if (issue.key !== undefined) assert.ok(error.message.includes(`"${issue.key}"`), label);
      }
      return true;
    },
    label,
  );
}

/** A config that parses. `createIntl` validates when it is called. */
function parses(config: IntlConfigInput): void {
  assert.doesNotThrow(() => createIntl(config));
}

/**
 * `astroIntl` refuses when `config` does not survive a JSON round trip.
 * `path` is the key JSON changed, and the assert label.
 */
async function refusesJson(t: TestContext, config: IntlConfigInput, path: string): Promise<void> {
  const hooks = await intlHooks(t, config);
  assert.equal(hooks.integration, undefined, path);
  const error = hooks.error;
  assert.ok(error instanceof Error, path);
  assert.equal(
    error.message,
    `@siteonce/astro-intl: intl config does not survive a JSON round trip at "${path}".`,
    path,
  );
}

const pageSlug = { en: 'blog/{page}', de: 'artikel/{page}' };

/**
 * Blog listing. Page 1 is `blog` / `artikel`, view `x`, collection `blog`.
 * Later pages use `slug`. `pageSize` defaults to 10.
 */
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

describe("The intl config holds a value JSON can't carry (a function, a `Date`, a `Map`), because intl writes the config into the sitemap data route as JSON. A key set to `undefined` is allowed.", () => {
  it('refuses when the config holds a function, a Date, or a Map', async (t) => {
    await refusesJson(
      t,
      {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: () => true },
      } as unknown as IntlConfigInput,
      'routing.prefixDefaultLocale',
    );
    await refusesJson(
      t,
      {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: { toJSON: () => ['x'] } },
      } as unknown as IntlConfigInput,
      'routing.prefixDefaultLocale',
    );
    await refusesJson(
      t,
      {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        routes: [
          { slug: { en: 'about', de: 'ueber' }, view: 'about' },
          { slug: { en: new Date(), de: 'artikel' }, view: 'blog' },
        ],
      } as unknown as IntlConfigInput,
      'routes.1.slug.en',
    );
    await refusesJson(
      t,
      {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        fallbackView: new Map(),
      } as unknown as IntlConfigInput,
      'fallbackView',
    );
    await refusesJson(
      t,
      {
        locales: ['en', () => 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
      } as unknown as IntlConfigInput,
      'locales.1',
    );
  });

  it('boots when a key is undefined', async (t) => {
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
});

describe('The keys of one view per locale are not the configured locales.', () => {
  it('refuses when view keys are not the configured locales', () => {
    refuses(
      intlConfig({
        routes: [{ slug: { en: '/', de: '/' }, view: { en: 'home', fr: 'accueil' } }],
      }),
      failed('view keys must be the configured locales (de, en)'),
    );
  });

  it('boots when the view keys are the configured locales', () => {
    parses(
      intlConfig({
        routes: [{ slug: { en: '/', de: '/' }, view: { en: 'home', de: 'heim' } }],
      }),
    );
  });
});

describe('A `view`, `pagination.view`, or `fallbackView` name ends in `.astro`, or has a segment that is empty, `.`, or `..`.', () => {
  it('refuses when a view name ends in .astro', () => {
    const cases: { label: string; config: IntlConfigInput; message: string }[] = [
      {
        label: 'view',
        config: intlConfig({ routes: [{ slug: { en: '/', de: '/' }, view: 'home.astro' }] }),
        message: 'view "home.astro" includes a file extension',
      },
      {
        label: 'view per locale',
        config: intlConfig({
          routes: [{ slug: { en: 'about', de: 'ueber' }, view: { en: 'post.astro', de: 'post' } }],
        }),
        message: 'view "post.astro" includes a file extension',
      },
      {
        label: 'pagination.view',
        config: intlConfig({
          routes: [
            {
              slug: { en: 'blog', de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug, view: 'archive.astro' },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        message: 'pagination.view "archive.astro" includes a file extension',
      },
      {
        label: 'row fallbackView',
        config: intlConfig({
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
        message: 'view "missing.astro" includes a file extension',
      },
      {
        label: 'config fallbackView',
        config: intlConfig({
          fallbackView: 'missing.astro',
          routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
        }),
        message: 'view "missing.astro" includes a file extension',
      },
    ];
    for (const { label, config, message } of cases) {
      refuses(config, failed(message), label);
    }
  });

  it('refuses when a view segment is empty, ., or ..', () => {
    const cases = [
      ['blog/../post', 'view "blog/../post" is not a path'],
      ['blog//post', 'view "blog//post" is not a path'],
      ['blog/./post', 'view "blog/./post" is not a path'],
    ] as const;
    for (const [view, message] of cases) {
      refuses(
        intlConfig({ routes: [{ slug: { en: '/', de: '/' }, view }] }),
        failed(message),
        view,
      );
    }
  });

  it('boots when the view name is a path', () => {
    parses(intlConfig({ routes: [{ slug: { en: '/', de: '/' }, view: 'blog/post' }] }));
    parses(
      intlConfig({
        routes: [{ slug: { en: 'about', de: 'ueber' }, view: { en: 'post', de: 'beitrag' } }],
      }),
    );
  });
});

describe('A row sets `fallbackView` to `true`, or sets a view or `false` without `{slug}`.', () => {
  it('refuses when a row without {slug} sets a view or false', () => {
    const about = { slug: { en: 'about', de: 'ueber' }, view: 'about' };
    for (const fallbackView of ['missing', false] as const) {
      refuses(
        intlConfig({ routes: [{ ...about, fallbackView }] }),
        failed('fallbackView needs a {slug} row'),
        String(fallbackView),
      );
    }
  });

  it('refuses when a row sets fallbackView to true', () => {
    refusesAt(
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
      [{ at: 'routes[0].fallbackView' }],
    );
  });

  it('boots when a {slug} row sets fallbackView to false', () => {
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
  });

  it('boots when fallbackView is set on the config and no row has {slug}', () => {
    parses(
      intlConfig({
        fallbackView: 'missing',
        routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
      }),
    );
  });
});

describe('A row’s `slug` omits a configured locale.', () => {
  it('refuses when a row slug omits a locale', () => {
    const cases: { label: string; config: IntlConfigInput; message: string }[] = [
      {
        label: '{slug} row',
        config: intlConfig({
          routes: [{ slug: { en: 'blog/{slug}' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        message: 'route collection "blog" slug missing locale "de"',
      },
      {
        label: 'static row',
        config: intlConfig({
          routes: [{ slug: { en: 'about' }, view: 'about' }],
        }),
        message: 'route with no collection slug missing locale "de"',
      },
      {
        label: 'listing row',
        config: intlConfig({
          routes: [{ slug: { en: 'blog' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        message: 'route collection "blog" slug missing locale "de"',
      },
    ];
    for (const { label, config, message } of cases) {
      refuses(config, failed(message), label);
    }
  });

  it('boots when every locale has a slug', () => {
    parses(intlConfig({ routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }] }));
    parses(
      intlConfig({
        routes: [{ slug: { en: 'blog', de: 'artikel' }, view: 'x', collection: 'blog' }],
        collections: { translated: ['blog'] },
      }),
    );
    parses(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
    );
  });
});

describe("A row `slug` is `''`. `/` is the home.", () => {
  it('refuses when a row slug is empty', () => {
    refuses(
      intlConfig({
        routes: [{ slug: { en: '', de: 'about' }, view: 'about' }],
      }),
      failed('route with no collection slug for locale "en" is not a fixed tail'),
      'no collection',
    );
    refuses(
      intlConfig({
        routes: [{ slug: { en: '', de: 'blog' }, view: 'x', collection: 'blog' }],
        collections: { translated: ['blog'] },
      }),
      failed('route collection "blog" slug for locale "en" is not a fixed tail'),
      'collection',
    );
  });

  it('boots when the row slug is /', () => {
    parses(intlConfig({ routes: [{ slug: { en: '/', de: '/' }, view: 'home' }] }));
  });
});

describe('`{page}` is in the row’s `slug`. It belongs in `pagination.slug`.', () => {
  it('refuses when {page} is in the row slug', () => {
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
      'with pagination',
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
      'without pagination',
    );
  });

  it('boots when {page} is only in pagination.slug', () => {
    parses(listing());
  });
});

describe('`{slug}` is not the whole final segment of a row’s `slug`, or no section sits in front of it, or `{slug}` is repeated, or a section segment contains `{`.', () => {
  it('refuses when {slug} is not the whole final segment', () => {
    for (const slug of ['{slug}', 'blog/{slug}/more', 'blog{slug}']) {
      refuses(
        intlConfig({
          routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        failed('route collection "blog" slug for locale "en" must use {slug} as the final segment'),
        slug,
      );
    }
  });

  it('refuses when a section segment holds {', () => {
    for (const slug of ['blog/{x}/{slug}', 'a/{b}/{slug}', 'a/{slug}/{slug}']) {
      refuses(
        intlConfig({
          routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        failed('route collection "blog" slug for locale "en" must use {slug} as the final segment'),
        slug,
      );
    }
  });

  it('boots when {slug} is the whole final segment', () => {
    parses(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
    );
  });
});

describe('A row `slug` or a `pagination.slug` has an empty segment, or a leading or trailing `/`. `/` alone is the home.', () => {
  it('refuses when a row slug has an empty segment or a leading or trailing /', () => {
    for (const [slug, message] of [
      [
        'blog//{slug}',
        'route collection "blog" slug "blog//{slug}" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
      [
        '/blog/{slug}',
        'route collection "blog" slug "/blog/{slug}" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'blog/{slug}/',
        'route collection "blog" slug "blog/{slug}/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        '/{slug}',
        'route collection "blog" slug "/{slug}" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'a//b/{slug}',
        'route collection "blog" slug "a//b/{slug}" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
    ] as const) {
      refuses(
        intlConfig({
          routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
          collections: { translated: ['blog'] },
        }),
        failed(message),
        slug,
      );
    }
    for (const [slug, message] of [
      [
        'about/',
        'route with no collection slug "about/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        '/about',
        'route with no collection slug "/about" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'a//b',
        'route with no collection slug "a//b" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
    ] as const) {
      refuses(
        intlConfig({
          routes: [{ slug: { en: slug, de: 'ueber' }, view: 'x' }],
        }),
        failed(message),
        slug,
      );
    }
    for (const [slug, message] of [
      [
        '/blog/',
        'route collection "blog" slug "/blog/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'blog/',
        'route collection "blog" slug "blog/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'blog//news',
        'route collection "blog" slug "blog//news" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
    ] as const) {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: slug, de: 'artikel' },
              view: 'x',
              collection: 'blog',
              pagination: { pageSize: 10, slug: pageSlug },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed(message),
        `listing ${slug}`,
      );
    }
    for (const [slug, message] of [
      [
        '/blog/',
        'route collection "blog" entry "hello" slug "/blog/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'blog/',
        'route collection "blog" entry "hello" slug "blog/" for locale "en" starts or ends with "/". Remove it; "/" alone is the home.',
      ],
      [
        'blog//news',
        'route collection "blog" entry "hello" slug "blog//news" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
    ] as const) {
      refuses(
        intlConfig({
          routes: [
            {
              slug: { en: slug, de: 'hallo' },
              view: 'x',
              collection: { name: 'blog', entry: 'hello' },
            },
          ],
          collections: { translated: ['blog'] },
        }),
        failed(message),
        `entry ${slug}`,
      );
    }
  });

  it('refuses when pagination.slug has an empty segment or a leading or trailing /', () => {
    for (const [slug, message] of [
      [
        '/blog/{page}',
        'pagination.slug "/blog/{page}" for locale "en" starts or ends with "/". Remove it.',
      ],
      [
        'blog/{page}/',
        'pagination.slug "blog/{page}/" for locale "en" starts or ends with "/". Remove it.',
      ],
      [
        'blog//{page}',
        'pagination.slug "blog//{page}" for locale "en" has an empty segment. Remove the doubled "/".',
      ],
    ] as const) {
      refuses(listing({ en: slug, de: 'artikel/{page}' }), failed(message), slug);
    }
  });

  it('boots when the row slug is /', () => {
    parses(intlConfig({ routes: [{ slug: { en: '/', de: '/' }, view: 'home' }] }));
  });

  it('boots when a root listing pagination.slug is {page}', () => {
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
  });
});

describe('A `{slug}` row names no collection.', () => {
  it('refuses when a {slug} row names no collection', () => {
    refuses(
      intlConfig({
        routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x' }],
      }),
      failed('{slug} pattern has no collection', '{slug} pattern has no collection'),
    );
  });

  it('boots when the {slug} row names a collection', () => {
    parses(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
    );
  });
});

describe('Two `{slug}` rows name one collection.', () => {
  it('refuses when two {slug} rows name one collection', () => {
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

  it('boots when an entry row sits beside the {slug} row', () => {
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

  it('boots when two pagination rows name one collection', () => {
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
});

describe('Two entry rows name one entry.', () => {
  it('refuses when two entry rows name one entry', () => {
    refuses(
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
          {
            slug: { en: 'info', de: 'info' },
            view: 'info',
            collection: { name: 'pages', entry: 'about' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      failed('entry "about" repeats in collection "pages"'),
    );
  });

  it('boots when two entry rows name different entries', () => {
    parses(
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
          {
            slug: { en: 'info', de: 'info' },
            view: 'info',
            collection: { name: 'pages', entry: 'info' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
    );
  });
});

describe('Two `{slug}` rows share a section in one locale.', () => {
  it('refuses when two {slug} rows share a section in one locale', () => {
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

  it('boots when each section is unique in its locale', () => {
    parses(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
          {
            slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
            view: 'x',
            collection: 'tags',
          },
        ],
        collections: { translated: ['blog', 'tags'] },
      }),
    );
  });
});

describe('`pagination` is on a row with no collection, a row that names an entry, or a row whose `slug` holds `{slug}`.', () => {
  it('refuses when pagination has no collection', () => {
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
  });

  it('refuses when pagination names an entry', () => {
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
  });

  it('refuses when pagination is on a {slug} row', () => {
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

  it('boots when pagination is on a listing row beside one {slug} row', () => {
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
});

describe('`pagination.slug` and the row’s `slug` name different locales.', () => {
  it('refuses when pagination.slug names a locale the row does not', () => {
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

  it('boots when pagination.slug names the same locales', () => {
    parses(listing());
  });
});

describe('`pagination.slug` is not a `{page}` tail: not the whole final segment, or beside `{slug}`.', () => {
  it('refuses when {page} is not one whole final segment', () => {
    for (const slug of [
      'blog/{page}/more',
      'blog/x{page}',
      '{page}/blog',
      'pre{page}',
      'blog/{page}/{page}',
      'blog/{x}/{page}',
    ]) {
      refuses(
        listing({ en: slug, de: 'artikel/{page}' }),
        failed('{page} must be one whole final segment in locale "en"'),
        slug,
      );
    }
  });

  it('refuses when the tail also holds {slug}', () => {
    refuses(
      listing({ en: 'blog/{slug}/{page}', de: 'artikel/{page}' }),
      failed('a tail cannot hold both {page} and {slug} in locale "en"'),
    );
  });

  it('boots when the listing is at / and the tail is {page}', () => {
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
  });

  it('boots when the pagination tail has its own segment', () => {
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
});

describe('`pagination.pageSize` is not a positive integer.', () => {
  it('refuses when pageSize is not a positive integer', () => {
    for (const pageSize of [0, 1.5]) {
      refuses(
        listing(pageSlug, pageSize),
        failed('pagination.pageSize must be a positive integer'),
        String(pageSize),
      );
    }
  });

  it('boots when pageSize is a positive integer', () => {
    parses(listing());
  });
});

describe('`pagination.view` names a missing file, both a file and a folder index, or the wrong locales.', () => {
  it('refuses when pagination.view omits a locale', () => {
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

  it('boots when pagination.view names each configured locale', () => {
    parses(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'x',
            collection: 'blog',
            pagination: {
              pageSize: 10,
              slug: pageSlug,
              view: { en: 'archive', de: 'archiv' },
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
    );
  });
});

describe('A top-level `pageSize`.', () => {
  it('refuses when a row sets pageSize', () => {
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

  it('boots when pageSize is on pagination', () => {
    parses(listing());
  });
});

describe("`viewRendering` is set to something other than `'build'` or `'request'`.", () => {
  const base = {
    locales: ['en'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
  } satisfies IntlConfigInput;

  it('refuses when viewRendering is not build or request', () => {
    refusesAt({ ...base, viewRendering: 'live' } as unknown as IntlConfigInput, [
      { at: 'viewRendering' },
    ]);
  });

  it('boots when viewRendering is build, request, or omitted', () => {
    parses(base);
    parses({ ...base, viewRendering: 'build' });
    parses({ ...base, viewRendering: 'request' });
  });
});

describe('A `locales` value repeats.', () => {
  it('refuses when a locales value repeats', () => {
    refuses(intlConfig({ locales: ['en', 'en'] }), failed('locales values must be unique'));
  });

  it('boots when locales are unique', () => {
    parses(intlConfig({ locales: ['en', 'de'] }));
  });
});

describe('A collection name repeats, or sits in both `translated` and `untranslated`.', () => {
  it('refuses when a collection name repeats or sits in both lists', () => {
    refuses(
      intlConfig({ collections: { translated: ['posts', 'posts', 'posts'] } }),
      failed('collections.translated lists "posts" more than once'),
      'translated',
    );
    refuses(
      intlConfig({ collections: { untranslated: ['roles', 'roles'] } }),
      failed('collections.untranslated lists "roles" more than once'),
      'untranslated',
    );
    refuses(
      intlConfig({
        collections: { translated: ['authors'], untranslated: ['authors'] },
      }),
      failed('"authors" is in both collections.translated and collections.untranslated'),
      'both lists',
    );
  });

  it('boots when translated and untranslated name different collections', () => {
    parses(
      intlConfig({
        collections: { translated: ['posts'], untranslated: ['sources'] },
      }),
    );
  });
});

describe('A `fields` key is not in `translated`, or an `id`, `locale`, or `slug` name is empty.', () => {
  it('refuses when a field name is empty', () => {
    const rows = [
      ['id', 'collections.fields.pages.id'],
      ['locale', 'collections.fields.pages.locale'],
      ['slug', 'collections.fields.pages.slug'],
    ] as const;
    for (const [key, path] of rows) {
      refusesAt(
        {
          locales: ['en'],
          defaultLocale: 'en',
          collections: { translated: ['pages'], fields: { pages: { [key]: '' } } },
        },
        [{ at: path }],
        key,
      );
    }
  });

  it('refuses when a fields key is not in translated', () => {
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

  it('boots when field names are set on a translated collection', async () => {
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
});

describe('A route row names a collection that is not in `translated`.', () => {
  it('refuses when a route row names a collection that is not in translated', () => {
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

  it('boots when the collection is in translated', () => {
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
});

describe("The intl config doesn't match its schema: a value of the wrong type or shape, or a key the schema doesn't know.", () => {
  it('refuses when collection is not a name or { name, entry }', () => {
    const slug = { en: 'blog', de: 'artikel' };
    const base = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { translated: ['blog'] },
    };
    refusesAt(
      {
        ...base,
        routes: [{ slug, view: 'x', collection: 'blog', entry: 'hello' }],
      } as unknown as IntlConfigInput,
      [{ at: 'routes[0]', key: 'entry' }],
      'sibling entry',
    );
    const atCollection = [{ at: 'routes[0].collection' }] as const;
    refusesAt(
      {
        ...base,
        routes: [{ slug, view: 'x', collection: { entry: 'hello' } }],
      } as unknown as IntlConfigInput,
      atCollection,
      'missing name',
    );
    refusesAt(
      {
        ...base,
        routes: [{ slug, view: 'x', collection: {} }],
      } as unknown as IntlConfigInput,
      atCollection,
      'empty',
    );
  });

  it('boots when collection is a name or { name, entry }', async () => {
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

  it('refuses when prefixDefaultLocale is not a boolean', () => {
    refusesAt(
      {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: 'no' },
      } as unknown as IntlConfigInput,
      [{ at: 'routing.prefixDefaultLocale' }],
    );
  });

  it('refuses when a collection name is a key of collections', () => {
    refusesAt(
      {
        locales: ['en'],
        defaultLocale: 'en',
        collections: { pages: { id: 'uid' } },
      } as unknown as IntlConfigInput,
      [{ at: 'collections', key: 'pages' }],
    );
  });

  it('refuses when entryId is set', () => {
    refusesAt(
      {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        entryId: 'collectionFolder',
      } as unknown as IntlConfigInput,
      [{ key: 'entryId' }],
      'top-level',
    );
    refusesAt(
      {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        collections: {
          translated: ['pages'],
          fields: { pages: { entryId: 'frontmatter' } },
        },
      } as unknown as IntlConfigInput,
      [{ at: 'collections.fields.pages', key: 'entryId' }],
      'field',
    );
  });

  it('boots when prefixDefaultLocale is a boolean', () => {
    parses(intlConfig({ routing: { prefixDefaultLocale: true } }));
    parses(intlConfig({ routing: { prefixDefaultLocale: false } }));
  });
});
