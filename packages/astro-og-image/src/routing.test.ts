import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OgImageConfigInput } from './config.ts';
import { matchRoute, templateForMatch } from './routing.ts';

const config = {
  routes: {
    '*': { template: 'default' },
    '/404': false,
  },
} satisfies Pick<OgImageConfigInput, 'routes'>;

describe('templateForMatch(matchRoute)', () => {
  it('returns default for a prefixed post path', () => {
    assert.equal(templateForMatch(matchRoute('/en/blog/hello', config), config), 'default');
  });

  it('returns default for a locale home path', () => {
    assert.equal(templateForMatch(matchRoute('/de', config), config), 'default');
  });

  it('returns no template for the not-found opt-out', () => {
    assert.equal(templateForMatch(matchRoute('/404', config), config), undefined);
  });
});
