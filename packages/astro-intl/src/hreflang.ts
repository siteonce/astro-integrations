import type { DocumentHead } from './query.ts';

/** `rel="alternate"` rows for `<Hreflang />`, including `x-default` when present. */
export function hreflangLinks(head: DocumentHead): { hreflang: string; href: string }[] {
  const links = [...head.alternates];
  if (head.xDefault) links.push({ hreflang: 'x-default', href: head.xDefault });
  return links;
}
