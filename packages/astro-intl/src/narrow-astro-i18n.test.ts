import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { narrowAstroI18n } from './narrow-astro-i18n.ts';

describe('narrowAstroI18n', () => {
  it('returns string locales and the default locale', () => {
    assert.deepEqual(
      narrowAstroI18n({
        defaultLocale: 'en',
        locales: ['en', 'de'],
      }),
      { locales: ['en', 'de'], defaultLocale: 'en' },
    );
  });

  it('throws when Astro i18n is missing', () => {
    assert.throws(
      () => narrowAstroI18n(undefined),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          /^@repo\/astro-intl: Astro i18n is missing\. Register astroIntl\(\) before reading locales\.$/,
        );
        return true;
      },
    );
  });

  it('throws when a locale is not a string', () => {
    assert.throws(
      () =>
        narrowAstroI18n({
          defaultLocale: 'en',
          locales: ['en', { path: 'german', codes: ['de'] }],
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^@repo\/astro-intl: Astro i18n locales must be strings\./);
        return true;
      },
    );
  });
});
