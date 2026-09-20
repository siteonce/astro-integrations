/**
 * Starter map from collection / page type → `_pages` file. intl does not
 * know page types; this is catch-all convention.
 */

export type PageName = 'home' | 'listing' | 'post' | 'term';

export function pageName(entry: { collection?: string; data: { pageType?: unknown } }): PageName {
  const { collection } = entry;
  const pageType = entry.data.pageType;
  if (collection === 'blog') return 'post';
  if (collection === 'tags') return 'term';
  if (collection === 'pages') {
    if (pageType === 'listing') return 'listing';
    if (pageType === 'home') return 'home';
  }
  throw new Error(
    `starter: no page for collection "${collection ?? ''}" pageType "${String(pageType ?? '')}".`,
  );
}
