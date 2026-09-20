import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.equal(intlConfig.entryId, 'collectionFolder');
    assert.equal(intlConfig.collections?.pages?.slugField, 'slug');
    assert.equal(intlConfig.collections?.pages?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.blog?.slugField, 'slug');
    assert.equal(intlConfig.collections?.blog?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.tags?.slugField, 'slug');
    assert.equal(intlConfig.collections?.tags?.pathPrefix, undefined);
    assert.equal(intlConfig.collections?.authors?.slugField, undefined);
    assert.equal(intlConfig.collections?.authors?.pathPrefix, undefined);

    const source = readFileSync(
      fileURLToPath(new URL('./intl.config.ts', import.meta.url)),
      'utf8',
    );
    assert.doesNotMatch(source, /pageType/);
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
    assert.ok(!names.includes('@repo/astro'));
    assert.ok(!names.includes('@repo/astro-site'));

    const source = readFileSync(
      fileURLToPath(new URL('../astro.config.mjs', import.meta.url)),
      'utf8',
    );
    assert.match(source, /rehypeExternalLinks/);
    assert.match(source, /\bsitemap\(/);
    assert.doesNotMatch(source, /sitemap\([^)]*i18n\s*:/);
    assert.doesNotMatch(source, /\bsiteonce\s*\(/);
    assert.doesNotMatch(source, /\bastroSite\s*\(/);
  });
});
