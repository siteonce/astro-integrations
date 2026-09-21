import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deployConfigSchema } from '@repo/astro-site/schemas/config/deploy-config';
import { siteConfigSchema } from '@repo/astro-site/schemas/config/site-config';
import type { AstroIntegration } from 'astro';
import config from '../astro.config.mjs';
import { deployConfig } from './deploy-config.ts';
import intlConfig from './intl.config.ts';
import { siteConfig } from './site-config.ts';

describe('starter config', () => {
  it('parses site and deploy config on import', () => {
    assert.equal(siteConfig.siteName, 'Astro Stack');
    assert.equal(siteConfig.siteUrl, 'https://example.com');
    assert.equal(deployConfig.class, 'local');
  });

  it('throws on invalid site or deploy data', () => {
    assert.throws(() => siteConfigSchema.parse({}));
    assert.throws(() => deployConfigSchema.parse({ class: 'staging' }));
  });

  it('sets en+de with prefixDefaultLocale', () => {
    assert.deepEqual(intlConfig.locales, ['en', 'de']);
    assert.equal(intlConfig.defaultLocale, 'en');
    assert.equal(intlConfig.routing.prefixDefaultLocale, true);
  });

  it('lists routed pages, blog, tags, and unrouted authors without page types', () => {
    assert.equal(intlConfig.collections?.pages?.idField, 'id');
    assert.equal(intlConfig.collections?.pages?.localeField, 'locale');
    assert.equal(intlConfig.collections?.pages?.slugField, 'slug');
    assert.equal(intlConfig.collections?.pages?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.blog?.idField, 'id');
    assert.equal(intlConfig.collections?.blog?.localeField, 'locale');
    assert.equal(intlConfig.collections?.blog?.slugField, 'slug');
    assert.equal(intlConfig.collections?.blog?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.tags?.idField, 'id');
    assert.equal(intlConfig.collections?.tags?.localeField, 'locale');
    assert.equal(intlConfig.collections?.tags?.slugField, 'slug');
    assert.equal(intlConfig.collections?.tags?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.authors?.idField, 'id');
    assert.equal(intlConfig.collections?.authors?.localeField, 'locale');
    assert.equal(intlConfig.collections?.authors?.slugField, undefined);
    assert.equal(intlConfig.collections?.authors?.pathPrefix, undefined);

    const source = readFileSync(
      fileURLToPath(new URL('./intl.config.ts', import.meta.url)),
      'utf8',
    );
    assert.doesNotMatch(source, /pageType/);
    assert.doesNotMatch(source, /entryId/);
    assert.doesNotMatch(source, /collectionFolder/);
  });

  it('registers astroIntl, ogImage, MDX, Svelte, sitemap, and rehypeExternalLinks', () => {
    const names = (config.integrations ?? [])
      .flat()
      .filter((integration): integration is AstroIntegration =>
        Boolean(integration && typeof integration === 'object' && 'name' in integration),
      )
      .map((integration) => integration.name);
    assert.ok(names.includes('@repo/astro-intl'));
    assert.ok(names.includes('@repo/og-image'));
    assert.ok(names.includes('@astrojs/mdx'));
    assert.ok(names.includes('@astrojs/svelte'));
    assert.ok(names.includes('@astrojs/sitemap'));
    assert.ok(names.includes('astro-intl-collect-sitemap-pages'));
    assert.ok(!names.includes('@repo/astro'));
    assert.ok(!names.includes('@repo/astro-site'));

    const source = readFileSync(
      fileURLToPath(new URL('../astro.config.mjs', import.meta.url)),
      'utf8',
    );
    assert.match(source, /rehypeExternalLinks/);
    assert.match(source, /from ['"]@repo\/astro-intl-sitemap['"]/);
    assert.match(source, /\bsitemap\(/);
    assert.match(source, /customPages:\s*intlSitemapPages/);
    assert.match(source, /filter:\s*sitemapFilter/);
    assert.match(source, /serialize:\s*serializeSitemap/);
    assert.doesNotMatch(source, /sitemap\([^)]*i18n\s*:/);
    assert.doesNotMatch(source, /from ['"]\.\/src\/sitemap\.ts['"]/);
    assert.equal(existsSync(fileURLToPath(new URL('./sitemap.ts', import.meta.url))), false);
    assert.doesNotMatch(source, /\bsiteonce\s*\(/);
    assert.doesNotMatch(source, /\bastroSite\s*\(/);
  });

  it('passes a German-bound slugify into localeSection', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./content.config.ts', import.meta.url)),
      'utf8',
    );
    assert.match(source, /listingLocaleSection/);
    assert.match(source, /localeSection\([^,]+,\s*'entry',\s*\{\s*slugify\s*\}/);
    const slugifySource = readFileSync(
      fileURLToPath(new URL('./utils/slugify.ts', import.meta.url)),
      'utf8',
    );
    assert.match(slugifySource, /ä:\s*['"]ae['"]/);
    assert.match(slugifySource, /ö:\s*['"]oe['"]/);
    assert.match(slugifySource, /ü:\s*['"]ue['"]/);
    assert.match(slugifySource, /ß:\s*['"]ss['"]/);
  });
});
