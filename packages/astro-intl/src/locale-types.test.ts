import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localeTypeDeclaration } from './locale-types.ts';

describe('localeTypeDeclaration', () => {
  it('maps each collection name to its CollectionEntry', () => {
    assert.equal(
      localeTypeDeclaration(['en', 'de'], ['posts', 'sources']),
      [
        "declare module '@repo/astro-intl' {",
        '  interface IntlRegister {',
        '    locale: "en" | "de";',
        '    entries: { [C in "posts" | "sources"]: import(\'astro:content\').CollectionEntry<C> };',
        '  }',
        '}',
        'export {};',
        '',
      ].join('\n'),
    );
  });

  it('omits entries when the config names no collections', () => {
    assert.equal(
      localeTypeDeclaration(['en'], []),
      [
        "declare module '@repo/astro-intl' {",
        '  interface IntlRegister {',
        '    locale: "en";',
        '  }',
        '}',
        'export {};',
        '',
      ].join('\n'),
    );
  });
});
