import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const endpointUrl = new URL('./pages/robots.txt.ts', import.meta.url);

describe('robots.txt endpoint', () => {
  it('is a starter endpoint that imports robotsTxt from @repo/astro-site', () => {
    const source = readFileSync(endpointUrl, 'utf8');
    assert.match(source, /from ['"]@repo\/astro-site['"]/);
    assert.match(source, /\brobotsTxt\b/);
    assert.match(source, /export const GET/);
    assert.match(source, /export const prerender = true/);
    assert.doesNotMatch(source, /function robotsTxt/);
    assert.doesNotMatch(source, /Disallow:/);
    assert.doesNotMatch(source, /from ['"]@repo\/astro['"/]/);
  });
});
