# Open Graph

Open issues in `@repo/astro-og-image`. What the visitor gets from Open Graph lives in [`site.md`](site.md#open-graph).

## Today

A build stops in Open Graph:

```
@repo/astro-og-image: paired slug "de" "/" has no entry.
```

`site.md` promises an image for home, listings, posts, and terms. Home, a listing, and a numbered listing page are tails with no entry. `getPairedSlugs()` returns routed documents and tails together. Open Graph requires an entry for every slug it gets, so the first tail fails the build.

Tails with no entry reached `getPairedSlugs()` after Open Graph was written. Until then, every paired slug had an entry.

When this is fixed:

- A slug with no entry still gets its page template. The image context has no entry. The starter template already reads `ctx.entry?.data`.
- A slug that should have an entry and has none still fails the build with the same message.
- A hidden draft is still left out.
- Tails had no image before, so these are the only new images: `/_og/en.png`, `/_og/de.png`, `/_og/en/blog.png`, `/_og/de/artikel.png`, `/_og/en/blog/2.png`, and `/_og/de/artikel/2.png`. Post and term images do not change.
- Pairing says which slugs have an entry: `getPairedSlugs()` returns each routed document's `entryId`, and tails have none. Open Graph does not infer it from the sitemap. That would tie the check to the sitemap's rules: if the sitemap ever left out an entry page, such as a `noindex` one, a missing entry there would render without one instead of failing the build.

Once the fix lands, remove this section.
