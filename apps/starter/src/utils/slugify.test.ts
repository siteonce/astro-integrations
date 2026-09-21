import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugify } from './slugify.ts';

describe('slugify', () => {
  it('lowercases, turns spaces into hyphens, and strips punctuation', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
    assert.equal(slugify('hello, world!'), 'hello-world');
    assert.equal(slugify('hello-world'), 'hello-world');
  });

  it('transliterates German letters before slugify', () => {
    assert.equal(slugify('über uns'), 'ueber-uns');
    assert.equal(slugify('Größe'), 'groesse');
    assert.equal(slugify('ÄÖÜ'), 'aeoeue');
  });

  it('returns empty when nothing remains', () => {
    assert.equal(slugify('!!!'), '');
    assert.equal(slugify(''), '');
  });
});
