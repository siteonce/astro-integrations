import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import astroIntl from './integration.ts';

type InjectedCall = {
  pattern: string;
  entrypoint: string;
  prerender?: boolean;
};

type Setup = NonNullable<AstroIntegration['hooks']['astro:config:setup']>;
type SetupParams = Parameters<Setup>[0];

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'astro-intl-'));
  tempRoots.push(root);
  return root;
}

async function writeIntlConfig(
  srcDir: string,
  source = `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
};
`,
): Promise<void> {
  await mkdir(srcDir, { recursive: true });
  await writeFile(path.join(srcDir, 'intl.config.ts'), source);
}

type RoutesResolved = NonNullable<AstroIntegration['hooks']['astro:routes:resolved']>;
type ResolvedRoute = Parameters<RoutesResolved>[0]['routes'][number];

function resolvedRoute(options: {
  entrypoint: string;
  pattern: string;
  isPrerendered: boolean;
}): ResolvedRoute {
  return {
    type: 'page',
    origin: 'external',
    entrypoint: options.entrypoint,
    pattern: options.pattern,
    patternRegex: /$^/u,
    isPrerendered: options.isPrerendered,
    params: [],
    segments: [],
    fallbackRoutes: [],
    generate: () => options.pattern,
  };
}

function entrypointFor(injected: InjectedCall[], pattern: string): string {
  const call = injected.find((item) => item.pattern === pattern);
  assert.ok(call, pattern);
  return call.entrypoint;
}

/** A config `redirects` entry at `/`, as `astro:routes:resolved` reports it. */
function siteRootRoute(): ResolvedRoute {
  return {
    ...resolvedRoute({
      entrypoint: '/',
      pattern: '/',
      isPrerendered: true,
    }),
    type: 'redirect',
    origin: 'project',
    patternRegex: /^\/$/u,
  };
}

async function resolveRoutes(
  integration: AstroIntegration,
  routes: ResolvedRoute[],
): Promise<void> {
  const hook = integration.hooks['astro:routes:resolved'];
  assert.ok(hook);
  await hook({ routes, logger: silentLogger() });
}

function silentLogger(): SetupParams['logger'] {
  const logger = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    fork() {
      return logger;
    },
  };
  return logger as unknown as SetupParams['logger'];
}

async function runSetup(options: {
  root: string;
  srcDir?: string;
  i18n?: AstroConfig['i18n'];
  integrations?: AstroIntegration[];
  adapter?: AstroIntegration;
  command?: 'dev' | 'build' | 'preview' | 'sync';
}): Promise<{
  config: Record<string, unknown>;
  injected: InjectedCall[];
  integration: AstroIntegration;
}> {
  const srcDir = options.srcDir ?? path.join(options.root, 'src');
  const updates: Record<string, unknown>[] = [];
  const injected: InjectedCall[] = [];
  const integration = astroIntl();
  const setup = integration.hooks['astro:config:setup'];
  assert.ok(setup, 'astro:config:setup hook is registered');
  await setup({
    command: options.command ?? 'build',
    config: {
      root: pathToFileURL(`${options.root}/`),
      srcDir: pathToFileURL(`${srcDir}/`),
      i18n: options.i18n,
      integrations: options.integrations ?? [],
      adapter: options.adapter,
    },
    updateConfig(newConfig: Record<string, unknown>) {
      updates.push(newConfig);
      return newConfig as unknown as AstroConfig;
    },
    injectRoute(route: InjectedCall) {
      injected.push(route);
    },
    addWatchFile() {},
    logger: silentLogger(),
  } as unknown as SetupParams);
  assert.ok(updates[0], 'updateConfig was called');
  return { config: updates[0], injected, integration };
}

