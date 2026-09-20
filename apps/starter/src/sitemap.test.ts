import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sitemapFilter } from './sitemap.ts';

const sitemapUrl = fileURLToPath(new URL('./sitemap.ts', import.meta.url));
const configUrl = fileURLToPath(new URL('../astro.config.mjs', import.meta.url));

describe('sitemap printer', () => {
  it('wires serialize to intl pairing helpers without the i18n option', () => {
    const source = readFileSync(sitemapUrl, 'utf8');
    const config = readFileSync(configUrl, 'utf8');

    assert.match(source, /getSitemapEntries/);
    assert.match(source, /getAlternatePaths/);
    assert.match(source, /x-default/);
    assert.match(config, /serialize:\s*serializeSitemap/);
    assert.match(config, /customPages:\s*intlSitemapPages/);
    assert.doesNotMatch(config, /sitemap\([^)]*i18n\s*:/);
    assert.doesNotMatch(source, /i18n\s*:/);
    assert.doesNotMatch(source, /from ['"]@astrojs\/rss['"]/);
  });

  it('keeps feeds, robots, and OG routes out of the sitemap', () => {
    assert.equal(sitemapFilter('https://example.com/en/rss.xml'), false);
    assert.equal(sitemapFilter('https://example.com/de/rss.xml/'), false);
    assert.equal(sitemapFilter('https://example.com/robots.txt'), false);
    assert.equal(sitemapFilter('https://example.com/_og/en/'), false);
    assert.equal(sitemapFilter('https://example.com/en/blog/hello-world/'), true);
    assert.equal(sitemapFilter('https://example.com/de/artikel/hallo-welt/'), true);
  });
});
