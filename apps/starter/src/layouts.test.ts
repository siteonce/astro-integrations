import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineIntl, getAlternatePaths } from '@repo/astro-intl';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { localeSwitcherLinks } from './utils/locale-switcher.ts';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const appRoot = path.join(srcDir, '..');
const repoRoot = path.join(appRoot, '../..');

const astroRequire = createRequire(createRequire(import.meta.url).resolve('astro/package.json'));
const { transform } = (await import(astroRequire.resolve('@astrojs/compiler-rs'))) as {
  transform: (source: string, options?: Record<string, unknown>) => { code: string };
};

const compileCache = path.join(appRoot, 'node_modules', '.cache', 'starter-layouts');

const sharedLayoutFiles = [
  path.join(srcDir, 'layouts/site-layout.astro'),
  path.join(srcDir, 'components/favicon.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/astro/schema.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/blocks/hero.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/blocks/post-list.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/blocks/article.astro'),
  path.join(repoRoot, 'packages/astro-site/src/components/blocks/related-posts.astro'),
  path.join(repoRoot, 'packages/astro-intl/src/hreflang.astro'),
];

function toRunnableModule(code: string): string {
  return code
    .replace(/\s*,\s*createMetadata as \$\$createMetadata/, '')
    .replace(/export const \$\$metadata = \$\$createMetadata\([\s\S]*?\n\}\);\n/, '')
    .replace(/^import \* as \$\$module\d+ from ['"][^'"]+['"];?\n/gm, '');
}

function resolveSpecifier(fromFile: string, specifier: string): string {
  if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
  return specifier;
}

async function compileGraph(files: string[], collections: Record<string, unknown[]> = {}) {
  await mkdir(compileCache, { recursive: true });
  const dir = await mkdtemp(path.join(compileCache, 'run-'));
  const compiled = new Map<string, string>();
  for (const file of files) {
    compiled.set(file, path.join(dir, `${path.basename(file, '.astro')}.mjs`));
  }

  const emptyCss = path.join(dir, 'empty-css.mjs');
  await writeFile(emptyCss, 'export default {};\n');
  const i18nMock = path.join(dir, 'astro-i18n.mjs');
  await writeFile(
    i18nMock,
    `export function getRelativeLocaleUrl(locale, path = '') {
  if (!path || path === '/') return '/' + locale + '/';
  const tail = String(path).replace(/^\\/+|\\/+$/g, '');
  return '/' + locale + '/' + tail + '/';
}
export function getAbsoluteLocaleUrl(locale, path = '') {
  return 'https://example.com' + getRelativeLocaleUrl(locale, path);
}
`,
  );
  const collectionsJson = JSON.stringify(collections);
  const contentMock = path.join(dir, 'astro-content.mjs');
  await writeFile(
    contentMock,
    `const collections = ${collectionsJson};
function revive(value, key) {
  if (Array.isArray(value)) return value.map((item) => revive(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = revive(v, k);
    return out;
  }
  if (key === 'pubDate' && typeof value === 'string') return new Date(value);
  return value;
}
export async function getCollection(name) {
  return revive(collections[name] ?? []);
}
export async function render() {
  throw new Error('astro:content render() is not available in this fixture');
}
`,
  );

  function compiledHref(file: string): string {
    return pathToFileURL(compiled.get(file) ?? '').href;
  }

  const siteBarrel = path.join(dir, 'astro-site-components.mjs');
  await writeFile(
    siteBarrel,
    `export { default as BaseLayout } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro')))};
export { default as Seo } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro')))};
export { default as Schema } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/astro/schema.astro')))};
export { default as Hero } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/blocks/hero.astro')))};
export { default as PostList } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/blocks/post-list.astro')))};
export { default as Article } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/blocks/article.astro')))};
export { default as RelatedPosts } from ${JSON.stringify(compiledHref(path.join(repoRoot, 'packages/astro-site/src/components/blocks/related-posts.astro')))};
`,
  );
  const intlBarrel = path.join(dir, 'astro-intl-components.mjs');
  await writeFile(
    intlBarrel,
    `export { default as Hreflang } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-intl/src/hreflang.astro')) ?? '').href)};
`,
  );

  function rewriteSpecifier(fromFile: string, specifier: string): string | undefined {
    if (specifier === 'astro:i18n') return pathToFileURL(i18nMock).href;
    if (specifier === 'astro:content') return pathToFileURL(contentMock).href;
    if (specifier === '@repo/astro-site/components') return pathToFileURL(siteBarrel).href;
    if (specifier === '@repo/astro-intl/components') return pathToFileURL(intlBarrel).href;
    if (specifier === '../styles' || specifier.endsWith('.css') || specifier.endsWith('/styles')) {
      return pathToFileURL(emptyCss).href;
    }
    const resolved = resolveSpecifier(fromFile, specifier);
    if (compiled.has(resolved)) return pathToFileURL(compiled.get(resolved) ?? '').href;
    if (specifier.startsWith('.')) {
      const withAstro = resolved.endsWith('.astro') ? resolved : `${resolved}.astro`;
      if (compiled.has(withAstro)) return pathToFileURL(compiled.get(withAstro) ?? '').href;
      return pathToFileURL(resolved).href;
    }
    return undefined;
  }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const result = transform(source, {
      filename: path.basename(file),
      internalURL: 'astro/compiler-runtime',
      resultScopedSlot: true,
    });
    let code = toRunnableModule(result.code);
    code = code.replace(/from\s+['"]([^'"]+)['"]/g, (full, specifier: string) => {
      const next = rewriteSpecifier(file, specifier);
      return next ? `from ${JSON.stringify(next)}` : full;
    });
    code = code.replace(/import\s+['"]([^'"]+)['"]/g, (full, specifier: string) => {
      const next = rewriteSpecifier(file, specifier);
      return next ? `import ${JSON.stringify(next)}` : full;
    });
    await writeFile(compiled.get(file) ?? '', code);
  }

  return compiled;
}

