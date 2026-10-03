import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import { type InjectedRoute, intlHooks } from '../astro.ts';
import {
  blogEntries,
  blogRoutes,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  relativeLocaleUrl,
} from '../fixtures.ts';

/**
 * Dev skips the build-only sitemap data route, so `injected` is the row routes.
 * View files have to exist. Setup resolves each named view to a file.
 */
async function inject(t: TestContext, config: IntlConfigInput, views: readonly string[]) {
  const hooks = await intlHooks(t, config);
  for (const view of views) {
    const file = join(hooks.root, 'src', 'views', `${view}.astro`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '');
  }
  await hooks.setup({ command: 'dev' });
  return { root: hooks.root, injected: hooks.injected };
}

/** Pattern plus the view file under the project `views` directory. */
function injectedViews(root: string, injected: readonly InjectedRoute[]) {
  const viewsDir = join(root, 'src', 'views');
  return injected.map((route) => {
    const entrypoint = String(route.entrypoint);
    const prefix = `${viewsDir}${sep}`;
    assert.ok(entrypoint.startsWith(prefix), entrypoint);
    return { pattern: route.pattern, view: entrypoint.slice(prefix.length) };
  });
}

type UrlCall = { locale: string; path: string | undefined };

/** Blog rows name a fallback view. `solo` is the default-locale entry with no German sibling. */
function missingIntl(calls?: UrlCall[]) {
  return createIntl(
    intlConfig({
      routes: blogRoutes(),
      collections: { translated: ['blog'] },
    }),
    {
      loaders: collectionLoaders(
        { blog: blogEntries() },
        calls === undefined
          ? undefined
          : {
              relative: (locale, path) => {
                calls.push({ locale, path });
                return relativeLocaleUrl(locale, path);
              },
            },
      ),
    },
  );
}

function fallbackFacts(
  paths: Awaited<ReturnType<ReturnType<typeof missingIntl>['fallbackPaths']>>,
) {
  return paths.map((item) => ({
    slug: item.params.slug,
    locale: item.props.locale,
    path: item.props.path,
    target: item.props.target,
    entry: item.props.entry,
  }));
}

const soloFallback = {
  slug: 'solo',
  locale: 'de',
  path: 'artikel/solo',
  target: '/en/blog/solo/',
  entry: collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
};

describe('missing translation', () => {
  it('injects the fallback view after the entry route and before the listing routes', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
        routes: [
          { slug: { en: 'about', de: 'ueber' }, view: 'about' },
          {
            slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
            collection: 'blog',
            view: 'post',
            fallbackView: 'missing',
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
      ['about', 'post', 'missing', 'blog'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/about/[...index]', view: 'about.astro' },
      { pattern: '/de/ueber/[...index]', view: 'about.astro' },
      { pattern: '/en/blog/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'missing.astro' },
      { pattern: '/en/blog/[...page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
      { pattern: '/en/blog/[page]', view: 'blog.astro' },
      { pattern: '/de/artikel/[page]', view: 'blog.astro' },
    ]);
  });

  it('uses the config fallback view unless a row names its own or false', async (t) => {
    const { root, injected } = await inject(
      t,
      intlConfig({
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
        collections: { translated: ['blog', 'tags', 'authors'] },
      }),
      ['about', 'post', 'missing', 'term', 'tag-missing', 'author'],
    );

    assert.deepEqual(injectedViews(root, injected), [
      { pattern: '/en/about/[...index]', view: 'about.astro' },
      { pattern: '/de/ueber/[...index]', view: 'about.astro' },
      { pattern: '/en/blog/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'post.astro' },
      { pattern: '/de/artikel/[slug]', view: 'missing.astro' },
      { pattern: '/en/tags/[slug]', view: 'term.astro' },
      { pattern: '/de/schlagworte/[slug]', view: 'term.astro' },
      { pattern: '/de/schlagworte/[slug]', view: 'tag-missing.astro' },
      { pattern: '/en/authors/[slug]', view: 'author.astro' },
      { pattern: '/de/autoren/[slug]', view: 'author.astro' },
    ]);
  });

  it('injects a fallback route for other locales and none for the default locale', async (t) => {
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
            fallbackView: 'missing',
          },
        ],
        collections: { translated: ['blog'] },
      }),
      ['home', 'blog', 'post', 'missing'],
    );

    const views = injectedViews(root, injected);
    assert.deepEqual(
      views.filter((route) => route.view === 'missing.astro' || route.pattern.includes('[slug]')),
      [
        { pattern: '/de/artikel/[slug]', view: 'post.astro' },
        { pattern: '/de/artikel/[slug]', view: 'missing.astro' },
        { pattern: '/blog/[slug]', view: 'post.astro' },
      ],
    );
  });

  it('points an entry with no translation at the default-locale url and skips a published slug', async () => {
    const calls: UrlCall[] = [];
    const paths = await missingIntl(calls).fallbackPaths('/de/artikel/[slug]');
    assert.deepEqual(fallbackFacts(paths), [soloFallback]);
    assert.deepEqual(calls, [{ locale: 'en', path: 'blog/solo' }]);
  });

  it('accepts one trailing slash on the fallback route pattern', async () => {
    const paths = await missingIntl().fallbackPaths('/de/artikel/[slug]/');
    assert.deepEqual(fallbackFacts(paths), [soloFallback]);
  });
});
