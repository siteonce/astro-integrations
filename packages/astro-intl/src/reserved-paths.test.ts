import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reservedTailsFromRoutes, tailFromRoute } from './reserved-paths.ts';

describe('reservedTailsFromRoutes', () => {
  it('ignores the document catch-all and unprefixed root', () => {
    assert.equal(tailFromRoute({ pattern: '[locale]/[...path]' }), undefined);
    assert.equal(tailFromRoute({ pattern: '/' }), undefined);
    assert.equal(tailFromRoute({ pattern: '[locale]' }), '/');
  });

  it('takes the tail after [locale] for file routes', () => {
    assert.equal(tailFromRoute({ pattern: '[locale]/about' }), 'about');
    assert.equal(tailFromRoute({ pattern: '[locale]/rss.xml' }), 'rss.xml');
    assert.deepEqual(
      reservedTailsFromRoutes([
        { pattern: '[locale]/[...path]' },
        { pattern: '/' },
        { pattern: '[locale]/about' },
        { pattern: 'robots.txt' },
      ]),
      ['about', 'robots.txt'],
    );
  });
});
