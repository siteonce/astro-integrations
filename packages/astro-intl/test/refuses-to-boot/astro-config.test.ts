import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import type { AstroIntegration } from 'astro';
import {
  type IntlHooks,
  type IntlSetupOptions,
  intlHooks,
  resolvedRoute,
  siteRootRoute,
} from '../astro.ts';
import { type IntlConfigInput, intlConfig } from '../fixtures.ts';

const sitemapIntegration = { name: '@astrojs/sitemap', hooks: {} } as AstroIntegration;
const intlIntegration = { name: '@repo/astro-intl', hooks: {} } as AstroIntegration;

/** What `intlConfig()` writes into Astro `i18n` when setup finishes. */
const writtenI18n = {
  defaultLocale: 'en',
  locales: ['en', 'de'],
  routing: {
    prefixDefaultLocale: true,
    redirectToDefaultLocale: false,
    fallbackType: 'redirect',
  },
};

const nothingServesRoot =
  '@repo/astro-intl: prefixDefaultLocale is true, and nothing serves "/". ' +
  `Add a redirect in defineConfig (redirects: { '/': '/en/' }) or a ${['src', 'pages', 'index'].join('/')} file.`;

/**
 * Sitemap `i18n` is read from this file under the project root.
 * It is the first name the check opens.
 */
async function writeAstroConfig(root: string, source: string): Promise<void> {
  await writeFile(join(root, 'astro.config.mjs'), source);
}

/**
 * The integration list has to name `@astrojs/sitemap`, or the config file is not read.
 */
async function bootSitemap(
  t: TestContext,
  source: string,
  integrations: AstroIntegration[],
): Promise<IntlHooks> {
  const hooks = await intlHooks(t, intlConfig());
  await writeAstroConfig(hooks.root, source);
  await hooks.setup({ integrations });
  return hooks;
}

async function boot(t: TestContext, config: IntlConfigInput, options?: IntlSetupOptions) {
  const hooks = await intlHooks(t, config);
  await hooks.setup(options);
  return hooks;
}

describe('overlapping i18n keys are already set on defineConfig', () => {
  it('refuses to boot', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await assert.rejects(
      () =>
        hooks.setup({
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
      { message: '@repo/astro-intl: overlapping i18n keys are already set on defineConfig.' },
    );
    assert.deepEqual(hooks.updates, []);
  });
});

describe('@astrojs/sitemap is registered before intl', () => {
  it('refuses to boot', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await assert.rejects(
      () => hooks.setup({ integrations: [sitemapIntegration, intlIntegration] }),
      {
        message:
          '@repo/astro-intl: @astrojs/sitemap is registered before @repo/astro-intl. List intl first.',
      },
    );
    assert.deepEqual(hooks.updates, []);
  });

  it('boots when intl is listed first and sitemap() sets no i18n', async (t) => {
    const hooks = await bootSitemap(
      t,
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap()] };
`,
      [intlIntegration, sitemapIntegration],
    );
    assert.deepEqual(hooks.updates, [{ i18n: writtenI18n }]);
  });
});

describe("@astrojs/sitemap's i18n option is set", () => {
  it('refuses when astro.config.mjs calls sitemap({ i18n })', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await writeAstroConfig(
      hooks.root,
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })] };
`,
    );
    await assert.rejects(() => hooks.setup({ integrations: [sitemapIntegration] }), {
      message: '@repo/astro-intl: @astrojs/sitemap i18n option is set.',
    });
    assert.deepEqual(hooks.updates, []);
  });

  it('boots when sitemap() passes a filter and no i18n key', async (t) => {
    const hooks = await bootSitemap(
      t,
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap({ filter: (page) => true })] };
`,
      [intlIntegration, sitemapIntegration],
    );
    assert.deepEqual(hooks.updates, [{ i18n: writtenI18n }]);
  });

  it('boots when a later i18n binding is not the sitemap option', async (t) => {
    const hooks = await bootSitemap(
      t,
      `import sitemap from '@astrojs/sitemap';
export default { integrations: [sitemap()] };
const i18n = { defaultLocale: 'en' };
`,
      [intlIntegration, sitemapIntegration],
    );
    assert.deepEqual(hooks.updates, [{ i18n: writtenI18n }]);
  });

  it('boots when i18n appears only in a comment', async (t) => {
    const hooks = await bootSitemap(
      t,
      `import sitemap from '@astrojs/sitemap';
// sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })
export default { integrations: [sitemap()] };
`,
      [intlIntegration, sitemapIntegration],
    );
    assert.deepEqual(hooks.updates, [{ i18n: writtenI18n }]);
  });
});

describe('viewRendering is "request" and the site has no adapter, outside astro dev', () => {
  it('refuses to boot', async (t) => {
    const hooks = await intlHooks(t, intlConfig({ viewRendering: 'request' }));
    await assert.rejects(() => hooks.setup({ command: 'build' }), {
      message: '@repo/astro-intl: viewRendering is "request" and the site has no adapter.',
    });
    assert.deepEqual(hooks.updates, []);
  });
});

describe('prefixDefaultLocale is true and nothing serves /', () => {
  it('refuses when no route serves /', async (t) => {
    const hooks = await boot(t, intlConfig());
    await assert.rejects(() => hooks.routesResolved([]), { message: nothingServesRoot });
  });

  it('refuses when only locale-prefixed routes exist', async (t) => {
    const hooks = await boot(t, intlConfig());
    await assert.rejects(
      () =>
        hooks.routesResolved([
          resolvedRoute({
            entrypoint: join('src', 'pages', 'en', 'index.astro'),
            pattern: '/en/',
            isPrerendered: true,
            origin: 'project',
            patternRegex: /^\/en\/$/u,
          }),
          resolvedRoute({
            entrypoint: join('src', 'pages', 'de', 'index.astro'),
            pattern: '/de/',
            isPrerendered: true,
            origin: 'project',
            patternRegex: /^\/de\/$/u,
          }),
        ]),
      { message: nothingServesRoot },
    );
  });

  it('boots when a page or a redirect serves /', async (t) => {
    const hooks = await boot(t, intlConfig());
    await hooks.routesResolved([siteRootRoute()]);
    await hooks.routesResolved([
      resolvedRoute({
        entrypoint: join('src', 'pages', 'index.astro'),
        pattern: '/',
        isPrerendered: true,
        origin: 'project',
        type: 'page',
        patternRegex: /^\/$/u,
      }),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('boots when the prefix is off and nothing serves /', async (t) => {
    const hooks = await boot(t, intlConfig({ routing: { prefixDefaultLocale: false } }));
    await hooks.routesResolved([]);
    assert.equal(hooks.error, undefined);
  });
});
