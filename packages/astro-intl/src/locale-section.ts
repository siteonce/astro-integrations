/**
 * Zod check that an entry `slug` is one segment. Section prefixes live on
 * route rows. Does not write URLs.
 */

type IssueCtx = { addIssue: (issue: { code: 'custom'; message: string }) => void };

/**
 * Accept one segment such as `hallo-welt`. Reject `/`, any slash, and, when
 * `slugify` is passed, a value that is not already `slugify(slug)`.
 */
export function leafSlug(options?: { slugify?: (value: string) => string }) {
  return (value: { slug?: string }, ctx: IssueCtx) => {
    const slug = value.slug ?? '';
    if (slug === '' || slug.includes('/')) {
      ctx.addIssue({
        code: 'custom',
        message: `slug "${slug}" is not one segment`,
      });
      return;
    }
    const slugify = options?.slugify;
    if (!slugify) return;
    const slugified = slugify(slug);
    if (slugified !== slug) {
      ctx.addIssue({
        code: 'custom',
        message: `slug "${slug}" is not a slug`,
      });
    }
  };
}
