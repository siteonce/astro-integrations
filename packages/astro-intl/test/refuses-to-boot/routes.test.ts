import assert from 'node:assert/strict';
import { join, sep } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { createIntl } from '@siteonce/astro-intl';
import {
  boot,
  type IntlHooks,
  nodeAdapter,
  resolvedRoute,
  siteRootRoute,
  viewComponent,
} from '../astro.ts';
import {
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
} from '../fixtures.ts';

/**
 * On-demand `/en/blog/[page]` (row 1) has the same shape as `/en/blog/[slug]` (row 0).
 * The German route names the same rows.
 */
const sameShapeEn =
  '@siteonce/astro-intl: on-demand {page} route "/en/blog/[page]" (row 1) has the same shape as {slug} route "/en/blog/[slug]" (row 0). Give pagination its own view that exports prerender = true. /en/blog/2 stays, and page 1 stays on demand. Export prerender = true from the row\'s view. This also prerenders page 1. Give pagination.slug its own segment (for example blog/page/{page}).';

const sameShapeDe =
  '@siteonce/astro-intl: on-demand {page} route "/de/artikel/[page]" (row 1) has the same shape as {slug} route "/de/artikel/[slug]" (row 0). Give pagination its own view that exports prerender = true. /de/artikel/2 stays, and page 1 stays on demand. Export prerender = true from the row\'s view. This also prerenders page 1. Give pagination.slug its own segment (for example blog/page/{page}).';

