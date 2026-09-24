import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchRoute } from './routes.ts';

describe('matchRoute', () => {
  it('sends a numbered tail to the listing and an entry leaf to the post', () => {
    assert.equal(matchRoute('en', 'blog', false)?.page, 'blog');
    assert.equal(matchRoute('en', 'blog/2', false)?.page, 'blog');
    assert.equal(matchRoute('de', 'artikel/3', false)?.page, 'blog');
    assert.equal(matchRoute('en', 'blog/1', false), undefined);
    assert.equal(matchRoute('en', 'blog/2', true)?.page, 'blog/post');
    assert.equal(matchRoute('en', 'blog/hello-world', true)?.page, 'blog/post');
    assert.equal(matchRoute('en', 'tags/design', true)?.page, 'tags/term');
    assert.equal(matchRoute('en', '/', false)?.page, 'home');
  });
});