describe('astroIntl()', () => {
  it('writes Astro i18n from src/intl.config.ts', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);

    const { config } = await runSetup({ root });
    assert.deepEqual(config.i18n, {
      defaultLocale: 'en',
      locales: ['en', 'de'],
      routing: {
        prefixDefaultLocale: true,
        redirectToDefaultLocale: false,
        fallbackType: 'redirect',
      },
    });
  });

  it('honors redirectToDefaultLocale', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: false, redirectToDefaultLocale: true },
};
`,
    );

    const { config } = await runSetup({ root });
    assert.deepEqual(config.i18n, {
      defaultLocale: 'en',
      locales: ['en'],
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: true,
        fallbackType: 'redirect',
      },
    });
  });

  it('aborts when src/intl.config.ts is missing', async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, 'src'), { recursive: true });
    await assert.rejects(() => runSetup({ root }), /intl\.config\.ts not found/);
  });

  it('aborts when overlapping i18n keys are already set on defineConfig', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await assert.rejects(
      () =>
        runSetup({
          root,
          i18n: {
            defaultLocale: 'en',
            locales: ['en'],
            routing: {
              prefixDefaultLocale: false,
              redirectToDefaultLocale: false,
              fallbackType: 'redirect',
            },
          },
        }),
      /overlapping i18n keys/,
    );
  });

  it('allows @astrojs/sitemap when i18n is not set', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await writeFile(
      path.join(root, 'astro.config.mjs'),
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap()] };
`,
    );
    const sitemap = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
    const { config } = await runSetup({ root, integrations: [sitemap] });
    assert.equal((config.i18n as { defaultLocale: string }).defaultLocale, 'en');
  });

  it('aborts when @astrojs/sitemap i18n is set on the integration object', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    const sitemap = {
      name: '@astrojs/sitemap',
      hooks: {},
      options: { i18n: { defaultLocale: 'en', locales: { en: 'en' } } },
    } as AstroIntegration;
    await assert.rejects(
      () => runSetup({ root, integrations: [sitemap] }),
      /sitemap i18n option is set/,
    );
  });

  it('aborts when astro.config sets sitemap({ i18n })', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await writeFile(
      path.join(root, 'astro.config.mjs'),
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })] };
`,
    );
    const sitemap = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
    await assert.rejects(
      () => runSetup({ root, integrations: [sitemap] }),
      /sitemap i18n option is set/,
    );
  });

  it('injects one route per compiled row and locale', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: 'about', de: 'ueber' }, view: 'about' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post', fallbackView: 'missing' },
    { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', view: 'blog', pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } } },
  ],
  collections: { blog: { slugField: 'slug' } },
};
`,
    );
    const viewsDir = path.join(srcDir, 'views');
    await mkdir(viewsDir, { recursive: true });
    for (const name of ['about.astro', 'post.astro', 'blog.astro', 'missing.astro']) {
      await writeFile(path.join(viewsDir, name), '');
    }

    const resolvedSrc = fileURLToPath(pathToFileURL(`${srcDir}/`));
    const view = (name: string) => path.join(resolvedSrc, 'views', `${name}.astro`);
    const { injected } = await runSetup({ root });

    assert.deepEqual(
      injected.map(({ pattern, entrypoint }) => ({ pattern, entrypoint })),
      [
        { pattern: '/en/about/[...index]', entrypoint: view('about') },
        { pattern: '/de/ueber/[...index]', entrypoint: view('about') },
        { pattern: '/en/blog/[slug]', entrypoint: view('post') },
        { pattern: '/de/artikel/[slug]', entrypoint: view('post') },
        { pattern: '/de/artikel/[slug]', entrypoint: view('missing') },
        { pattern: '/en/blog/[...page]', entrypoint: view('blog') },
        { pattern: '/de/artikel/[...page]', entrypoint: view('blog') },
        { pattern: '/en/blog/[page]', entrypoint: view('blog') },
        { pattern: '/de/artikel/[page]', entrypoint: view('blog') },
      ],
    );
    assert.equal(
      injected.some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('aborts setup when a view file is missing', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'missing' }],
};
`,
    );
    await assert.rejects(() => runSetup({ root }), /view "missing" has no file under src\/views\//);
  });

  it('aborts when viewRendering is request and the site has no adapter', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  viewRendering: 'request',
};
`,
    );
    await assert.rejects(() => runSetup({ root }), /no adapter/);
  });

  it('gives prerender: false to every injected route except fallback', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request');
    const { injected } = await runSetup({
      root,
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const kindOf = (entrypoint: string) => {
      if (entrypoint.endsWith(`${path.sep}about.astro`)) return 'static';
      if (entrypoint.endsWith(`${path.sep}post.astro`)) return 'entry';
      if (entrypoint.endsWith(`${path.sep}blog.astro`)) return 'listing';
      if (entrypoint.endsWith(`${path.sep}missing.astro`)) return 'fallback';
      return 'unknown';
    };
    const seen = new Set<string>();
    for (const call of injected) {
      const kind = kindOf(call.entrypoint);
      seen.add(kind);
      if (kind === 'fallback') {
        assert.equal(Object.hasOwn(call, 'prerender'), false, kind);
      } else {
        assert.equal(call.prerender, false, kind);
      }
    }
    assert.deepEqual([...seen].sort(), ['entry', 'fallback', 'listing', 'static']);
  });

  it('sets no prerender option when viewRendering is build', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'build');
    const { injected } = await runSetup({ root });
    assert.ok(injected.length > 0);
    assert.equal(
      injected.some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('aborts when a fallback view exports prerender = false', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request');
    const { integration } = await runSetup({
      root,
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const routeSetup = integration.hooks['astro:route:setup'];
    assert.ok(routeSetup);
    const setup = async (component: string, prerender: boolean) =>
      routeSetup({
        route: { component, prerender },
        logger: silentLogger(),
      });
    await assert.rejects(
      () => setup('src/views/missing.astro', false),
      /fallback view exports prerender = false/,
    );
    await setup('src/views/blog.astro', false);
    await setup('src/views/missing.astro', true);
    await setup('src/views/post.astro', false);
    await setup('src/views/about.astro', false);
  });

  it('refuses an on-demand {page} route that matches a {slug} route', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request');
    const { injected, integration } = await runSetup({
      root,
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const page = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[page]'),
      pattern: '/en/blog/[page]',
      isPrerendered: false,
    });
    const slug = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[slug]'),
      pattern: '/en/blog/[slug]',
      isPrerendered: false,
    });
    await assert.rejects(
      () => resolveRoutes(integration, [slug, page]),
      /row \d[\s\S]*Give pagination its own view[\s\S]*row's view[\s\S]*pagination\.slug[\s\S]*blog\/page\/\{page\}/,
    );
    const pageOne = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[...page]'),
      pattern: '/en/blog/[...page]',
      isPrerendered: false,
    });
    const prerendered = resolvedRoute({
      entrypoint: page.entrypoint,
      pattern: '/en/blog/[page]',
      isPrerendered: true,
    });
    await resolveRoutes(integration, [slug, pageOne, siteRootRoute()]);
    await resolveRoutes(integration, [slug, prerendered, siteRootRoute()]);
  });

  it('boots an on-demand {page} route that has its own segment', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request', {
      en: 'blog/page/{page}',
      de: 'artikel/seite/{page}',
    });
    const { injected, integration } = await runSetup({
      root,
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const listings = injected.filter((call) => call.entrypoint.endsWith(`${path.sep}blog.astro`));
    assert.ok(listings.length >= 2);
    for (const call of listings) assert.equal(call.prerender, false, call.pattern);
    assert.ok(listings.some((call) => call.pattern === '/en/blog/page/[page]'));
    const numbered = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/page/[page]'),
      pattern: '/en/blog/page/[page]',
      isPrerendered: false,
    });
    const slug = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[slug]'),
      pattern: '/en/blog/[slug]',
      isPrerendered: false,
    });
    await resolveRoutes(integration, [slug, numbered, siteRootRoute()]);
  });

  it('rejects a top-level pageSize and a {page} token on the row slug', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, view: 'blog' },
  ],
  collections: { blog: { slugField: 'slug' } },
};
`,
    );
    await assert.rejects(() => runSetup({ root }), /pageSize moved to pagination\.pageSize/);

    const tokenRoot = await makeRoot();
    await writeIntlConfig(
      path.join(tokenRoot, 'src'),
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: 'blog/{page}', de: 'artikel/{page}' }, collection: 'blog', view: 'blog' },
  ],
  collections: { blog: { slugField: 'slug' } },
};
`,
    );
    await assert.rejects(
      () => runSetup({ root: tokenRoot }),
      /\{page\} belongs in pagination\.slug/,
    );
  });

  it('uses pagination.view for the numbered route and skips the clash when that view is prerendered', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  viewRendering: 'request',
  routes: [
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post' },
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
  collections: { blog: { slugField: 'slug' } },
};
`,
    );
    const viewsDir = path.join(srcDir, 'views');
    await mkdir(viewsDir, { recursive: true });
    for (const name of ['post.astro', 'blog.astro', 'archive.astro']) {
      await writeFile(path.join(viewsDir, name), '');
    }
    const { injected, integration } = await runSetup({
      root,
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const page = entrypointFor(injected, '/en/blog/[page]');
    const pageOne = entrypointFor(injected, '/en/blog/[...page]');
    assert.ok(page.endsWith(`${path.sep}archive.astro`));
    assert.ok(pageOne.endsWith(`${path.sep}blog.astro`));
    const slug = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[slug]'),
      pattern: '/en/blog/[slug]',
      isPrerendered: false,
    });
    await resolveRoutes(integration, [
      slug,
      resolvedRoute({ entrypoint: pageOne, pattern: '/en/blog/[...page]', isPrerendered: false }),
      resolvedRoute({ entrypoint: page, pattern: '/en/blog/[page]', isPrerendered: true }),
      siteRootRoute(),
    ]);
    await assert.rejects(
      () =>
        resolveRoutes(integration, [
          slug,
          resolvedRoute({ entrypoint: page, pattern: '/en/blog/[page]', isPrerendered: false }),
        ]),
      /Give pagination its own view[\s\S]*row's view[\s\S]*pagination\.slug/,
    );
  });

  it('aborts when pagination.view is missing or names both files', async () => {
    const missingRoot = await makeRoot();
    const missingSrc = path.join(missingRoot, 'src');
    await writeIntlConfig(
      missingSrc,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    {
      slug: { en: 'blog', de: 'artikel' },
      collection: 'blog',
      view: 'blog',
      pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' }, view: 'archive' },
    },
  ],
  collections: { blog: {} },
};
`,
    );
    const missingViews = path.join(missingSrc, 'views');
    await mkdir(missingViews, { recursive: true });
    await writeFile(path.join(missingViews, 'blog.astro'), '');
    await assert.rejects(
      () => runSetup({ root: missingRoot }),
      /view "archive" has no file under src\/views\//,
    );

    const bothRoot = await makeRoot();
    const bothSrc = path.join(bothRoot, 'src');
    await writeIntlConfig(
      bothSrc,
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    {
      slug: { en: 'blog', de: 'artikel' },
      collection: 'blog',
      view: 'blog',
      pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' }, view: 'archive' },
    },
  ],
  collections: { blog: {} },
};
`,
    );
    const bothViews = path.join(bothSrc, 'views');
    await mkdir(path.join(bothViews, 'archive'), { recursive: true });
    await writeFile(path.join(bothViews, 'blog.astro'), '');
    await writeFile(path.join(bothViews, 'archive.astro'), '');
    await writeFile(path.join(bothViews, 'archive', 'index.astro'), '');
    await assert.rejects(
      () => runSetup({ root: bothRoot }),
      /view "archive" has both "archive\.astro" and "archive\/index\.astro"/,
    );
  });

  it('treats viewRendering request as build under astro dev', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request');
    const { injected } = await runSetup({ root, command: 'dev' });
    assert.ok(injected.length > 0);
    assert.equal(
      injected.some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('does not abort when a listing view exports prerender = false under astro dev', async () => {
    const root = await makeRoot();
    await writeRenderingRoutes(root, 'request');
    const { injected, integration } = await runSetup({ root, command: 'dev' });
    const page = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[page]'),
      pattern: '/en/blog/[page]',
      isPrerendered: false,
    });
    const slug = resolvedRoute({
      entrypoint: entrypointFor(injected, '/en/blog/[slug]'),
      pattern: '/en/blog/[slug]',
      isPrerendered: false,
    });
    await resolveRoutes(integration, [slug, page, siteRootRoute()]);
  });

  it('aborts when the prefix is on and nothing serves /', async () => {
    const root = await makeRoot();
    await writeIntlConfig(path.join(root, 'src'));
    const { integration } = await runSetup({ root });
    await assert.rejects(
      () => resolveRoutes(integration, []),
      /nothing serves "\/"\. Add a redirect in defineConfig \(redirects: \{ '\/': '\/en\/' \}\)/,
    );
  });

  it('resolves when the prefix is on and a redirect serves /', async () => {
    const root = await makeRoot();
    await writeIntlConfig(path.join(root, 'src'));
    const { integration } = await runSetup({ root });
    await resolveRoutes(integration, [siteRootRoute()]);
  });

  it('resolves when the prefix is off and nothing serves /', async () => {
    const root = await makeRoot();
    await writeIntlConfig(
      path.join(root, 'src'),
      `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: false },
};
`,
    );
    const { integration } = await runSetup({ root });
    await resolveRoutes(integration, []);
  });
});

async function writeRenderingRoutes(
  root: string,
  viewRendering: 'build' | 'request',
  page: { en: string; de: string } = { en: 'blog/{page}', de: 'artikel/{page}' },
) {
  const srcDir = path.join(root, 'src');
  await writeIntlConfig(
    srcDir,
    `export default {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  viewRendering: '${viewRendering}',
  routes: [
    { slug: { en: 'about', de: 'ueber' }, view: 'about' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post', fallbackView: 'missing' },
    {
      slug: { en: 'blog', de: 'artikel' },
      collection: 'blog',
      view: 'blog',
      pagination: { pageSize: 10, slug: { en: '${page.en}', de: '${page.de}' } },
    },
  ],
  collections: { blog: { slugField: 'slug' } },
};
`,
  );
  const viewsDir = path.join(srcDir, 'views');
  await mkdir(viewsDir, { recursive: true });
  for (const name of ['about.astro', 'post.astro', 'blog.astro', 'missing.astro']) {
    await writeFile(path.join(viewsDir, name), '');
  }
}