/** `{slug}` beside `blog/{page}`, the shape an on-demand numbered route must not share. */
function clashingPages(): IntlConfigInput {
  return intlConfig({
    viewRendering: 'request',
    routes: [
      {
        slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
        collection: 'blog',
        view: 'post',
      },
      {
        slug: { en: 'blog', de: 'artikel' },
        collection: 'blog',
        view: 'blog',
        pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

/**
 * Entry `/en/blog/[slug]` (the fallback shares `/de/artikel/[slug]`),
 * static `/en/about/[...index]`, and listing `/en/blog/[...page]` plus `/en/blog/[page]`.
 * The page-1 spread is injected before the numbered route.
 */
function shapedRoutes(): IntlConfigInput {
  return intlConfig({
    routes: [
      {
        slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
        collection: 'blog',
        view: 'post',
        fallbackView: 'missing',
      },
      { slug: { en: 'about', de: 'ueber' }, view: 'about' },
      {
        slug: { en: 'blog', de: 'artikel' },
        collection: 'blog',
        view: 'blog',
        pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

/**
 * Listing page 1 is `/en/blog/[...page]`. Later pages are `/en/blog/page/[page]`.
 * The spread does not reach a file under `blog/page/`.
 */
function pageSegmentListing(): IntlConfigInput {
  return intlConfig({
    routes: [
      {
        slug: { en: 'blog', de: 'artikel' },
        collection: 'blog',
        view: 'blog',
        pagination: { pageSize: 10, slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' } },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

/** `viewRendering: 'request'` outside `astro dev`, so the on-demand clash check runs. */
function bootRequest(t: TestContext, config: IntlConfigInput, views: readonly string[]) {
  return boot(t, config, { adapter: nodeAdapter }, views);
}

/** Injected view entrypoint for one pattern. */
function entrypoint(hooks: IntlHooks, pattern: string): string {
  const route = hooks.injected.find((item) => item.pattern === pattern);
  assert.ok(route, pattern);
  return String(route.entrypoint);
}

/** One injected route as `astro:routes:resolved` reports it. `prerendered` defaults to on demand. */
function onDemand(hooks: IntlHooks, pattern: string, prerendered = false) {
  return resolvedRoute({
    entrypoint: entrypoint(hooks, pattern),
    pattern,
    isPrerendered: prerendered,
  });
}

/** A project file route. Origin `project` is what the file-route check scans. */
function projectFile(pattern: string) {
  return resolvedRoute({
    entrypoint: join('pages', 'file.astro'),
    pattern,
    isPrerendered: true,
    origin: 'project',
  });
}

describe("`viewRendering` is `'request'` and an on-demand `pagination.slug` route has the same shape as a `{slug}` route, outside `astro dev`.", () => {
  it('refuses an on-demand {page} route that matches a {slug} route', async (t) => {
    const hooks = await bootRequest(t, clashingPages(), ['post', 'blog']);

    await assert.rejects(
      () => hooks.routesResolved([onDemand(hooks, '/en/blog/[page]'), siteRootRoute()]),
      { message: sameShapeEn },
    );
    await assert.rejects(
      () => hooks.routesResolved([onDemand(hooks, '/de/artikel/[page]'), siteRootRoute()]),
      { message: sameShapeDe },
    );

    // The page-1 spread is not that shape, and a prerendered {page} route stays allowed.
    await hooks.routesResolved([
      onDemand(hooks, '/en/blog/[slug]'),
      onDemand(hooks, '/en/blog/[...page]'),
      siteRootRoute(),
    ]);
    await hooks.routesResolved([
      onDemand(hooks, '/en/blog/[slug]'),
      onDemand(hooks, '/en/blog/[page]', true),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('boots when an on-demand {page} route has its own segment', async (t) => {
    const hooks = await bootRequest(
      t,
      intlConfig({
        viewRendering: 'request',
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: {
              pageSize: 10,
              slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['post', 'blog'],
    );

    const listings = hooks.injected.filter((route) =>
      String(route.entrypoint).endsWith(`${sep}blog.astro`),
    );
    assert.deepEqual(
      listings.map((route) => ({ pattern: route.pattern, prerender: route.prerender })),
      [
        { pattern: '/en/blog/[...page]', prerender: false },
        { pattern: '/de/artikel/[...page]', prerender: false },
        { pattern: '/en/blog/page/[page]', prerender: false },
        { pattern: '/de/artikel/seite/[page]', prerender: false },
      ],
    );

    await hooks.routesResolved([
      onDemand(hooks, '/en/blog/[slug]'),
      onDemand(hooks, '/en/blog/page/[page]'),
      onDemand(hooks, '/de/artikel/[slug]'),
      onDemand(hooks, '/de/artikel/seite/[page]'),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('boots when pagination.view prerenders the numbered route', async (t) => {
    const hooks = await bootRequest(
      t,
      intlConfig({
        viewRendering: 'request',
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: {
              pageSize: 10,
              slug: { en: 'blog/{page}', de: 'artikel/{page}' },
              view: 'archive',
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['post', 'blog', 'archive'],
    );

    assert.ok(entrypoint(hooks, '/en/blog/[page]').endsWith(`${sep}archive.astro`));
    assert.ok(entrypoint(hooks, '/en/blog/[...page]').endsWith(`${sep}blog.astro`));

    await hooks.routesResolved([
      onDemand(hooks, '/en/blog/[slug]'),
      onDemand(hooks, '/en/blog/[...page]'),
      onDemand(hooks, '/en/blog/[page]', true),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('refuses when pagination.view leaves the numbered route on demand', async (t) => {
    const hooks = await bootRequest(
      t,
      intlConfig({
        viewRendering: 'request',
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: {
              pageSize: 10,
              slug: { en: 'blog/{page}', de: 'artikel/{page}' },
              view: 'archive',
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['post', 'blog', 'archive'],
    );

    await assert.rejects(
      () =>
        hooks.routesResolved([
          onDemand(hooks, '/en/blog/[slug]'),
          onDemand(hooks, '/en/blog/[page]'),
          siteRootRoute(),
        ]),
      { message: sameShapeEn },
    );
  });

  it('refuses when the on-demand route is reported with a relative view entrypoint and no leading slash', async (t) => {
    const hooks = await bootRequest(t, clashingPages(), ['post', 'blog']);

    await assert.rejects(
      () =>
        hooks.routesResolved([
          resolvedRoute({
            entrypoint: viewComponent('post.astro'),
            pattern: 'en/blog/[page]',
            isPrerendered: false,
          }),
          siteRootRoute(),
        ]),
      { message: sameShapeEn },
    );
  });

  it('boots when an external route has a foreign entrypoint', async (t) => {
    const hooks = await bootRequest(t, clashingPages(), ['post', 'blog']);
    const foreign = `/${join('pkg', 'astro-og-image', 'src', 'route.ts')}`;

    await hooks.routesResolved([
      resolvedRoute({
        entrypoint: foreign,
        pattern: '/_og/[...path].png',
        isPrerendered: false,
      }),
      resolvedRoute({
        entrypoint: foreign,
        pattern: '/en/blog/[page]',
        isPrerendered: false,
      }),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });
});

describe('Two rows compile to the same route pattern.', () => {
  it('refuses when one kind repeats a pattern', async (t) => {
    // The repeat is reported while compiling routes, before view files are read.
    await assert.rejects(
      () =>
        boot(
          t,
          intlConfig({
            routes: [
              { slug: { en: 'about', de: 'ueber' }, view: 'a' },
              { slug: { en: 'other', de: 'anders' }, view: 'b' },
              { slug: { en: 'skip', de: 'weiter' }, view: 'c' },
              { slug: { en: 'about', de: 'ueber-uns' }, view: 'd' },
            ],
          }),
        ),
      {
        message:
          '@siteonce/astro-intl: route pattern "/en/about/[...index]" repeats (rows 0 and 3).',
      },
    );
  });
});

describe('A file route shaped like an injected route would serve a URL that route emits and win over it.', () => {
  it('refuses a project file route that would serve an injected URL', async (t) => {
    const hooks = await boot(t, shapedRoutes(), { command: 'dev' }, [
      'post',
      'missing',
      'about',
      'blog',
    ]);

    // The fallback view shares `/de/artikel/[slug]` and is the second hit.
    // `/en/blog/2` and `/en/blog/12` also match the page-1 spread. The spread is injected first.
    const collisions = [
      [
        '/en/blog/[post]',
        '@siteonce/astro-intl: file route "/en/blog/[post]" collides with injected route "/en/blog/[slug]" (view "post").',
      ],
      [
        '/de/artikel/[id]',
        '@siteonce/astro-intl: file route "/de/artikel/[id]" collides with injected route "/de/artikel/[slug]" (view "post").',
      ],
      [
        '/en/about',
        '@siteonce/astro-intl: file route "/en/about" collides with injected route "/en/about/[...index]" (view "about").',
      ],
      [
        '/en/about/[...rest]',
        '@siteonce/astro-intl: file route "/en/about/[...rest]" collides with injected route "/en/about/[...index]" (view "about").',
      ],
      [
        '/en/blog',
        '@siteonce/astro-intl: file route "/en/blog" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
      [
        '/en/blog/2',
        '@siteonce/astro-intl: file route "/en/blog/2" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
      [
        '/en/blog/12',
        '@siteonce/astro-intl: file route "/en/blog/12" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
      [
        '/en/blog/[...rest]',
        '@siteonce/astro-intl: file route "/en/blog/[...rest]" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
    ] as const;

    for (const [file, message] of collisions) {
      await assert.rejects(
        () => hooks.routesResolved([projectFile(file), siteRootRoute()]),
        {
          message,
        },
        file,
      );
    }

    // No `{slug}` route, so a `[param]` file is reported against the listing spread.
    const listing = await boot(
      t,
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      { command: 'dev' },
      ['blog'],
    );
    await assert.rejects(
      () => listing.routesResolved([projectFile('/en/blog/[n]'), siteRootRoute()]),
      {
        message:
          '@siteonce/astro-intl: file route "/en/blog/[n]" collides with injected route "/en/blog/[...page]" (view "blog").',
      },
    );

    const paged = await boot(t, pageSegmentListing(), { command: 'dev' }, ['blog']);
    const pageCollisions = [
      [
        '/en/blog/page/3',
        '@siteonce/astro-intl: file route "/en/blog/page/3" collides with injected route "/en/blog/page/[page]" (view "blog").',
      ],
      [
        '/en/blog/page/12',
        '@siteonce/astro-intl: file route "/en/blog/page/12" collides with injected route "/en/blog/page/[page]" (view "blog").',
      ],
      [
        '/en/blog/page/[n]',
        '@siteonce/astro-intl: file route "/en/blog/page/[n]" collides with injected route "/en/blog/page/[page]" (view "blog").',
      ],
    ] as const;
    for (const [file, message] of pageCollisions) {
      await assert.rejects(
        () => paged.routesResolved([projectFile(file), siteRootRoute()]),
        { message },
        file,
      );
    }
  });

  it('boots when a project file route would not serve an injected URL', async (t) => {
    const hooks = await boot(t, shapedRoutes(), { command: 'dev' }, [
      'post',
      'missing',
      'about',
      'blog',
    ]);

    await hooks.routesResolved([
      projectFile('/en/blog/rss.xml'),
      projectFile('/en/blog/[slug].json'),
      projectFile('/[locale]/[...path]'),
      projectFile('/[locale]/blog/[slug]'),
      projectFile('/en/about/[section]'),
      projectFile('/en/about/2'),
      projectFile('/en/other'),
      projectFile('/en/blog/x/[id]'),
      projectFile('/en/about/x/[...rest]'),
      projectFile('/en/blog/x2'),
      projectFile('/en/blog/2x'),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);

    const paged = await boot(t, pageSegmentListing(), { command: 'dev' }, ['blog']);
    await paged.routesResolved([
      projectFile('/en/blog/page'),
      projectFile('/en/blog/page/x3'),
      projectFile('/en/blog/page/3x'),
      projectFile('/en/blog/page/2/3'),
      siteRootRoute(),
    ]);
    assert.equal(paged.error, undefined);
  });

  it('refuses a project file at / over the default-locale home', async (t) => {
    const hooks = await boot(
      t,
      intlConfig({
        routing: { prefixDefaultLocale: false },
        routes: [
          { slug: { en: '/', de: '/' }, view: 'home' },
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
        ],
        collections: { translated: ['blog'] },
      }),
      { command: 'dev' },
      ['home', 'post'],
    );

    await assert.rejects(() => hooks.routesResolved([projectFile('/')]), {
      message:
        '@siteonce/astro-intl: file route "/" collides with injected route "/[...index]" (view "home").',
    });
  });

  it('boots when an unprefixed rss.xml sits beside the default-locale home', async (t) => {
    const hooks = await boot(
      t,
      intlConfig({
        routing: { prefixDefaultLocale: false },
        routes: [
          { slug: { en: '/', de: '/' }, view: 'home' },
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
          },
        ],
        collections: { translated: ['blog'] },
      }),
      { command: 'dev' },
      ['home', 'post'],
    );

    await hooks.routesResolved([projectFile('[...locale]/rss.xml'), projectFile('/rss.xml')]);
    assert.equal(hooks.error, undefined);
  });
});

describe('A `(locale, path)` is duplicated.', () => {
  it('refuses when an entry row path equals a compiled leaf', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: 'blog',
          },
          {
            slug: { en: 'blog/hello-world', de: 'other' },
            view: 'page',
            collection: { name: 'pages', entry: 'clash' },
          },
        ],
        collections: { translated: ['blog', 'pages'] },
      }),
      {
        loaders: collectionLoaders({
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
          ],
          pages: [
            collectionEntry('pages', 'clash-en', { id: 'clash', locale: 'en' }),
            collectionEntry('pages', 'clash-de', { id: 'clash', locale: 'de' }),
          ],
        }),
      },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: (locale, path) "en" / "blog/hello-world" collides (pages vs blog).',
    });
  });

  it('refuses when a route tail collides with an entry', async () => {
    const intl = createIntl(
      intlConfig({
        routes: [
          { slug: { en: 'blog/hello-world', de: 'other' }, view: 'page' },
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            view: 'post',
            collection: 'blog',
          },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        loaders: collectionLoaders({
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
        }),
      },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: (locale, path) "en" / "blog/hello-world" collides (blog vs route tail).',
    });
  });

  it('refuses when a static row and a listing page share a tail', async () => {
    // Two entries at page size 1 fill two pages, so the listing publishes blog/2.
    const intl = createIntl(
      intlConfig({
        routes: [
          { slug: { en: 'blog/2', de: 'artikel/2' }, view: 'page' },
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        loaders: collectionLoaders({
          blog: [
            collectionEntry('blog', 'one', { id: 'one', locale: 'en' }),
            collectionEntry('blog', 'two', { id: 'two', locale: 'en' }),
          ],
        }),
      },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: (locale, path) "en" / "blog/2" collides (route tail vs route tail).',
    });
  });
});
