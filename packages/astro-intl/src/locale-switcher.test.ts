import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localeSwitcherLinks } from './locale-switcher.ts';

const hrefFor = (locale: string, path?: string) => (path ? `/${locale}/${path}/` : `/${locale}/`);

describe('localeSwitcherLinks', () => {
  it('omits href when a sibling is missing', () => {
    const missingDe = localeSwitcherLinks(['en', 'de'], 'en', { en: '/' }, hrefFor);
    assert.deepEqual(missingDe, [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: false },
    ]);
    assert.equal(missingDe[1]?.href, undefined);
  });

  it('links a non-current locale to its sibling path', () => {
    const withSibling = localeSwitcherLinks(
      ['en', 'de'],
      'en',
      { en: 'blog/hello-world', de: 'artikel/hallo-welt' },
      hrefFor,
    );
    assert.deepEqual(withSibling, [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: true, href: '/de/artikel/hallo-welt/' },
    ]);
  });

  it('treats an empty alternates map as no siblings', () => {
    const unknown = localeSwitcherLinks(['en', 'de'], 'en', {}, hrefFor);
    assert.deepEqual(unknown, [
      { locale: 'en', current: true, sibling: false },
      { locale: 'de', current: false, sibling: false },
    ]);
  });
});
