# @siteonce/astro-intl

Pairs content entries across locales and injects localized routes on top of Astro's i18n.

Astro already owns locale prefixes, `getRelativeLocaleUrl`, `Astro.currentLocale`, and content collections. `@siteonce/astro-intl` adds what Astro doesn't:

- **Pairing.** The same entry in each locale, matched on a pairing `id`. Each translation keeps its own slug.
- **Localized routes.** One route row per URL shape, with a tail per locale (`blog/{slug}`, `artikel/{slug}`). Intl injects the view you name at every URL that row publishes. Hreflang alternates and the locale switcher link to the same document, not the same path.
- **Catalogs.** ICU messages through `createT`, typed by your locales.
- **Relations.** Pointers between collections that resolve in the reader's locale.
- **Sitemap data.** Alternates and filtering for `@astrojs/sitemap`.

It writes your locales into Astro's `i18n` config and builds every URL through `astro:i18n`. URL matching, trailing slashes, and route priority stay Astro's. Startup fails, with an error that names the fix, when a config would publish a URL Astro can't serve.

## Install

```bash
pnpm add @siteonce/astro-intl
```

Requires Astro 7 and Node 22.12 or later.

## Set up

Move your locales into an intl config. Don't set Astro's `i18n` too: intl writes it.

```ts
// src/intl.config.ts
import { defineIntl } from '@siteonce/astro-intl';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  collections: { translated: ['posts'] },
  routes: [
    { slug: { en: '/', de: '/' }, view: 'home' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'posts', view: 'blog/post' },
  ],
});
```

Register the integration, and pass its sitemap options to `@astrojs/sitemap` if you use it. Intl must come first.

```js
// astro.config.mjs
import sitemap from '@astrojs/sitemap';
import astroIntl from '@siteonce/astro-intl';
import { defineConfig } from 'astro/config';
import intlConfig from './src/intl.config.ts';

const intl = astroIntl(intlConfig);

export default defineConfig({
  site: 'https://example.com',
  integrations: [intl, sitemap(intl.sitemap)],
});
```

Give each translated entry its pairing fields in the collection schema:

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { id, locale, slug } from '@siteonce/astro-intl';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({ id, locale, slug, title: z.string() }),
});

export const collections = { posts };
```

A route row names a **view**, a full Astro page under `src/views/`. It lists its URLs through intl's helper:

```astro
---
// src/views/blog/post.astro
import type { GetStaticPathsOptions } from 'astro';
import { createIntl, viewProps } from '@siteonce/astro-intl';
import intlConfig from '../../intl.config.ts';

const { entryPaths } = createIntl(intlConfig);

export async function getStaticPaths({ routePattern }: GetStaticPathsOptions) {
  return entryPaths(routePattern, 'posts');
}

const props = await viewProps(Astro, getStaticPaths);
if (!props) return new Response(null, { status: 404 });
const { locale, entry } = props;
---

<h1 lang={locale}>{entry.data.title}</h1>
```

Restart `astro dev` after editing the intl config.

## Learn more

- [The contract](../../docs/product/intl.md): pairing, routes, view rendering, relations, catalogs, and every refusal.
- [The demo](../../apps/demo/): a working bilingual blog with listings, pagination, tags, relations, a locale switcher, a fallback for missing translations, and a feed.

## License

MIT
