import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { IntlConfig } from './define-intl.ts';
import { compileRoutes, pageSlugClash, pageSlugClashMessage, viewEntrypoint } from './routing.ts';

const locales = ['en', 'de'] as const;

describe('compileRoutes', () => {
  it('compiles prefixed rows to patterns', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: '/', de: '/' }, view: 'home' },
        { slug: { en: 'about', de: 'ueber' }, view: { en: 'about', de: 'ueber' } },
        { slug: { en: '/', de: '/' }, collection: 'posts', pageSize: 1, view: 'index' },
        { slug: { en: '{page}', de: '{page}' }, collection: 'posts', pageSize: 1, view: 'index' },
        { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, view: 'blog' },
        {
          slug: { en: 'blog/{page}', de: 'artikel/{page}' },
          collection: 'blog',
          pageSize: 10,
          view: 'blog',
        },
        { slug: { en: 'notes', de: 'notizen' }, collection: 'notes', view: 'notes' },
        {
          slug: { en: 'team', de: 'mannschaft' },
          collection: 'people',
          entry: 'ada',
          view: 'person',
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          collection: 'pages',
          entry: 'designer',
          view: 'career',
        },
      ],
    };

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/en/[...index]', view: 'home', locale: 'en', rowIndex: 0, kind: 'static' },
      { pattern: '/de/[...index]', view: 'home', locale: 'de', rowIndex: 0, kind: 'static' },
      { pattern: '/en/about/[...index]', view: 'about', locale: 'en', rowIndex: 1, kind: 'static' },
      { pattern: '/de/ueber/[...index]', view: 'ueber', locale: 'de', rowIndex: 1, kind: 'static' },
      { pattern: '/en/[...page]', view: 'index', locale: 'en', rowIndex: 2, kind: 'listing' },
      { pattern: '/de/[...page]', view: 'index', locale: 'de', rowIndex: 2, kind: 'listing' },
      { pattern: '/en/[page]', view: 'index', locale: 'en', rowIndex: 3, kind: 'listing' },
      { pattern: '/de/[page]', view: 'index', locale: 'de', rowIndex: 3, kind: 'listing' },
      { pattern: '/en/blog/[...page]', view: 'blog', locale: 'en', rowIndex: 4, kind: 'listing' },
      {
        pattern: '/de/artikel/[...page]',
        view: 'blog',
        locale: 'de',
        rowIndex: 4,
        kind: 'listing',
      },
      { pattern: '/en/blog/[page]', view: 'blog', locale: 'en', rowIndex: 5, kind: 'listing' },
      { pattern: '/de/artikel/[page]', view: 'blog', locale: 'de', rowIndex: 5, kind: 'listing' },
      { pattern: '/en/notes/[...index]', view: 'notes', locale: 'en', rowIndex: 6, kind: 'static' },
      {
        pattern: '/de/notizen/[...index]',
        view: 'notes',
        locale: 'de',
        rowIndex: 6,
        kind: 'static',
      },
      { pattern: '/en/team/[...index]', view: 'person', locale: 'en', rowIndex: 7, kind: 'static' },
      {
        pattern: '/de/mannschaft/[...index]',
        view: 'person',
        locale: 'de',
        rowIndex: 7,
        kind: 'static',
      },
      { pattern: '/en/blog/[slug]', view: 'post', locale: 'en', rowIndex: 8, kind: 'entry' },
      { pattern: '/de/artikel/[slug]', view: 'post', locale: 'de', rowIndex: 8, kind: 'entry' },
      { pattern: '/en/careers/[slug]', view: 'career', locale: 'en', rowIndex: 9, kind: 'entry' },
      { pattern: '/de/karriere/[slug]', view: 'career', locale: 'de', rowIndex: 9, kind: 'entry' },
    ]);
  });

  it('drops the default-locale prefix and emits a fallback route for other locales', () => {
    const config: IntlConfig = {
      locales: ['de', 'en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [
        { slug: { en: '/', de: '/' }, view: 'home' },
        { slug: { en: 'blog', de: 'artikel' }, view: 'blog' },
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          collection: 'blog',
          view: 'post',
          fallbackView: 'missing',
        },
      ],
    };

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/de/[...index]', view: 'home', locale: 'de', rowIndex: 0, kind: 'static' },
      { pattern: '/[...index]', view: 'home', locale: 'en', rowIndex: 0, kind: 'static' },
      {
        pattern: '/de/artikel/[...index]',
        view: 'blog',
        locale: 'de',
        rowIndex: 1,
        kind: 'static',
      },
      { pattern: '/blog/[...index]', view: 'blog', locale: 'en', rowIndex: 1, kind: 'static' },
      { pattern: '/de/artikel/[slug]', view: 'post', locale: 'de', rowIndex: 2, kind: 'entry' },
      {
        pattern: '/de/artikel/[slug]',
        view: 'missing',
        locale: 'de',
        rowIndex: 2,
        kind: 'fallback',
      },
      { pattern: '/blog/[slug]', view: 'post', locale: 'en', rowIndex: 2, kind: 'entry' },
    ]);
  });

  it('uses the config fallback view unless a row names its own or false', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      fallbackView: 'missing',
      routes: [
        { slug: { en: 'about', de: 'ueber' }, view: 'about' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
        {
          slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
          collection: 'tags',
          view: 'term',
          fallbackView: 'tag-missing',
        },
        {
          slug: { en: 'authors/{slug}', de: 'autoren/{slug}' },
          collection: 'authors',
          view: 'author',
          fallbackView: false,
        },
      ],
    };

    const fallback = compileRoutes(config)
      .filter((route) => route.kind === 'fallback')
      .map(({ pattern, view }) => ({ pattern, view }));
    assert.deepEqual(fallback, [
      { pattern: '/de/artikel/[slug]', view: 'missing' },
      { pattern: '/de/schlagworte/[slug]', view: 'tag-missing' },
    ]);
  });

  it('emits nothing for a locale with no slug or no view', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'about' }, view: 'about' },
        { slug: { en: 'blog', de: 'artikel' }, view: { en: 'blog' } },
      ],
    };

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/en/about/[...index]', view: 'about', locale: 'en', rowIndex: 0, kind: 'static' },
      { pattern: '/en/blog/[...index]', view: 'blog', locale: 'en', rowIndex: 1, kind: 'static' },
    ]);
  });

  it('throws when one kind repeats a pattern', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'about', de: 'ueber' }, view: 'a' },
        { slug: { en: 'other', de: 'anders' }, view: 'b' },
        { slug: { en: 'skip', de: 'weiter' }, view: 'c' },
        { slug: { en: 'about', de: 'ueber-uns' }, view: 'd' },
      ],
    };

    assert.throws(() => compileRoutes(config), {
      message: '@repo/astro-intl: route pattern "/en/about/[...index]" repeats (rows 0 and 3).',
    });
  });

  it('compiles a {page} segment the row writes itself', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, view: 'blog' },
        {
          slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          collection: 'blog',
          pageSize: 10,
          view: 'blog',
        },
      ],
    };
    assert.deepEqual(
      compileRoutes(config).map(({ pattern }) => pattern),
      [
        '/en/blog/[...page]',
        '/de/artikel/[...page]',
        '/en/blog/page/[page]',
        '/de/artikel/seite/[page]',
      ],
    );
  });
});

