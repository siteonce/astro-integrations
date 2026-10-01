import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { IntlConfigInput } from './define-intl.ts';
import astroIntl from './integration.ts';
import { SITEMAP_DATA_PATH } from './sitemap.ts';

type InjectedCall = {
  pattern: string;
  entrypoint: string;
  prerender?: boolean;
};

type Setup = NonNullable<AstroIntegration['hooks']['astro:config:setup']>;
type SetupParams = Parameters<Setup>[0];
type Done = NonNullable<AstroIntegration['hooks']['astro:config:done']>;
type DoneParams = Parameters<Done>[0];

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'astro-intl-'));
  tempRoots.push(root);
  return root;
}

function prefixed(extra: Partial<IntlConfigInput> = {}): IntlConfigInput {
  return {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    ...extra,
  };
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

function viewRoutes(injected: InjectedCall[]): InjectedCall[] {
  return injected.filter((call) => call.pattern !== SITEMAP_DATA_PATH);
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
  config: IntlConfigInput;
  srcDir?: string;
  i18n?: AstroConfig['i18n'];
  integrations?: AstroIntegration[];
  adapter?: AstroIntegration;
  command?: 'dev' | 'build' | 'preview' | 'sync';
  base?: string;
}): Promise<{
  config: Record<string, unknown>;
  injected: InjectedCall[];
  integration: AstroIntegration;
}> {
  const srcDir = options.srcDir ?? path.join(options.root, 'src');
  const updates: Record<string, unknown>[] = [];
  const injected: InjectedCall[] = [];
  const codegenDir = path.join(options.root, '.astro', 'integrations', 'astro-intl');
  await mkdir(codegenDir, { recursive: true });
  const integration = astroIntl(options.config);
  const setup = integration.hooks['astro:config:setup'];
  assert.ok(setup, 'astro:config:setup hook is registered');
  await setup({
    command: options.command ?? 'build',
    config: {
      root: pathToFileURL(`${options.root}/`),
      srcDir: pathToFileURL(`${srcDir}/`),
      base: options.base,
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
    createCodegenDir() {
      return pathToFileURL(`${codegenDir}/`);
    },
    logger: silentLogger(),
  } as unknown as SetupParams);
  assert.ok(updates[0], 'updateConfig was called');
  return { config: updates[0], injected, integration };
}

describe('astroIntl()', () => {
  it('throws the prettified Zod error for an invalid config', () => {
    assert.throws(
      () =>
        astroIntl({
          locales: ['en'],
          defaultLocale: 'en',
          routing: { prefixDefaultLocale: 'no' },
        } as unknown as IntlConfigInput),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^@repo\/astro-intl: intl config failed validation\.\n/);
        assert.match(error.message, /expected boolean, received string/);
        assert.match(error.message, /routing\.prefixDefaultLocale/);
        return true;
      },
    );
  });

  it('injects the locale union on astro:config:done', () => {
    const integration = astroIntl({ locales: ['en', 'de'], defaultLocale: 'en' });
    const hook = integration.hooks['astro:config:done'];
    assert.ok(hook);
    const injected: { filename: string; content: string }[] = [];
    hook({
      injectTypes(entry: { filename: string; content: string }) {
        injected.push(entry);
        return new URL('file:///tmp/intl-locales.d.ts');
      },
      logger: silentLogger(),
    } as unknown as DoneParams);
    assert.deepEqual(injected, [
      {
        filename: 'intl-locales.d.ts',
        content: [
          "declare module '@repo/astro-intl' {",
          '  interface IntlRegister {',
          '    locale: "en" | "de";',
          '  }',
          '}',
          'export {};',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('json-escapes locale literals in the injected augmentation', () => {
    const integration = astroIntl({ locales: ['en', 'a"b'], defaultLocale: 'en' });
    const hook = integration.hooks['astro:config:done'];
    assert.ok(hook);
    const injected: { filename: string; content: string }[] = [];
    hook({
      injectTypes(entry: { filename: string; content: string }) {
        injected.push(entry);
        return new URL('file:///tmp/intl-locales.d.ts');
      },
      logger: silentLogger(),
    } as unknown as DoneParams);
    assert.equal(injected[0]?.filename, 'intl-locales.d.ts');
    assert.match(injected[0]?.content ?? '', /locale: "en" \| "a\\"b";/);
  });

  it('writes an omitted prefix as false in Astro i18n', async () => {
    const root = await makeRoot();
    const { config } = await runSetup({
      root,
      config: { locales: ['en', 'de'], defaultLocale: 'en' },
    });
    assert.deepEqual(config.i18n, {
      defaultLocale: 'en',
      locales: ['en', 'de'],
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: false,
        fallbackType: 'redirect',
      },
    });
  });

  it('writes Astro i18n from the passed config', async () => {
    const root = await makeRoot();
    const { config } = await runSetup({ root, config: prefixed() });
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
    const { config } = await runSetup({
      root,
      config: {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: false, redirectToDefaultLocale: true },
      },
    });
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

  it('aborts when overlapping i18n keys are already set on defineConfig', async () => {
    const root = await makeRoot();
    await assert.rejects(
      () =>
        runSetup({
          root,
          config: prefixed(),
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
    await writeFile(
      path.join(root, 'astro.config.mjs'),
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap()] };
`,
    );
    const intl = { name: '@repo/astro-intl', hooks: {} } as AstroIntegration;
    const sitemap = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
    const { config } = await runSetup({
      root,
      config: prefixed(),
      integrations: [intl, sitemap],
    });
    assert.equal((config.i18n as { defaultLocale: string }).defaultLocale, 'en');
  });

  it('aborts when @astrojs/sitemap is listed before intl', async () => {
    const root = await makeRoot();
    const sitemap = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
    const intl = { name: '@repo/astro-intl', hooks: {} } as AstroIntegration;
    await assert.rejects(
      () =>
        runSetup({
          root,
          config: prefixed(),
          integrations: [sitemap, intl],
        }),
      /@astrojs\/sitemap is registered before @repo\/astro-intl/,
    );
  });

  it('aborts when astro.config sets sitemap({ i18n })', async () => {
    const root = await makeRoot();
    await writeFile(
      path.join(root, 'astro.config.mjs'),
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })] };
`,
    );
    const sitemap = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
    await assert.rejects(
      () => runSetup({ root, config: prefixed(), integrations: [sitemap] }),
      /sitemap i18n option is set/,
    );
  });

  it('fails startup when the content config imports @repo/astro-intl/runtime', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, 'content.config.ts'),
      "import { locales } from '@repo/astro-intl/runtime';\n",
    );
    await assert.rejects(
      () => runSetup({ root, config: prefixed() }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          '@repo/astro-intl: src/content.config.ts imports @repo/astro-intl/runtime. ' +
            'Astro loads the content config before page modules exist, so astro:config/server is unavailable there. ' +
            'Read locales from your intl config instead.',
        );
        return true;
      },
    );
  });

  it('allows a content config that imports @repo/astro-intl', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, 'content.config.ts'),
      "import { id, locale } from '@repo/astro-intl';\nexport { id, locale };\n",
    );
    const { config } = await runSetup({ root, config: prefixed() });
    assert.equal((config.i18n as { defaultLocale: string }).defaultLocale, 'en');
  });

  it('injects one route per compiled row and locale', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    const viewsDir = path.join(srcDir, 'views');
    await mkdir(viewsDir, { recursive: true });
    for (const name of ['about.astro', 'post.astro', 'blog.astro', 'missing.astro']) {
      await writeFile(path.join(viewsDir, name), '');
    }

    const resolvedSrc = fileURLToPath(pathToFileURL(`${srcDir}/`));
    const view = (name: string) => path.join(resolvedSrc, 'views', `${name}.astro`);
    const { injected } = await runSetup({
      root,
      config: prefixed({
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
            pagination: {
              pageSize: 10,
              slug: { en: 'blog/{page}', de: 'artikel/{page}' },
            },
          },
        ],
        collections: { translated: ['blog'] },
      }),
    });

    assert.deepEqual(
      viewRoutes(injected).map(({ pattern, entrypoint }) => ({ pattern, entrypoint })),
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
      viewRoutes(injected).some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('keeps an entry row from the passed config', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await mkdir(path.join(srcDir, 'views'), { recursive: true });
    await writeFile(path.join(srcDir, 'views', 'about.astro'), '');

    const { injected } = await runSetup({
      root,
      config: prefixed({
        routes: [
          {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
            collection: { name: 'pages', entry: 'about' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
    });
    assert.deepEqual(
      viewRoutes(injected).map(({ pattern }) => pattern),
      ['/en/about/[...index]', '/de/ueber/[...index]'],
    );
  });

  it('aborts setup when a view file is missing', async () => {
    const root = await makeRoot();
    await assert.rejects(
      () =>
        runSetup({
          root,
          config: prefixed({
            routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'missing' }],
          }),
        }),
      /view "missing" has no file under src\/views\//,
    );
  });

  it('aborts when viewRendering is request and the site has no adapter', async () => {
    const root = await makeRoot();
    await assert.rejects(
      () => runSetup({ root, config: prefixed({ viewRendering: 'request' }) }),
      /no adapter/,
    );
  });

  it('gives prerender: false to every injected route except fallback', async () => {
    const root = await makeRoot();
    await writeRenderingViews(root);
    const { injected } = await runSetup({
      root,
      config: renderingConfig('request'),
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
    for (const call of viewRoutes(injected)) {
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
    await writeRenderingViews(root);
    const { injected } = await runSetup({ root, config: renderingConfig('build') });
    const views = viewRoutes(injected);
    assert.ok(views.length > 0);
    assert.equal(
      views.some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('aborts when a fallback view exports prerender = false', async () => {
    const root = await makeRoot();
    await writeRenderingViews(root);
    const { integration } = await runSetup({
      root,
      config: renderingConfig('request'),
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
    await writeRenderingViews(root);
    const { injected, integration } = await runSetup({
      root,
      config: renderingConfig('request'),
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
    await writeRenderingViews(root);
    const { injected, integration } = await runSetup({
      root,
      config: renderingConfig('request', {
        en: 'blog/page/{page}',
        de: 'artikel/seite/{page}',
      }),
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
    await assert.rejects(
      () =>
        runSetup({
          root,
          config: prefixed({
            routes: [
              {
                slug: { en: 'blog', de: 'artikel' },
                collection: 'blog',
                pageSize: 10,
                view: 'blog',
              },
            ],
            collections: { translated: ['blog'] },
          } as unknown as IntlConfigInput),
        }),
      /pageSize moved to pagination\.pageSize/,
    );

    const tokenRoot = await makeRoot();
    await assert.rejects(
      () =>
        runSetup({
          root: tokenRoot,
          config: prefixed({
            routes: [
              {
                slug: { en: 'blog/{page}', de: 'artikel/{page}' },
                collection: 'blog',
                view: 'blog',
              },
            ],
            collections: { translated: ['blog'] },
          }),
        }),
      /\{page\} belongs in pagination\.slug/,
    );
  });

  it('uses pagination.view for the numbered route and skips the clash when that view is prerendered', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    const viewsDir = path.join(srcDir, 'views');
    await mkdir(viewsDir, { recursive: true });
    for (const name of ['post.astro', 'blog.astro', 'archive.astro']) {
      await writeFile(path.join(viewsDir, name), '');
    }
    const { injected, integration } = await runSetup({
      root,
      config: prefixed({
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
    const missingViews = path.join(missingSrc, 'views');
    await mkdir(missingViews, { recursive: true });
    await writeFile(path.join(missingViews, 'blog.astro'), '');
    await assert.rejects(
      () =>
        runSetup({
          root: missingRoot,
          config: prefixed({
            routes: [
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
        }),
      /view "archive" has no file under src\/views\//,
    );

    const bothRoot = await makeRoot();
    const bothSrc = path.join(bothRoot, 'src');
    const bothViews = path.join(bothSrc, 'views');
    await mkdir(path.join(bothViews, 'archive'), { recursive: true });
    await writeFile(path.join(bothViews, 'blog.astro'), '');
    await writeFile(path.join(bothViews, 'archive.astro'), '');
    await writeFile(path.join(bothViews, 'archive', 'index.astro'), '');
    await assert.rejects(
      () =>
        runSetup({
          root: bothRoot,
          config: prefixed({
            routes: [
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
        }),
      /view "archive" has both "archive\.astro" and "archive\/index\.astro"/,
    );
  });

  it('treats viewRendering request as build under astro dev', async () => {
    const root = await makeRoot();
    await writeRenderingViews(root);
    const { injected } = await runSetup({
      root,
      config: renderingConfig('request'),
      command: 'dev',
    });
    assert.ok(injected.length > 0);
    assert.equal(
      injected.some((call) => Object.hasOwn(call, 'prerender')),
      false,
    );
  });

  it('does not abort when a listing view exports prerender = false under astro dev', async () => {
    const root = await makeRoot();
    await writeRenderingViews(root);
    const { injected, integration } = await runSetup({
      root,
      config: renderingConfig('request'),
      command: 'dev',
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
    await resolveRoutes(integration, [slug, page, siteRootRoute()]);
  });

  it('aborts when the prefix is on and nothing serves /', async () => {
    const root = await makeRoot();
    const { integration } = await runSetup({ root, config: prefixed() });
    await assert.rejects(
      () => resolveRoutes(integration, []),
      /nothing serves "\/"\. Add a redirect in defineConfig \(redirects: \{ '\/': '\/en\/' \}\)/,
    );
  });

  it('resolves when the prefix is on and a redirect serves /', async () => {
    const root = await makeRoot();
    const { integration } = await runSetup({ root, config: prefixed() });
    await resolveRoutes(integration, [siteRootRoute()]);
  });

  it('resolves when the prefix is off and nothing serves /', async () => {
    const root = await makeRoot();
    const { integration } = await runSetup({
      root,
      config: {
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: false },
      },
    });
    await resolveRoutes(integration, []);
  });

  it('injects the sitemap data route only for build', async () => {
    for (const command of ['dev', 'preview', 'sync'] as const) {
      const root = await makeRoot();
      const { injected } = await runSetup({ root, config: prefixed(), command });
      assert.equal(
        injected.some((call) => call.pattern === SITEMAP_DATA_PATH),
        false,
        command,
      );
    }

    const root = await makeRoot();
    const config = prefixed({ fallbackView: 'missing' });
    const { injected } = await runSetup({ root, config, command: 'build' });
    const data = injected.find((call) => call.pattern === SITEMAP_DATA_PATH);
    assert.ok(data);
    assert.equal(data.prerender, true);
    const source = await readFile(data.entrypoint, 'utf8');
    const createIntlUrl = new URL('./create-intl.ts', import.meta.url).href;
    assert.ok(source.includes(`from ${JSON.stringify(createIntlUrl)}`));
    assert.ok(source.includes(`createIntl(${JSON.stringify(config)})`));
    assert.match(source, /export const prerender = true/);
    assert.match(source, /JSON\.stringify\(await intl\.getSitemapEntries\(\)\)/);
  });

  it('prerenders the data route when viewRendering is request', async () => {
    const root = await makeRoot();
    await writeRenderingViews(root);
    const { injected } = await runSetup({
      root,
      config: renderingConfig('request'),
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });
    const data = injected.find((call) => call.pattern === SITEMAP_DATA_PATH);
    assert.equal(data?.prerender, true);
  });

  it('aborts startup when the intl config does not survive a JSON round trip', async () => {
    const root = await makeRoot();
    await assert.rejects(
      () =>
        runSetup({
          root,
          config: {
            locales: ['en'],
            defaultLocale: 'en',
            routing: { prefixDefaultLocale: () => true },
          } as unknown as IntlConfigInput,
        }),
      /does not survive a JSON round trip at "routing\.prefixDefaultLocale"/,
    );
  });

  it('does not abort startup when an intl config key is undefined', async () => {
    const root = await makeRoot();
    const { config } = await runSetup({
      root,
      config: {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: undefined },
      },
    });
    assert.deepEqual(config.i18n, {
      defaultLocale: 'en',
      locales: ['en'],
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: false,
        fallbackType: 'redirect',
      },
    });
  });
});

function renderingConfig(
  viewRendering: 'build' | 'request',
  page: { en: string; de: string } = { en: 'blog/{page}', de: 'artikel/{page}' },
): IntlConfigInput {
  return prefixed({
    viewRendering,
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
        pagination: { pageSize: 10, slug: { en: page.en, de: page.de } },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

async function writeRenderingViews(root: string): Promise<void> {
  const viewsDir = path.join(root, 'src', 'views');
  await mkdir(viewsDir, { recursive: true });
  for (const name of ['about.astro', 'post.astro', 'blog.astro', 'missing.astro']) {
    await writeFile(path.join(viewsDir, name), '');
  }
}
