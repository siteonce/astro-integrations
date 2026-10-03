import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl } from '@repo/astro-intl';
import { intlHooks } from './astro.ts';
import { intlConfig } from './fixtures.ts';

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
});