describe('pageSlugClash', () => {
  it('names both rows when [page] and [slug] share a section', () => {
    const config: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
        { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, view: 'blog' },
        {
          slug: { en: 'blog/{page}', de: 'artikel/{page}' },
          collection: 'blog',
          pageSize: 10,
          view: 'blog',
        },
      ],
    };
    const routes = compileRoutes(config);
    const clash = pageSlugClash(routes, '/en/blog/[page]');
    assert.ok(clash);
    assert.equal(clash.page.rowIndex, 2);
    assert.equal(clash.entry.rowIndex, 0);
    const message = pageSlugClashMessage(clash);
    assert.match(message, /row 2/);
    assert.match(message, /row 0/);
    assert.match(message, /Export prerender = true from the listing view/);
    assert.match(message, /blog\/page\/\{page\}/);
    assert.equal(pageSlugClash(routes, '/en/blog/[...page]'), undefined);
    assert.equal(pageSlugClash(routes, '/en/blog/[slug]'), undefined);
    assert.ok(pageSlugClash(routes, '/de/artikel/[page]'));
  });

  it('allows a {page} row with its own segment and a root {page} beside {slug}', () => {
    const own: IntlConfig = {
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
        {
          slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          collection: 'blog',
          pageSize: 10,
          view: 'blog',
        },
      ],
    };
    assert.equal(pageSlugClash(compileRoutes(own), '/en/blog/page/[page]'), undefined);

    const root: IntlConfig = {
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [
        { slug: { en: '{slug}' }, collection: 'posts', view: 'post' },
        { slug: { en: '{page}' }, collection: 'posts', pageSize: 1, view: 'home' },
      ],
    };
    assert.ok(pageSlugClash(compileRoutes(root), '/[page]'));
  });
});

describe('viewEntrypoint', () => {
  const srcDir = '/app/src';

  function exists(files: string[]): (file: string) => boolean {
    const present = new Set(files);
    return (file) => present.has(file);
  }

  it('returns the one view file that exists', () => {
    const file = join(srcDir, 'views', 'post.astro');
    const index = join(srcDir, 'views', 'blog', 'index.astro');
    assert.equal(viewEntrypoint(srcDir, 'post', exists([file])), file);
    assert.equal(viewEntrypoint(srcDir, 'blog', exists([index])), index);
  });

  it('throws when both files exist or neither does', () => {
    const file = join(srcDir, 'views', 'post.astro');
    const index = join(srcDir, 'views', 'post', 'index.astro');
    assert.throws(() => viewEntrypoint(srcDir, 'post', exists([file, index])), {
      message: '@repo/astro-intl: view "post" has both "post.astro" and "post/index.astro".',
    });
    assert.throws(() => viewEntrypoint(srcDir, 'post', exists([])), {
      message: '@repo/astro-intl: view "post" has no file under src/views/.',
    });
  });
});
