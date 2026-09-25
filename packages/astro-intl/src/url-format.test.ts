import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { urlFormatMismatch } from './url-format.ts';

describe('urlFormatMismatch', () => {
  it('returns a message for the two mismatches', () => {
    assert.equal(
      urlFormatMismatch('never', 'directory'),
      'trailingSlash "never" writes pages as folders (build.format "directory"), and many hosts add the slash back. Set build.format to "file".',
    );
    assert.equal(
      urlFormatMismatch('always', 'file'),
      'trailingSlash "always" links to "/path/", but build.format "file" writes "/path.html". Set build.format to "directory".',
    );
  });

  it('returns nothing when the pair agrees', () => {
    assert.equal(urlFormatMismatch('always', 'directory'), undefined);
    assert.equal(urlFormatMismatch('ignore', 'file'), undefined);
    assert.equal(urlFormatMismatch('never', 'preserve'), undefined);
  });
});
