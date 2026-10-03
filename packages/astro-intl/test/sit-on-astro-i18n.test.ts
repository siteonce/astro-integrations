import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { defineIntl } from '@repo/astro-intl';
import type { AstroIntegration } from 'astro';
import { intlHooks } from './astro.ts';
import { type IntlConfigInput, intlConfig } from './fixtures.ts';

const localeUnion = `declare module '@repo/astro-intl' {
  interface IntlRegister {
    locale: "en" | "de";
  }
}
export {};
`;

const collectionEntries = `declare module '@repo/astro-intl' {
  interface IntlRegister {
    locale: "en" | "de";
    entries: { [C in "posts" | "sources"]: import('astro:content').CollectionEntry<C> };
  }
}
export {};
`;

const escapedLocale = `declare module '@repo/astro-intl' {
  interface IntlRegister {
    locale: "en" | "a\\"b";
  }
}
export {};
`;

/**
 * View routes from `astro:config:setup` under `preview`.
 * `preview` applies `viewRendering` and does not inject the sitemap data route.
 * `prerender` is present only when the integration set it.
 */
async function viewRoutes(
  t: TestContext,
  config: IntlConfigInput,
  adapter?: AstroIntegration,
): Promise<{ pattern: string; prerender?: boolean }[]> {
  const hooks = await intlHooks(t, config);
  const file = join(hooks.root, 'src', 'views', 'about.astro');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, '');
  await hooks.setup({ command: 'preview', adapter });
  return hooks.injected.map((route) =>
    Object.hasOwn(route, 'prerender')
      ? { pattern: route.pattern, prerender: route.prerender }
      : { pattern: route.pattern },
  );
}

function aboutConfig(viewRendering?: 'build' | 'request'): IntlConfigInput {
  return intlConfig({
    ...(viewRendering === undefined ? {} : { viewRendering }),
    routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
  });
}

describe('sit on Astro i18n', () => {
  it('writes an omitted prefixDefaultLocale as false', async (t) => {
    const omittedRouting = await intlHooks(
      t,
      defineIntl({ locales: ['en', 'de'], defaultLocale: 'en' }),
    );
    await omittedRouting.setup();

    const omittedFlag = await intlHooks(
      t,
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: {},
      }),
    );
    await omittedFlag.setup();

    const i18n = {
      defaultLocale: 'en',
      locales: ['en', 'de'],
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: false,
        fallbackType: 'redirect',
      },
    };
    assert.deepEqual(omittedRouting.updates, [{ i18n }]);
    assert.deepEqual(omittedFlag.updates, [{ i18n }]);
  });

  it('writes an explicit prefix into Astro i18n', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await hooks.setup();
    assert.deepEqual(hooks.updates, [
      {
        i18n: {
          defaultLocale: 'en',
          locales: ['en', 'de'],
          routing: {
            prefixDefaultLocale: true,
            redirectToDefaultLocale: false,
            fallbackType: 'redirect',
          },
        },
      },
    ]);
  });

  it('writes redirectToDefaultLocale into Astro i18n', async (t) => {
    const hooks = await intlHooks(t, {
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false, redirectToDefaultLocale: true },
    });
    await hooks.setup();
    assert.deepEqual(hooks.updates, [
      {
        i18n: {
          defaultLocale: 'en',
          locales: ['en'],
          routing: {
            prefixDefaultLocale: false,
            redirectToDefaultLocale: true,
            fallbackType: 'redirect',
          },
        },
      },
    ]);
  });

  it('injects the locale union and omits entries when no collection is named', async (t) => {
    const hooks = await intlHooks(t, defineIntl({ locales: ['en', 'de'], defaultLocale: 'en' }));
    await hooks.configDone();
    assert.deepEqual(hooks.types, [{ filename: 'intl-locales.d.ts', content: localeUnion }]);
  });

  it('injects a CollectionEntry for each named collection', async (t) => {
    const hooks = await intlHooks(
      t,
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        collections: { translated: ['posts'], untranslated: ['sources'] },
      }),
    );
    await hooks.configDone();
    assert.deepEqual(hooks.types, [{ filename: 'intl-locales.d.ts', content: collectionEntries }]);
  });

  it('escapes a quote in an injected locale literal', async (t) => {
    const hooks = await intlHooks(t, defineIntl({ locales: ['en', 'a"b'], defaultLocale: 'en' }));
    await hooks.configDone();
    assert.deepEqual(hooks.types, [{ filename: 'intl-locales.d.ts', content: escapedLocale }]);
  });

  it('prerenders injected views when viewRendering is omitted or build', async (t) => {
    const prerendered = [{ pattern: '/en/about/[...index]' }, { pattern: '/de/ueber/[...index]' }];
    assert.deepEqual(await viewRoutes(t, aboutConfig()), prerendered);
    assert.deepEqual(await viewRoutes(t, aboutConfig('build')), prerendered);
  });

  it('renders injected views on demand when viewRendering is request', async (t) => {
    const adapter = { name: '@astrojs/node', hooks: {} } as AstroIntegration;
    assert.deepEqual(await viewRoutes(t, aboutConfig('request'), adapter), [
      { pattern: '/en/about/[...index]', prerender: false },
      { pattern: '/de/ueber/[...index]', prerender: false },
    ]);
  });
});
