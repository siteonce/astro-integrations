import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deleteDrafts } from './drafts.ts';

describe('deleteDrafts', () => {
  it('deletes drafts and keeps published entries', () => {
    const entries = new Map([
      ['a', { id: 'a', data: { status: 'published' } }],
      ['b', { id: 'b', data: { status: 'draft' } }],
      ['c', { id: 'c', data: {} }],
    ]);
    deleteDrafts({
      values: () => [...entries.values()],
      delete: (id: string) => {
        entries.delete(id);
      },
    });
    assert.deepEqual([...entries.keys()], ['a', 'c']);
  });
});
