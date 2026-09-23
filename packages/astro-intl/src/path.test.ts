import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePath, localeUrlPath, normalizeSlug } from './path.ts';

describe('compilePath', () => {
  it('joins a prefix and a leaf', () => {
    assert.equal(compilePath('blog', 'hello-world'), 'blog/hello-world');
    assert.equal(compilePath('artikel', 'hallo-welt'), 'artikel/hallo-welt');
  });

  it('rejects an empty prefix, "/", and a slashed leaf', () => {
    assert.throws(() => compilePath('', 'hello-world'), /prefix "" is empty or "\/"/);
    assert.throws(() => compilePath('/', 'hello-world'), /prefix "\/" is empty or "\/"/);
    assert.throws(() => compilePath('blog', '/'), /slug "\/" is not one segment/);
    assert.throws(
      () => compilePath('artikel', 'artikel/hallo-welt'),
      /slug "artikel\/hallo-welt" is not one segment/,
    );
  });
});

describe('normalizeSlug', () => {
  it('maps an empty slug to the homepage path', () => {
    assert.equal(normalizeSlug(''), '/');
    assert.equal(localeUrlPath('/'), '');
    assert.equal(localeUrlPath('blog/hello-world'), 'blog/hello-world');
  });
});
