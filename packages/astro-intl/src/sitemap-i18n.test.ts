import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sourceSetsSitemapI18n } from './sitemap-i18n.ts';

describe('sourceSetsSitemapI18n', () => {
  it('detects i18n inside a sitemap() call', () => {
    assert.equal(
      sourceSetsSitemapI18n(`
        import sitemap from '@astrojs/sitemap';
        export default { integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })] };
      `),
      true,
    );
  });

  it('ignores sitemap() without i18n', () => {
    assert.equal(
      sourceSetsSitemapI18n(`
        import sitemap from '@astrojs/sitemap';
        export default { integrations: [sitemap({ filter: (page) => true })] };
      `),
      false,
    );
  });

  it('does not treat a later i18n identifier as the sitemap option', () => {
    assert.equal(
      sourceSetsSitemapI18n(`
        import sitemap from '@astrojs/sitemap';
        export default { integrations: [sitemap()] };
        const i18n = { defaultLocale: 'en' };
      `),
      false,
    );
  });

  it('ignores i18n mentioned in a comment', () => {
    assert.equal(
      sourceSetsSitemapI18n(`
        import sitemap from '@astrojs/sitemap';
        // sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en' } } })
        export default { integrations: [sitemap()] };
      `),
      false,
    );
  });
});
