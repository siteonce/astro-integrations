/**
 * Starter map from collection / page type → type layout. intl does not
 * know page types; this is catch-all convention.
 */

export type TypeLayoutName = 'home' | 'listing' | 'post' | 'term';

export function typeLayoutName(entry: {
  collection?: string;
  data: { pageType?: unknown };
}): TypeLayoutName {
  const { collection } = entry;
  const pageType = entry.data.pageType;
  if (collection === 'blog') return 'post';
  if (collection === 'tags') return 'term';
  if (collection === 'pages') {
    if (pageType === 'listing') return 'listing';
    if (pageType === 'home') return 'home';
  }
  throw new Error(
    `starter: no type layout for collection "${collection ?? ''}" pageType "${String(pageType ?? '')}".`,
  );
}
