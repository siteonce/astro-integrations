import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl } from './define-intl.ts';
import { compileRoutes } from './routing.ts';

const locales = ['en', 'de'] as const;

describe('compileRoutes', () => {
  it('compiles prefixed rows to patterns', () => {
    const config = defineIntl({
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: '/', de: '/' }, page: 'home' },
        { slug: { en: 'about', de: 'ueber' }, page: { en: 'about', de: 'ueber' } },
        { slug: { en: '/', de: '/' }, collection: 'posts', pageSize: 1, page: 'index' },
        { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, page: 'blog' },
        { slug: { en: 'notes', de: 'notizen' }, collection: 'notes', page: 'notes' },
        {
          slug: { en: 'team', de: 'mannschaft' },
          collection: 'people',
          entry: 'ada',
          page: 'person',
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', page: 'post' },
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          collection: 'pages',
          entry: 'designer',
          page: 'career',
        },
      ],
    });

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/en', page: 'home', locale: 'en', rowIndex: 0, kind: 'static' },
      { pattern: '/de', page: 'home', locale: 'de', rowIndex: 0, kind: 'static' },
      { pattern: '/en/about', page: 'about', locale: 'en', rowIndex: 1, kind: 'static' },
      { pattern: '/de/ueber', page: 'ueber', locale: 'de', rowIndex: 1, kind: 'static' },
      { pattern: '/en/[...page]', page: 'index', locale: 'en', rowIndex: 2, kind: 'listing' },
      { pattern: '/de/[...page]', page: 'index', locale: 'de', rowIndex: 2, kind: 'listing' },
      { pattern: '/en/blog/[...page]', page: 'blog', locale: 'en', rowIndex: 3, kind: 'listing' },
      {
        pattern: '/de/artikel/[...page]',
        page: 'blog',
        locale: 'de',
        rowIndex: 3,
        kind: 'listing',
      },
      { pattern: '/en/notes', page: 'notes', locale: 'en', rowIndex: 4, kind: 'static' },
      { pattern: '/de/notizen', page: 'notes', locale: 'de', rowIndex: 4, kind: 'static' },
      { pattern: '/en/team', page: 'person', locale: 'en', rowIndex: 5, kind: 'static' },
      { pattern: '/de/mannschaft', page: 'person', locale: 'de', rowIndex: 5, kind: 'static' },
      { pattern: '/en/blog/[slug]', page: 'post', locale: 'en', rowIndex: 6, kind: 'entry' },
      { pattern: '/de/artikel/[slug]', page: 'post', locale: 'de', rowIndex: 6, kind: 'entry' },
      { pattern: '/de/artikel/[slug]', page: 'post', locale: 'de', rowIndex: 6, kind: 'redirect' },
      { pattern: '/en/careers/[slug]', page: 'career', locale: 'en', rowIndex: 7, kind: 'entry' },
      { pattern: '/de/karriere/[slug]', page: 'career', locale: 'de', rowIndex: 7, kind: 'entry' },
      {
        pattern: '/de/karriere/[slug]',
        page: 'career',
        locale: 'de',
        rowIndex: 7,
        kind: 'redirect',
      },
    ]);
  });

  it('drops the default-locale prefix and emits no redirect for it', () => {
    const config = defineIntl({
      locales: ['de', 'en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [
        { slug: { en: '/', de: '/' }, page: 'home' },
        { slug: { en: 'blog', de: 'artikel' }, page: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', page: 'post' },
      ],
    });

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/de', page: 'home', locale: 'de', rowIndex: 0, kind: 'static' },
      { pattern: '/', page: 'home', locale: 'en', rowIndex: 0, kind: 'static' },
      { pattern: '/de/artikel', page: 'blog', locale: 'de', rowIndex: 1, kind: 'static' },
      { pattern: '/blog', page: 'blog', locale: 'en', rowIndex: 1, kind: 'static' },
      { pattern: '/de/artikel/[slug]', page: 'post', locale: 'de', rowIndex: 2, kind: 'entry' },
      { pattern: '/de/artikel/[slug]', page: 'post', locale: 'de', rowIndex: 2, kind: 'redirect' },
      { pattern: '/blog/[slug]', page: 'post', locale: 'en', rowIndex: 2, kind: 'entry' },
    ]);
  });

  it('emits nothing for a locale with no slug or no page', () => {
    const config = defineIntl({
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'about' }, page: 'about' },
        { slug: { en: 'blog', de: 'artikel' }, page: { en: 'blog' } },
      ],
    });

    assert.deepEqual(compileRoutes(config), [
      { pattern: '/en/about', page: 'about', locale: 'en', rowIndex: 0, kind: 'static' },
      { pattern: '/en/blog', page: 'blog', locale: 'en', rowIndex: 1, kind: 'static' },
    ]);
  });

  it('throws when one kind repeats a pattern', () => {
    const config = defineIntl({
      locales: [...locales],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'about', de: 'ueber' }, page: 'a' },
        { slug: { en: 'other', de: 'anders' }, page: 'b' },
        { slug: { en: 'skip', de: 'weiter' }, page: 'c' },
        { slug: { en: 'about', de: 'ueber-uns' }, page: 'd' },
      ],
    });

    assert.throws(() => compileRoutes(config), {
      message: '@repo/astro-intl: route pattern "/en/about" repeats (rows 0 and 3).',
    });
  });
});
