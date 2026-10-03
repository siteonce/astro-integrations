import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inject, injectedViews } from '../astro.ts';
import { intlConfig } from '../fixtures.ts';

describe('route injection', () => {
  it('injects a route shape for every locale of each row', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
          { slug: { en: '/', de: '/' }, view: 'home' },
          { slug: { en: 'about', de: 'ueber' }, view: { en: 'about', de: 'ueber' } },
          {
            slug: { en: '/', de: '/' },
            collection: 'posts',
            view: 'index',
            pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
          },
          { slug: { en: 'notes', de: 'notizen' }, collection: 'notes', view: 'notes' },
          {
            slug: { en: 'team', de: 'mannschaft' },
            collection: { name: 'people', entry: 'ada' },
            view: 'person',
          },
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
          {
            slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
            collection: { name: 'pages', entry: 'designer' },
            view: 'career',
          },
        ],
        collections: { translated: ['posts', 'blog', 'notes', 'people', 'pages'] },
      }),
      ['home', 'about', 'ueber', 'index', 'blog', 'notes', 'person', 'post', 'career'],
    );

    assert.equal(
      injected.some((route) => Object.hasOwn(route, 'prerender')),
      false,
    );
    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/[...index]', view: 'home.astro' },
      { pattern: '/de/[...index]', view: 'home.astro' },
      { pattern: '/en/about/[...index]', view: 'about.astro' },
      { pattern: '/de/ueber/[...index]', view: 'ueber.astro' },
      { pattern: '/en/[...page]', view: 'index.astro' },
      { pattern: '/de/[...page]', view: 'index.astro' },
      { pattern: '/en/[page]', view: 'index.astro' },
      { pattern: '/de/[page]', view: 'index.astro' },
      { pattern: '/en/blog/[...page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
      { pattern: '/en/blog/[page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[page]', view: 'blog.astro' },
      { pattern: '/en/notes/[...index]', view: 'notes.astro' },
      { pattern: '/de/notizen/[...index]', view: 'notes.astro' },
      { pattern: '/en/team/[...index]', view: 'person.astro' },
      { pattern: '/de/mannschaft/[...index]', view: 'person.astro' },
      { pattern: '/en/blog/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'post.astro' },
      { pattern: '/en/careers/[slug]', view: 'career.astro' },
      { pattern: '/de/karriere/[slug]', view: 'career.astro' },
    ]);
  });

  it('leaves the default locale unprefixed', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
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
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['home', 'blog', 'post'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/de/[...index]', view: 'home.astro' },
      { pattern: '/[...index]', view: 'home.astro' },
      { pattern: '/de/artikel/[...index]', view: 'blog.astro' },
      { pattern: '/blog/[...index]', view: 'blog.astro' },
      { pattern: '/de/artikel/[slug]', view: 'post.astro' },
      { pattern: '/blog/[slug]', view: 'post.astro' },
    ]);
  });

  it('injects one route per row and locale, and two when the row has pagination', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
          { slug: { en: 'about', de: 'ueber' }, view: 'about' },
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
      }),
      ['about', 'post', 'blog'],
    );

    assert.equal(
      injected.some((route) => Object.hasOwn(route, 'prerender')),
      false,
    );
    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/about/[...index]', view: 'about.astro' },
      { pattern: '/de/ueber/[...index]', view: 'about.astro' },
      { pattern: '/en/blog/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'post.astro' },
      { pattern: '/en/blog/[...page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
      { pattern: '/en/blog/[page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[page]', view: 'blog.astro' },
    ]);
  });

  it('keeps a named entry on the static spread', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      ['about'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/about/[...index]', view: 'about.astro' },
      { pattern: '/de/ueber/[...index]', view: 'about.astro' },
    ]);
  });

  it('injects pagination.slug as written, with the row view', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
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
      ['blog'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/blog/[...page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
      { pattern: '/en/blog/page/[page]', view: 'blog.astro' },
      { pattern: '/de/artikel/seite/[page]', view: 'blog.astro' },
    ]);
  });

  it('injects later pages with pagination.view', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            collection: 'blog',
            view: 'blog',
            pagination: {
              pageSize: 10,
              slug: { en: 'blog/{page}', de: 'artikel/{page}' },
              view: 'blog/archive',
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['blog', 'blog/archive'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/blog/[...page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
      { pattern: '/en/blog/[page]', view: 'blog/archive.astro' },
      { pattern: '/de/artikel/[page]', view: 'blog/archive.astro' },
    ]);
  });
});
