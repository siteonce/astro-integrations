import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const pagesDir = fileURLToPath(new URL('./pages/', import.meta.url));
const rssUrl = new URL('./pages/[locale]/rss.xml.ts', import.meta.url);

describe('RSS printer', () => {
  it('is a locale-param endpoint wired to intl pairing helpers', () => {
    assert.equal(existsSync(new URL('./pages/rss.xml.ts', import.meta.url)), false);
    assert.equal(existsSync(rssUrl), true);

    const source = readFileSync(rssUrl, 'utf8');
    assert.match(source, /from ['"]@astrojs\/rss['"]/);
    assert.match(source, /getSitemapEntries/);
    assert.match(source, /getAlternatePathsForPath/);
    assert.match(source, /getAbsoluteLocaleUrl/);
    assert.match(source, /from ['"]@repo\/astro-intl['"]/);
    assert.match(source, /from ['"]\.\.\/\.\.\/t\.ts['"]/);
    assert.match(source, /export function getStaticPaths/);
    assert.match(source, /export const prerender = true/);
    assert.doesNotMatch(source, /from ['"]@repo\/astro['"/]/);
    assert.doesNotMatch(source, /i18n-config/);
  });

  it('does not add per-locale file routes under pages/', () => {
    assert.equal(existsSync(new URL('./pages/en/', import.meta.url)), false);
    assert.equal(existsSync(new URL('./pages/de/', import.meta.url)), false);
    assert.equal(pagesDir.endsWith('/pages/'), true);
  });
});
