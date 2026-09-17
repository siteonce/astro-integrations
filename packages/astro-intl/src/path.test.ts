import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePath, localeUrlPath, normalizeSlug, prefixFor } from './path.ts';

describe('compilePath', () => {
  it('uses slug as the path when there is no prefix', () => {
    assert.equal(compilePath(undefined, 'en', 'legal/privacy'), 'legal/privacy');
    assert.equal(compilePath(undefined, 'en', '/'), '/');
  });

  it('joins a string prefix in every locale', () => {
    assert.equal(compilePath('blog', 'en', 'hello-world'), 'blog/hello-world');
    assert.equal(compilePath('blog', 'de', 'hallo-welt'), 'blog/hallo-welt');
  });

  it('joins a per-locale prefix map', () => {
    const prefix = { en: 'blog', de: 'artikel' };
    assert.equal(compilePath(prefix, 'en', 'hello-world'), 'blog/hello-world');
    assert.equal(compilePath(prefix, 'de', 'hallo-welt'), 'artikel/hallo-welt');
  });

  it('rejects homepage slug combined with pathPrefix', () => {
    assert.throws(
      () => compilePath('blog', 'en', '/'),
      /slug "\/" cannot combine with pathPrefix "blog"/,
    );
  });

  it('normalizes empty slug to homepage', () => {
    assert.equal(normalizeSlug(''), '/');
    assert.equal(localeUrlPath('/'), '');
    assert.equal(localeUrlPath('blog/hello-world'), 'blog/hello-world');
    assert.equal(prefixFor('blog', 'de'), 'blog');
  });
});
