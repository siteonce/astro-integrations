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

async function writeCatalogs(
  srcDir: string,
  locales: string[],
  messagesDir = 'messages',
): Promise<void> {
  const dir = path.join(srcDir, messagesDir);
  await mkdir(dir, { recursive: true });
  for (const locale of locales) {
    await writeFile(path.join(dir, `${locale}.json`), `${JSON.stringify({ ok: locale })}\n`);
  }
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
}): Promise<{ config: Record<string, unknown>; injected: InjectedCall[] }> {
  const srcDir = options.srcDir ?? path.join(options.root, 'src');
  const updates: Record<string, unknown>[] = [];
  const injected: InjectedCall[] = [];
  const integration = astroIntl();
  const setup = integration.hooks['astro:config:setup'];
  assert.ok(setup, 'astro:config:setup hook is registered');
  await setup({
    config: {
      root: pathToFileURL(`${options.root}/`),
      srcDir: pathToFileURL(`${srcDir}/`),
      i18n: options.i18n,
      integrations: options.integrations ?? [],
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
  return { config: updates[0], injected };
}

describe('astroIntl()', () => {
  it('writes Astro i18n from src/intl.config.ts', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await writeCatalogs(srcDir, ['en', 'de']);

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

  it('honors messages.dir and redirectToDefaultLocale', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(
      srcDir,
      `export default {
  locales: ['en'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: false, redirectToDefaultLocale: true },
  messages: { dir: 'i18n-messages' },
};
`,
    );
    await writeCatalogs(srcDir, ['en'], 'i18n-messages');

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

  it('aborts when a configured locale has no catalog file', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await writeCatalogs(srcDir, ['en']);
    await assert.rejects(() => runSetup({ root }), /catalog file for locale "de" not found/);
  });

  it('aborts when overlapping i18n keys are already set on defineConfig', async () => {
    const root = await makeRoot();
    const srcDir = path.join(root, 'src');
    await writeIntlConfig(srcDir);
    await writeCatalogs(srcDir, ['en', 'de']);
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
    await writeCatalogs(srcDir, ['en', 'de']);
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
    await writeCatalogs(srcDir, ['en', 'de']);
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
    await writeCatalogs(srcDir, ['en', 'de']);
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
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog', view: 'post', missingView: 'missing' },
    { slug: { en: 'blog', de: 'artikel' }, collection: 'blog', pageSize: 10, view: 'blog' },
  ],
  collections: { blog: { slugField: 'slug' } },
};
`,
    );
    await writeCatalogs(srcDir, ['en', 'de']);
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
    await writeCatalogs(srcDir, ['en', 'de']);
    await assert.rejects(() => runSetup({ root }), /view "missing" has no file under src\/views\//);
  });
});
