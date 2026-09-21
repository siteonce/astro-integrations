import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { listingLocaleSection, localeSection } from './locale-section.ts';

const blogSection = [{ en: 'blog', de: 'artikel' }] as const;
const pagesSection = [
  { en: 'about', de: 'ueber-uns' },
  { en: 'about/history', de: 'ueber-uns/geschichte' },
] as const;

/** Test double: rest must already equal this spelling. */
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

const entrySchema = z
  .object({ locale: z.string().min(1), slug: z.string().min(1) })
  .superRefine(localeSection(blogSection, 'entry'));

const slugifiedEntrySchema = z
  .object({ locale: z.string().min(1), slug: z.string().min(1) })
  .superRefine(localeSection(blogSection, 'entry', { slugify }));

const pagesEntrySchema = z
  .object({ locale: z.string().min(1), slug: z.string().min(1) })
  .superRefine(localeSection(pagesSection, 'entry'));

const listingSchema = z
  .object({
    locale: z.string().min(1),
    slug: z.string().min(1),
    pageType: z.enum(['home', 'listing']),
  })
  .superRefine(listingLocaleSection({ blog: blogSection }));

const pagesListingSchema = z
  .object({
    locale: z.string().min(1),
    slug: z.string().min(1),
    pageType: z.enum(['home', 'listing']),
  })
  .superRefine(listingLocaleSection({ pages: pagesSection }));

function firstIssue(result: z.ZodSafeParseResult<unknown>): string {
  assert.equal(result.success, false);
  return result.error.issues[0]?.message ?? '';
}

describe('localeSection entry', () => {
  it('accepts a public tail under that locale’s section', () => {
    assert.deepEqual(entrySchema.parse({ locale: 'en', slug: 'blog/hello-world' }), {
      locale: 'en',
      slug: 'blog/hello-world',
    });
    assert.deepEqual(entrySchema.parse({ locale: 'de', slug: 'artikel/hallo-welt' }), {
      locale: 'de',
      slug: 'artikel/hallo-welt',
    });
  });

  it('rejects a de entry that is not under artikel', () => {
    assert.match(
      firstIssue(entrySchema.safeParse({ locale: 'de', slug: 'blog/hallo-welt' })),
      /locale "de" slug "blog\/hallo-welt" is not under section "artikel"/,
    );
  });

  it('rejects an entry that is only the section (the listing tail)', () => {
    assert.match(
      firstIssue(entrySchema.safeParse({ locale: 'de', slug: 'artikel' })),
      /locale "de" slug "artikel" is not under section "artikel"/,
    );
  });

  it('rejects a locale missing from the section map', () => {
    assert.match(
      firstIssue(entrySchema.safeParse({ locale: 'fr', slug: 'blog/bonjour' })),
      /locale "fr" has no section in the locale section map/,
    );
  });

  it('accepts an entry under a multi-segment section', () => {
    assert.deepEqual(pagesEntrySchema.parse({ locale: 'en', slug: 'about/history/early-years' }), {
      locale: 'en',
      slug: 'about/history/early-years',
    });
    assert.deepEqual(
      pagesEntrySchema.parse({ locale: 'de', slug: 'ueber-uns/geschichte/fruehe-jahre' }),
      { locale: 'de', slug: 'ueber-uns/geschichte/fruehe-jahre' },
    );
  });

  it('accepts a one-segment rest under a parent section', () => {
    assert.deepEqual(pagesEntrySchema.parse({ locale: 'en', slug: 'about/team' }), {
      locale: 'en',
      slug: 'about/team',
    });
  });

  it('rejects a second rest segment when no longer section matches', () => {
    assert.match(
      firstIssue(entrySchema.safeParse({ locale: 'en', slug: 'blog/hello-world/extra' })),
      /locale "en" slug "blog\/hello-world\/extra" is not under section "blog"/,
    );
  });

  it('accepts a one-segment rest when no slugify is passed', () => {
    assert.deepEqual(entrySchema.parse({ locale: 'de', slug: 'artikel/über-uns' }), {
      locale: 'de',
      slug: 'artikel/über-uns',
    });
    assert.deepEqual(entrySchema.parse({ locale: 'en', slug: 'blog/Hello World' }), {
      locale: 'en',
      slug: 'blog/Hello World',
    });
  });

  it('rejects an unslugified rest when slugify is passed', () => {
    assert.match(
      firstIssue(slugifiedEntrySchema.safeParse({ locale: 'de', slug: 'artikel/über-uns' })),
      /locale "de" slug "artikel\/über-uns" rest "über-uns" is not a slug/,
    );
    assert.match(
      firstIssue(slugifiedEntrySchema.safeParse({ locale: 'en', slug: 'blog/Hello World' })),
      /locale "en" slug "blog\/Hello World" rest "Hello World" is not a slug/,
    );
    assert.match(
      firstIssue(slugifiedEntrySchema.safeParse({ locale: 'en', slug: 'blog/!!!' })),
      /locale "en" slug "blog\/!!!" rest "!!!" is not a slug/,
    );
  });
});

describe('listingLocaleSection', () => {
  it('requires the listing slug to equal that locale’s section', () => {
    assert.deepEqual(
      listingSchema.parse({
        locale: 'de',
        slug: 'artikel',
        pageType: 'listing',
      }),
      { locale: 'de', slug: 'artikel', pageType: 'listing' },
    );
    assert.match(
      firstIssue(
        listingSchema.safeParse({
          locale: 'de',
          slug: 'blog',
          pageType: 'listing',
        }),
      ),
      /listing slug "blog" has no locale section map for locale "de"/,
    );
  });

  it('accepts a listing whose slug equals a multi-segment section', () => {
    assert.deepEqual(
      pagesListingSchema.parse({
        locale: 'de',
        slug: 'ueber-uns/geschichte',
        pageType: 'listing',
      }),
      { locale: 'de', slug: 'ueber-uns/geschichte', pageType: 'listing' },
    );
  });

  it('skips home documents', () => {
    assert.deepEqual(listingSchema.parse({ locale: 'de', slug: '/', pageType: 'home' }), {
      locale: 'de',
      slug: '/',
      pageType: 'home',
    });
  });

  it('rejects a listing with no section map', () => {
    assert.match(
      firstIssue(
        listingSchema.safeParse({
          locale: 'en',
          slug: 'notes',
          pageType: 'listing',
        }),
      ),
      /listing slug "notes" has no locale section map for locale "en"/,
    );
  });
});
