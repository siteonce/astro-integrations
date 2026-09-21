import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { missingLocaleChain } from './missing-locale.ts';

const hrefFor = (locale: string, path?: string) => (path ? `/${locale}/${path}/` : `/${locale}/`);

describe('missingLocaleChain', () => {
  it('redirects a missing sibling to the default-locale document', async () => {
    const result = await missingLocaleChain({
      locale: 'de',
      path: 'only-in-en',
      defaultLocale: 'en',
      getContentByPath: async (locale, path) => {
        if (locale === 'en' && path === 'only-in-en') return { data: {} };
        if (path === '/') return { data: {} };
        return undefined;
      },
      hrefFor,
    });
    assert.deepEqual(result, { kind: 'redirect', href: '/en/only-in-en/' });
  });

  it('falls back to home in the requested locale, then 404', async () => {
    const toHome = await missingLocaleChain({
      locale: 'de',
      path: 'missing',
      defaultLocale: 'en',
      getContentByPath: async (locale, path) =>
        path === '/' && locale === 'de' ? { data: {} } : undefined,
      hrefFor,
    });
    assert.deepEqual(toHome, { kind: 'redirect', href: '/de/' });

    const missing = await missingLocaleChain({
      locale: 'de',
      path: 'missing',
      defaultLocale: 'en',
      getContentByPath: async () => undefined,
      hrefFor,
    });
    assert.deepEqual(missing, { kind: 'not-found' });
  });
});
