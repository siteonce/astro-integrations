import assert from 'node:assert/strict';
import { join, sep } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import type { AstroIntegration } from 'astro';
import {
  type IntlHooks,
  intlHooks,
  nodeAdapter,
  resolvedRoute,
  siteRootRoute,
  viewComponent,
  writeViews,
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
  '@repo/astro-intl: on-demand {page} route "/en/blog/[page]" (row 1) has the same shape as {slug} route "/en/blog/[slug]" (row 0). Give pagination its own view that exports prerender = true. /en/blog/2 stays, and page 1 stays on demand. Export prerender = true from the row\'s view. This also prerenders page 1. Give pagination.slug its own segment (for example blog/page/{page}).';

const sameShapeDe =
  '@repo/astro-intl: on-demand {page} route "/de/artikel/[page]" (row 1) has the same shape as {slug} route "/de/artikel/[slug]" (row 0). Give pagination its own view that exports prerender = true. /de/artikel/2 stays, and page 1 stays on demand. Export prerender = true from the row\'s view. This also prerenders page 1. Give pagination.slug its own segment (for example blog/page/{page}).';

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

/** Entry, fallback, static, and listing routes whose patterns a project file can hit. */
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

async function boot(
  t: TestContext,
  config: IntlConfigInput,
  views: readonly string[],
  options?: { command?: 'dev' | 'build'; adapter?: AstroIntegration },
): Promise<IntlHooks> {
  const hooks = await intlHooks(t, config);
  await writeViews(hooks.root, views);
  await hooks.setup({ command: options?.command, adapter: options?.adapter });
  return hooks;
}

function bootRequest(t: TestContext, config: IntlConfigInput, views: readonly string[]) {
  return boot(t, config, views, { adapter: nodeAdapter });
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

describe('A (locale, path) is duplicated', () => {
  it('aborts when an entry row path equals a compiled leaf', async () => {
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
        '@repo/astro-intl: (locale, path) "en" / "blog/hello-world" collides (pages vs blog).',
    });
  });

  it('aborts when a route tail collides with an entry', async () => {
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
        '@repo/astro-intl: (locale, path) "en" / "blog/hello-world" collides (blog vs route tail).',
    });
  });
});

describe('Two rows compile to the same route pattern', () => {
  it('refuses startup when one kind repeats a pattern', async (t) => {
    const hooks = await intlHooks(
      t,
      intlConfig({
        routes: [
          { slug: { en: 'about', de: 'ueber' }, view: 'a' },
          { slug: { en: 'other', de: 'anders' }, view: 'b' },
          { slug: { en: 'skip', de: 'weiter' }, view: 'c' },
          { slug: { en: 'about', de: 'ueber-uns' }, view: 'd' },
        ],
      }),
    );

    // The repeat is reported while compiling routes, before view files are read.
    await assert.rejects(() => hooks.setup(), {
      message: '@repo/astro-intl: route pattern "/en/about/[...index]" repeats (rows 0 and 3).',
    });
  });
});

describe('viewRendering is "request" and an on-demand pagination.slug route has the same shape as a {slug} route, outside astro dev', () => {
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

  it('boots an on-demand {page} route that has its own segment', async (t) => {
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

  it('uses pagination.view for the numbered route and skips the clash when that view is prerendered', async (t) => {
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

  it('does not treat an external route with a foreign entrypoint as the on-demand route', async (t) => {
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

describe('A file route shaped like an injected route would serve a URL that route emits and win over it', () => {
  it('refuses a project file route that would serve an injected URL', async (t) => {
    const hooks = await boot(t, shapedRoutes(), ['post', 'missing', 'about', 'blog'], {
      command: 'dev',
    });

    // The fallback view shares `/de/artikel/[slug]` and is the second hit.
    // `/en/blog/2` also matches `[page]`. The page-1 spread is injected first.
    const collisions = [
      [
        '/en/blog/[post]',
        '@repo/astro-intl: file route "/en/blog/[post]" collides with injected route "/en/blog/[slug]" (view "post").',
      ],
      [
        '/de/artikel/[id]',
        '@repo/astro-intl: file route "/de/artikel/[id]" collides with injected route "/de/artikel/[slug]" (view "post").',
      ],
      [
        '/en/about',
        '@repo/astro-intl: file route "/en/about" collides with injected route "/en/about/[...index]" (view "about").',
      ],
      [
        '/en/about/[...rest]',
        '@repo/astro-intl: file route "/en/about/[...rest]" collides with injected route "/en/about/[...index]" (view "about").',
      ],
      [
        '/en/blog',
        '@repo/astro-intl: file route "/en/blog" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
      [
        '/en/blog/2',
        '@repo/astro-intl: file route "/en/blog/2" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
      [
        '/en/blog/[...rest]',
        '@repo/astro-intl: file route "/en/blog/[...rest]" collides with injected route "/en/blog/[...page]" (view "blog").',
      ],
    ] as const;

    for (const [file, message] of collisions) {
      await assert.rejects(() => hooks.routesResolved([projectFile(file), siteRootRoute()]), {
        message,
      });
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
      ['blog'],
      { command: 'dev' },
    );
    await assert.rejects(
      () => listing.routesResolved([projectFile('/en/blog/[n]'), siteRootRoute()]),
      {
        message:
          '@repo/astro-intl: file route "/en/blog/[n]" collides with injected route "/en/blog/[...page]" (view "blog").',
      },
    );
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
      ['home', 'post'],
      { command: 'dev' },
    );

    await assert.rejects(() => hooks.routesResolved([projectFile('/')]), {
      message:
        '@repo/astro-intl: file route "/" collides with injected route "/[...index]" (view "home").',
    });
  });

  it('allows a project file route that would not serve an injected URL', async (t) => {
    const hooks = await boot(t, shapedRoutes(), ['post', 'missing', 'about', 'blog'], {
      command: 'dev',
    });

    await hooks.routesResolved([
      projectFile('/en/blog/rss.xml'),
      projectFile('/en/blog/[slug].json'),
      projectFile('/[locale]/[...path]'),
      projectFile('/[locale]/blog/[slug]'),
      projectFile('/en/about/[section]'),
      projectFile('/en/about/2'),
      projectFile('/en/other'),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('allows an unprefixed rss.xml beside the default-locale home', async (t) => {
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
      ['home', 'post'],
      { command: 'dev' },
    );

    await hooks.routesResolved([projectFile('[...locale]/rss.xml'), projectFile('/rss.xml')]);
    assert.equal(hooks.error, undefined);
  });
});
