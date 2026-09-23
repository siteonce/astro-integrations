import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { leafSlug } from './locale-section.ts';

/** Test double: the segment must already equal this spelling. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replaceAll(' ', '-')
    .replaceAll(/[^a-z0-9-]/g, '');
}

const schema = z.object({ slug: z.string().min(1) }).superRefine(leafSlug());
const slugified = z.object({ slug: z.string().min(1) }).superRefine(leafSlug({ slugify }));

function firstIssue(result: z.ZodSafeParseResult<unknown>): string {
  assert.equal(result.success, false);
  return result.error.issues[0]?.message ?? '';
}

describe('leafSlug', () => {
  it('accepts one segment', () => {
    assert.deepEqual(schema.parse({ slug: 'hallo-welt' }), { slug: 'hallo-welt' });
    assert.deepEqual(slugified.parse({ slug: 'hallo-welt' }), { slug: 'hallo-welt' });
  });

  it('rejects a slash', () => {
    assert.match(
      firstIssue(schema.safeParse({ slug: 'artikel/hallo-welt' })),
      /slug "artikel\/hallo-welt" is not one segment/,
    );
    assert.match(firstIssue(schema.safeParse({ slug: '/' })), /slug "\/" is not one segment/);
  });

  it('rejects a slugify mismatch', () => {
    assert.match(
      firstIssue(slugified.safeParse({ slug: 'über-uns' })),
      /slug "über-uns" is not a slug/,
    );
  });
});