describe('SiteLayout and `_pages` source', () => {
  it('SiteLayout is chrome only', () => {
    const siteLayout = readFileSync(
      new URL('./layouts/site-layout.astro', import.meta.url),
      'utf8',
    );
    assert.match(siteLayout, /Favicon/);
    assert.match(siteLayout, /BaseLayout/);
    assert.match(siteLayout, /slot name="head"/);
    assert.doesNotMatch(siteLayout, /\bHero\b/);
    assert.doesNotMatch(siteLayout, /\bPostList\b/);
    assert.doesNotMatch(siteLayout, /\bArticle\b/);
    assert.doesNotMatch(siteLayout, /from ['"]@repo\/astro['"/]/);
    assert.doesNotMatch(siteLayout, /<main\b/);
  });

  function documentPageSource(name: string) {
    return readFileSync(new URL(`./pages/_pages/${name}.astro`, import.meta.url), 'utf8');
  }

  it('home page owns head, landmark frame, t(), and blocks', () => {
    const home = documentPageSource('home');
    assert.match(home, /from ['"]astro:content['"]/);
    assert.match(home, /\brender\s*\(/);
    assert.match(home, /useTranslations/);
    assert.match(home, /<Seo\b/);
    assert.match(home, /<Hreflang\b/);
    assert.match(home, /<Schema\b/);
    assert.match(home, /slot="head"/);
    assert.match(home, /<main class="[^"]*\bmeasure\b[^"]*\bflow\b/);
    assert.match(home, /<Hero\b/);
    assert.match(home, /SiteLayout/);
    assert.doesNotMatch(home, /from ['"]@repo\/astro['"/]/);
    assert.doesNotMatch(home, /<section\b/);
    assert.doesNotMatch(home, /<h1\b/);
  });

  it('listing, post, and term pages own extra queries, head, and blocks', () => {
    const listing = documentPageSource('listing');
    const post = documentPageSource('post');
    const term = documentPageSource('term');

    for (const [name, source] of [
      ['listing', listing],
      ['post', post],
      ['term', term],
    ] as const) {
      assert.match(source, /from ['"]astro:content['"]/, name);
      assert.match(source, /\brender\s*\(/, name);
      assert.match(source, /getCollection/, name);
      assert.match(source, /useTranslations/, name);
      assert.match(source, /<Seo\b/, name);
      assert.match(source, /<Hreflang\b/, name);
      assert.match(source, /<Schema\b/, name);
      assert.match(source, /slot="head"/, name);
      assert.match(source, /<main class="[^"]*\bmeasure\b[^"]*\bflow\b/, name);
      assert.match(source, /SiteLayout/, name);
      assert.doesNotMatch(source, /from ['"]@repo\/astro['"/]/, name);
      assert.doesNotMatch(source, /<section\b/, name);
      assert.doesNotMatch(source, /<h1\b/, name);
      assert.doesNotMatch(source, /<article\b/, name);
      assert.doesNotMatch(source, /<aside\b/, name);
      assert.doesNotMatch(source, /pagination/, name);
      assert.doesNotMatch(source, /search-results/, name);
    }

    assert.match(listing, /<Hero\b/);
    assert.match(listing, /<PostList\b/);
    assert.match(post, /<Article\b/);
    assert.match(post, /<RelatedPosts\b/);
    assert.match(post, /getRelatedContent/);
    assert.match(term, /<Hero\b/);
    assert.match(term, /<PostList\b/);

    const blocksDir = path.join(repoRoot, 'packages/astro-site/src/components/blocks');
    for (const name of readdirSync(blocksDir).filter((file) => file.endsWith('.astro'))) {
      const source = readFileSync(path.join(blocksDir, name), 'utf8');
      assert.doesNotMatch(source, /getCollection/, `${name} must not query collections`);
      assert.doesNotMatch(source, /getEntry\b/, `${name} must not query collections`);
      assert.doesNotMatch(source, /astro:content/, `${name} must not query collections`);
    }
  });
});

describe('locale switcher', () => {
  it('falls back to the de homepage when the sibling is missing', () => {
    const hrefFor = (locale: string, path?: string) =>
      path ? `/${locale}/${path}/` : `/${locale}/`;
    const missingDe = localeSwitcherLinks(['en', 'de'], 'en', { en: '/' }, hrefFor);
    assert.deepEqual(missingDe, [
      { locale: 'en', href: '/en/', current: true },
      { locale: 'de', href: '/de/', current: false },
    ]);

    const withSibling = localeSwitcherLinks(
      ['en', 'de'],
      'en',
      { en: 'blog/hello-world', de: 'artikel/hallo-welt' },
      hrefFor,
    );
    assert.equal(withSibling[1]?.href, '/de/artikel/hallo-welt/');
  });
});

describe('render home page', () => {
  it('renders a fixture en entry with missing de sibling', async () => {
    const { resetIntlQuery, setIntlLoaders } = await import(
      '../../../packages/astro-intl/src/helpers.ts'
    );
    const { setIntlConfig } = await import('../../../packages/astro-intl/src/runtime.ts');

    const config = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      entryId: 'collectionFolder',
      collections: {
        pages: { slugField: 'slug' },
      },
    });
    const collections = {
      pages: [
        {
          id: 'home/en',
          collection: 'pages',
          filePath: 'home/en.mdx',
          data: {
            locale: 'en',
            slug: '/',
            seoDesc: 'A new site built with Site Once.',
          },
        },
      ],
    };
    setIntlConfig(config);
    setIntlLoaders({
      getCollection: async (name) => collections[name as keyof typeof collections] ?? [],
      getAbsoluteLocaleUrl: (locale, path = '') =>
        `https://example.com/${locale}${path ? `/${path}` : ''}`,
    });

    try {
      assert.deepEqual(await getAlternatePaths('pages/home'), { en: '/' });

      const compiled = await compileGraph([
        path.join(srcDir, 'pages/_pages/home.astro'),
        ...sharedLayoutFiles,
      ]);

      const homeMod = await import(
        pathToFileURL(compiled.get(path.join(srcDir, 'pages/_pages/home.astro')) ?? '').href
      );
      const container = await AstroContainer.create();
      const html = await container.renderToString(homeMod.default, {
        props: {
          locale: 'en',
          entry: collections.pages[0],
        },
        request: new Request('https://example.com/en/'),
      });

      assert.match(html, /<html[^>]*lang="en"/);
      assert.match(html, /<title>Astro Stack<\/title>/);
      assert.match(html, /name="description"[^>]*content="A new site built with Site Once."/);
      assert.match(html, /rel="canonical"/);
      assert.match(html, /rel="alternate"[^>]*hreflang="en"/);
      assert.match(html, /rel="alternate"[^>]*hreflang="x-default"/);
      assert.doesNotMatch(html, /rel="alternate"[^>]*hreflang="de"/);
      assert.match(html, /application\/ld\+json/);
      assert.match(html, /"@type":"WebSite"/);
      assert.match(html, /<main class="[^"]*\bmeasure\b[^"]*\bflow\b/);
      assert.match(html, /<h1[^>]*>Astro Stack<\/h1>/);
      assert.match(html, /This placeholder ships with the starter/);
      assert.match(html, /rel="icon"/);
      assert.match(html, /aria-label="Language"/);
      assert.match(html, /href="\/de\/"/);
      assert.doesNotMatch(html, /href="\/de\/home/);
      assert.match(html, /aria-current="page"/);

      const blocksDir = path.join(repoRoot, 'packages/astro-site/src/components/blocks');
      for (const name of readdirSync(blocksDir).filter((file) => file.endsWith('.astro'))) {
        const source = readFileSync(path.join(blocksDir, name), 'utf8');
        assert.doesNotMatch(source, /\bt\s*\(/, `${name} must not call t()`);
        assert.doesNotMatch(source, /useTranslations/);
      }
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });
});

const listingPages = [
  {
    id: 'blog/en',
    collection: 'pages',
    filePath: 'blog/en.mdx',
    data: {
      locale: 'en',
      slug: 'blog',
      pageType: 'listing',
      seoTitle: 'Blog',
      seoDesc: 'Latest posts from this site.',
    },
  },
  {
    id: 'blog/de',
    collection: 'pages',
    filePath: 'blog/de.mdx',
    data: {
      locale: 'de',
      slug: 'artikel',
      pageType: 'listing',
      seoTitle: 'Blog',
      seoDesc: 'Aktuelle Beiträge dieser Site.',
    },
  },
];

const blogPosts = [
  {
    id: 'hello-world/en',
    collection: 'blog',
    filePath: 'hello-world/en.mdx',
    data: {
      locale: 'en',
      slug: 'blog/hello-world',
      seoTitle: 'Hello world',
      seoDesc: 'The first post on a site built with Site Once.',
      excerpt: 'This sample post ships with the starter.',
      pubDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'published',
      tags: ['announcements'],
      featImage: './feat.png',
      featImageAlt: 'Placeholder feature image',
    },
  },
  {
    id: 'hello-world/de',
    collection: 'blog',
    filePath: 'hello-world/de.mdx',
    data: {
      locale: 'de',
      slug: 'artikel/hallo-welt',
      seoTitle: 'Hallo Welt',
      seoDesc: 'Der erste Beitrag auf einer Site, gebaut mit Site Once.',
      excerpt: 'Dieser Beispielbeitrag liegt im Starter.',
      pubDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'published',
      tags: ['announcements'],
      featImage: './feat.png',
      featImageAlt: 'Platzhalter-Beitragsbild',
    },
  },
  {
    id: 'overwrite-container/en',
    collection: 'blog',
    filePath: 'overwrite-container/en.mdx',
    data: {
      locale: 'en',
      slug: 'blog/overwrite-container',
      seoTitle: 'Overwrite Measure',
      seoDesc: 'Tune a Measure with static measure classes.',
      excerpt: 'Put measure classes on the landmark.',
      pubDate: new Date('2026-01-15T00:00:00.000Z'),
      status: 'published',
      tags: ['engineering'],
      featImage: './feat.png',
      featImageAlt: 'Placeholder feature image',
    },
  },
  {
    id: 'overwrite-container/de',
    collection: 'blog',
    filePath: 'overwrite-container/de.mdx',
    data: {
      locale: 'de',
      slug: 'artikel/overwrite-container',
      seoTitle: 'Measure überschreiben',
      seoDesc: 'Measure mit statischen Klassen anpassen.',
      excerpt: 'Measure-Klassen ans Landmark.',
      pubDate: new Date('2026-01-15T00:00:00.000Z'),
      status: 'published',
      tags: ['engineering'],
      featImage: './feat.png',
      featImageAlt: 'Platzhalter-Beitragsbild',
    },
  },
];

const termPages = [
  {
    id: 'announcements/en',
    collection: 'tags',
    filePath: 'announcements/en.mdx',
    data: {
      locale: 'en',
      slug: 'tags/announcements',
      seoTitle: 'Announcements',
      seoDesc: 'Posts tagged announcements.',
    },
  },
  {
    id: 'announcements/de',
    collection: 'tags',
    filePath: 'announcements/de.mdx',
    data: {
      locale: 'de',
      slug: 'schlagworte/ankuendigungen',
      seoTitle: 'Ankündigungen',
      seoDesc: 'Beiträge zu Ankündigungen.',
    },
  },
  {
    id: 'engineering/en',
    collection: 'tags',
    filePath: 'engineering/en.mdx',
    data: {
      locale: 'en',
      slug: 'tags/engineering',
      seoTitle: 'Engineering',
      seoDesc: 'Posts tagged engineering.',
    },
  },
  {
    id: 'engineering/de',
    collection: 'tags',
    filePath: 'engineering/de.mdx',
    data: {
      locale: 'de',
      slug: 'schlagworte/technik',
      seoTitle: 'Technik',
      seoDesc: 'Beiträge zu Technik.',
    },
  },
];

const intlCollections = {
  pages: listingPages,
  blog: blogPosts,
  tags: termPages,
  authors: [],
};

function starterIntlConfig() {
  return defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    entryId: 'collectionFolder',
    collections: {
      pages: { slugField: 'slug' },
      blog: { slugField: 'slug' },
      tags: { slugField: 'slug' },
      authors: {},
    },
  });
}

async function withIntl<T>(run: () => Promise<T>): Promise<T> {
  const { resetIntlQuery, setIntlLoaders } = await import(
    '../../../packages/astro-intl/src/helpers.ts'
  );
  const { setIntlConfig } = await import('../../../packages/astro-intl/src/runtime.ts');
  setIntlConfig(starterIntlConfig());
  setIntlLoaders({
    getCollection: async (name) =>
      (intlCollections[name as keyof typeof intlCollections] ?? []) as never,
    getAbsoluteLocaleUrl: (locale, path = '') =>
      `https://example.com/${locale}${path ? `/${path}` : ''}`,
  });
  try {
    return await run();
  } finally {
    setIntlLoaders(undefined);
    setIntlConfig(undefined);
    resetIntlQuery();
  }
}

function assertHeadAndLandmark(html: string, locale: string) {
  assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
  assert.match(html, /rel="canonical"/);
  assert.match(html, new RegExp(`rel="alternate"[^>]*hreflang="${locale}"`));
  assert.match(html, /rel="alternate"[^>]*hreflang="x-default"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /<main class="[^"]*\bmeasure\b[^"]*\bflow\b/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /aria-label="(?:Language|Sprache)"/);
  assert.match(html, /aria-current="page"/);
}

describe('render listing, post, and term pages', () => {
  it('renders fixture en/de entries: listing queries posts, post may query related, term renders the term page', async () => {
    await withIntl(async () => {
      assert.deepEqual(await getAlternatePaths('pages/blog'), { en: 'blog', de: 'artikel' });
      assert.deepEqual(await getAlternatePaths('blog/hello-world'), {
        en: 'blog/hello-world',
        de: 'artikel/hallo-welt',
      });
      assert.deepEqual(await getAlternatePaths('tags/announcements'), {
        en: 'tags/announcements',
        de: 'schlagworte/ankuendigungen',
      });

      const compiled = await compileGraph(
        [
          path.join(srcDir, 'pages/_pages/listing.astro'),
          path.join(srcDir, 'pages/_pages/post.astro'),
          path.join(srcDir, 'pages/_pages/term.astro'),
          ...sharedLayoutFiles,
        ],
        { blog: blogPosts, tags: termPages },
      );
      const container = await AstroContainer.create();

      async function renderPage(
        file: string,
        locale: string,
        entry: unknown,
        url: string,
      ): Promise<string> {
        const mod = await import(pathToFileURL(compiled.get(file) ?? '').href);
        return container.renderToString(mod.default, {
          props: { locale, entry },
          request: new Request(url),
        });
      }

      const listingEn = await renderPage(
        path.join(srcDir, 'pages/_pages/listing.astro'),
        'en',
        listingPages[0],
        'https://example.com/en/blog/',
      );
      assertHeadAndLandmark(listingEn, 'en');
      assert.match(listingEn, /<title>Blog \| Astro Stack<\/title>/);
      assert.match(listingEn, /name="description"[^>]*content="Latest posts from this site."/);
      assert.match(listingEn, /<h1[^>]*>Blog<\/h1>/);
      assert.match(listingEn, /Hello world/);
      assert.match(listingEn, /href="\/en\/blog\/hello-world\/"/);
      assert.match(listingEn, /This sample post ships with the starter/);
      assert.match(listingEn, /Overwrite Measure/);
      assert.match(listingEn, /href="\/en\/blog\/overwrite-container\/"/);
      assert.match(listingEn, /Announcements/);
      assert.match(listingEn, /href="\/en\/tags\/announcements\/"/);
      assert.match(listingEn, /Engineering/);
      assert.match(listingEn, /href="\/en\/tags\/engineering\/"/);
      assert.doesNotMatch(listingEn, /Hallo Welt/);
      assert.match(listingEn, /href="\/de\/artikel\/"/);
      assert.match(listingEn, /rel="alternate"[^>]*hreflang="de"/);

      const listingDe = await renderPage(
        path.join(srcDir, 'pages/_pages/listing.astro'),
        'de',
        listingPages[1],
        'https://example.com/de/artikel/',
      );
      assertHeadAndLandmark(listingDe, 'de');
      assert.match(listingDe, /<h1[^>]*>Blog<\/h1>/);
      assert.match(listingDe, /Hallo Welt/);
      assert.match(listingDe, /href="\/de\/artikel\/hallo-welt\/"/);
      assert.match(listingDe, /Measure überschreiben/);
      assert.match(listingDe, /Ankündigungen/);
      assert.match(listingDe, /href="\/de\/schlagworte\/ankuendigungen\/"/);
      assert.match(listingDe, /Technik/);
      assert.match(listingDe, /href="\/de\/schlagworte\/technik\/"/);
      assert.doesNotMatch(listingDe, /Hello world/);
      assert.match(listingDe, /href="\/en\/blog\/"/);

      const postEn = await renderPage(
        path.join(srcDir, 'pages/_pages/post.astro'),
        'en',
        blogPosts[0],
        'https://example.com/en/blog/hello-world/',
      );
      assertHeadAndLandmark(postEn, 'en');
      assert.match(postEn, /<title>Hello world \| Astro Stack<\/title>/);
      assert.match(postEn, /property="og:type"[^>]*content="article"/);
      assert.match(postEn, /<article\b/);
      assert.match(postEn, /<h1[^>]*>Hello world<\/h1>/);
      assert.match(postEn, /datetime="2026-01-01T00:00:00.000Z"/);
      assert.match(postEn, /Announcements/);
      assert.match(postEn, /href="\/en\/tags\/announcements\/"/);
      assert.match(postEn, /"@type":"Article"/);
      assert.match(postEn, /<aside\b/);
      assert.match(postEn, /<h2[^>]*>Related<\/h2>/);
      assert.match(postEn, /Overwrite Measure/);
      assert.match(postEn, /href="\/en\/blog\/overwrite-container\/"/);
      assert.doesNotMatch(postEn, /Measure überschreiben/);
      assert.match(postEn, /href="\/de\/artikel\/hallo-welt\/"/);

      const postDe = await renderPage(
        path.join(srcDir, 'pages/_pages/post.astro'),
        'de',
        blogPosts[1],
        'https://example.com/de/artikel/hallo-welt/',
      );
      assertHeadAndLandmark(postDe, 'de');
      assert.match(postDe, /<h1[^>]*>Hallo Welt<\/h1>/);
      assert.match(postDe, /Ankündigungen/);
      assert.match(postDe, /href="\/de\/schlagworte\/ankuendigungen\/"/);
      assert.match(postDe, /<h2[^>]*>Ähnlich<\/h2>/);
      assert.match(postDe, /Measure überschreiben/);
      assert.match(postDe, /href="\/de\/artikel\/overwrite-container\/"/);
      assert.match(postDe, /href="\/en\/blog\/hello-world\/"/);

      const termEn = await renderPage(
        path.join(srcDir, 'pages/_pages/term.astro'),
        'en',
        termPages[0],
        'https://example.com/en/tags/announcements/',
      );
      assertHeadAndLandmark(termEn, 'en');
      assert.match(termEn, /<title>Announcements \| Astro Stack<\/title>/);
      assert.match(termEn, /<h1[^>]*>Announcements<\/h1>/);
      assert.match(termEn, /Posts tagged announcements/);
      assert.match(termEn, /Hello world/);
      assert.match(termEn, /href="\/en\/blog\/hello-world\/"/);
      assert.doesNotMatch(termEn, /Overwrite Measure/);
      assert.match(termEn, /href="\/de\/schlagworte\/ankuendigungen\/"/);

      const termDe = await renderPage(
        path.join(srcDir, 'pages/_pages/term.astro'),
        'de',
        termPages[1],
        'https://example.com/de/schlagworte/ankuendigungen/',
      );
      assertHeadAndLandmark(termDe, 'de');
      assert.match(termDe, /<h1[^>]*>Ankündigungen<\/h1>/);
      assert.match(termDe, /Beiträge zu Ankündigungen/);
      assert.match(termDe, /Hallo Welt/);
      assert.match(termDe, /href="\/de\/artikel\/hallo-welt\/"/);
      assert.doesNotMatch(termDe, /Measure überschreiben/);
      assert.match(termDe, /href="\/en\/tags\/announcements\/"/);
    });
  });
});
