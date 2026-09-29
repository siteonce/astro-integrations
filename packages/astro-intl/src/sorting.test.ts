import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { byDate, byFlag, byText, sortBy } from './sorting.ts';

describe('byDate', () => {
  const older = { at: new Date('2020-01-01') };
  const newer = { at: new Date('2024-06-01') };

  it('orders dates in both directions', () => {
    const asc = byDate((row: { at: Date }) => row.at, 'asc');
    const desc = byDate((row: { at: Date }) => row.at, 'desc');
    assert.ok(asc(older, newer) < 0);
    assert.ok(desc(older, newer) > 0);
    assert.equal(asc(older, older), 0);
  });
});

describe('byText', () => {
  it('collates by locale', () => {
    const apples = { title: 'Äpfel' };
    const pears = { title: 'Birnen' };
    const compare = byText((row: { title: string }) => row.title, 'de', 'asc');
    assert.ok(compare(apples, pears) < 0);
    assert.ok(apples.title > pears.title);
  });
});

describe('sortBy', () => {
  it('falls through on a tie and returns 0 when every comparator ties', () => {
    type Row = { name: string; n: number };
    const byName = byText((row: Row) => row.name, 'en', 'asc');
    const byCount = (a: Row, b: Row) => a.n - b.n;
    const compare = sortBy(byName, byCount);
    const low = { name: 'same', n: 1 };
    const high = { name: 'same', n: 2 };
    assert.ok(compare(low, high) < 0);
    assert.equal(compare(low, { name: 'same', n: 1 }), 0);
  });
});

describe('byFlag', () => {
  it('puts true first', () => {
    const compare = byFlag((row: { on: boolean }) => row.on);
    assert.ok(compare({ on: true }, { on: false }) < 0);
    assert.ok(compare({ on: false }, { on: true }) > 0);
    assert.equal(compare({ on: true }, { on: true }), 0);
  });
});
