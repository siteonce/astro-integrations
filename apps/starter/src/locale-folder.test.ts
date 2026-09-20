import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localeFolder } from './locale-folder.ts';

describe('localeFolder', () => {
  it('reads the parent folder of a locale file', () => {
    assert.equal(
      localeFolder({ id: 'hello-world/en', filePath: 'hello-world/en.mdx' }),
      'hello-world',
    );
    assert.equal(localeFolder({ id: 'tags/announcements/en' }), 'announcements');
  });
});
