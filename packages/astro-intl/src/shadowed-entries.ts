/**
 * Refuses a literal project file route on an entry URL that a `{slug}` row
 * publishes. Astro serves the file route at that URL, so the entry's page never
 * renders, while the sitemap and the siblings' hreflang still point at it.
 * The sitemap data route runs this in the build, where collections load.
 */

import type { Locale } from './intl-register.ts';
import { type CollectionEntryLike, describeEntry } from './pairing.ts';

/** A literal file route under the injected entry route `pattern`, whose row names `collection`. */
export type ShadowCandidate = {
  file: string;
  pattern: string;
  locale: Locale;
  collection: string;
  slug: string;
};

/** The `createIntl` binding calls this check reads. */
type EntryReads = {
  entryPaths(
    routePattern: string,
    collection: string,
  ): Promise<{ params: { slug: string }; props: { entry: CollectionEntryLike } }[]>;
  getRelativeEntryUrl(locale: Locale, ref: CollectionEntryLike): Promise<string | undefined>;
};

export async function refuseShadowedEntries(
  intl: EntryReads,
  candidates: readonly ShadowCandidate[],
): Promise<void> {
  for (const candidate of candidates) {
    const paths = await intl.entryPaths(candidate.pattern, candidate.collection);
    const shadowed = paths.find((path) => path.params.slug === candidate.slug);
    if (!shadowed) continue;
    const entry = shadowed.props.entry;
    const url = await intl.getRelativeEntryUrl(candidate.locale, entry);
    throw new Error(
      `@siteonce/astro-intl: file route "${candidate.file}" shadows "${url}", ` +
        `the URL that entry ${describeEntry(candidate.collection, entry)} publishes in locale "${candidate.locale}". ` +
        'Astro serves the file route there, ' +
        "while the sitemap and the siblings' hreflang point at the entry. " +
        "Remove or move the file route, or change the entry's slug.",
    );
  }
}
