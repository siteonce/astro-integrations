import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineIntl, getRoutedStaticPaths } from '@repo/astro-intl';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { missingLocaleChain } from './missing-locale.ts';
import { typeLayoutName } from './type-layout.ts';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const appRoot = path.join(srcDir, '..');
const repoRoot = path.join(appRoot, '../..');

const astroRequire = createRequire(createRequire(import.meta.url).resolve('astro/package.json'));
const { transform } = (await import(astroRequire.resolve('@astrojs/compiler-rs'))) as {
  transform: (source: string, options?: Record<string, unknown>) => { code: string };
};

const compileCache = path.join(appRoot, 'node_modules', '.cache', 'starter-pages');

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

async function compileGraph(files: string[]) {
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
`,
  );

  const siteBarrel = path.join(dir, 'astro-site-components.mjs');
  await writeFile(
    siteBarrel,
    `export { default as BaseLayout } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro')) ?? '').href)};
export { default as Seo } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro')) ?? '').href)};
export { default as NotFound } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/blocks/not-found.astro')) ?? '').href)};
`,
  );

  function rewriteSpecifier(fromFile: string, specifier: string): string | undefined {
    if (specifier === 'astro:i18n') return pathToFileURL(i18nMock).href;
    if (specifier === '@repo/astro-site/components') return pathToFileURL(siteBarrel).href;
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

describe('root index', () => {
  const source = readFileSync(new URL('./pages/index.astro', import.meta.url), 'utf8');

  it('only redirects to /en/', () => {
    assert.match(source, /Astro\.redirect\(\s*['"]\/en\/['"]\s*\)/);
    assert.doesNotMatch(source, /<html\b/);
    assert.doesNotMatch(source, /localeSwitcher/);
    assert.doesNotMatch(source, /<nav\b/);
    assert.doesNotMatch(source, /<SiteLayout\b/);
  });
});

describe('404 template', () => {
  const source = readFileSync(new URL('./pages/404.astro', import.meta.url), 'utf8');

  it('uses catalog chrome, copied Seo, and blocks without a type layout', () => {
    assert.match(source, /useTranslations/);
    assert.match(source, /<Seo\b/);
    assert.match(source, /siteConfig=\{siteConfig\}/);
    assert.match(source, /<NotFound\b/);
    assert.match(source, /from ['"]@repo\/astro-site\/components['"]/);
    assert.match(source, /from ['"]\.\.\/layouts\/site-layout\.astro['"]/);
    assert.doesNotMatch(source, /from ['"]\.\.\/layouts\/(?:home|listing|post|term)\.astro['"]/);
    assert.doesNotMatch(source, /from ['"]@repo\/astro['"/]/);
  });
});

describe('render 404', () => {
  it('emits catalog strings, Seo, NotFound, and the SiteLayout / BaseLayout shell', async () => {
    const compiled = await compileGraph([
      path.join(srcDir, 'pages/404.astro'),
      path.join(srcDir, 'layouts/site-layout.astro'),
      path.join(srcDir, 'components/favicon.astro'),
      path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro'),
      path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro'),
      path.join(repoRoot, 'packages/astro-site/src/components/blocks/not-found.astro'),
    ]);

    const notFoundMod = await import(
      pathToFileURL(compiled.get(path.join(srcDir, 'pages/404.astro')) ?? '').href
    );
    const container = await AstroContainer.create();
    const html = await container.renderToString(notFoundMod.default, {
      request: new Request('https://example.com/missing-path/'),
    });

    assert.match(html, /<html[^>]*lang="en"/);
    assert.match(html, /<title>Page not found \| Astro Stack<\/title>/);
    assert.match(
      html,
      /name="description"[^>]*content="The page you're looking for doesn't exist or has moved."/,
    );
    assert.match(html, /name="robots"[^>]*content="noindex, nofollow"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
    assert.match(html, /exist or has moved/);
    assert.match(html, /href="\/en\/"/);
    assert.match(html, /Back to home/);
    assert.match(html, /rel="icon"/);
    assert.match(html, /aria-label="Language"/);
    assert.match(html, /href="\/de\/"/);
    assert.match(html, /<main class="[^"]*\bmeasure\b[^"]*\bflow\b/);
  });
});

const catchAllUrl = new URL('./pages/[locale]/[...path].astro', import.meta.url);
const catchAllFile = fileURLToPath(catchAllUrl);
const pagesDir = path.join(srcDir, 'pages');

function listPageFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) {
      out.push(...listPageFiles(path.join(dir, name.name), rel));
      continue;
    }
    out.push(rel);
  }
  return out;
}

describe('catch-all source', () => {
  const source = readFileSync(catchAllUrl, 'utf8');

  it('is the CMS router: getStaticPaths, lookup, missing-locale, type layout', () => {
    assert.equal(existsSync(catchAllFile), true);
    assert.match(source, /export function getStaticPaths/);
    assert.match(source, /getRoutedStaticPaths/);
    assert.match(source, /getContentByPath/);
    assert.match(source, /setIntlConfig/);
    assert.match(source, /missingLocaleChain/);
    assert.match(source, /typeLayoutName/);
    assert.match(source, /from ['"]\.\.\/\.\.\/layouts\/home\.astro['"]/);
    assert.match(source, /from ['"]\.\.\/\.\.\/layouts\/listing\.astro['"]/);
    assert.match(source, /from ['"]\.\.\/\.\.\/layouts\/post\.astro['"]/);
    assert.match(source, /from ['"]\.\.\/\.\.\/layouts\/term\.astro['"]/);
    assert.match(source, /locale=\{locale\}/);
    assert.match(source, /entry=\{entry/);
    assert.match(source, /Astro\.redirect/);
    assert.match(source, /Astro\.rewrite\(\s*['"]\/404['"]\s*\)/);
    assert.doesNotMatch(source, /from ['"]astro:content['"]/);
    assert.doesNotMatch(source, /from ['"]@repo\/astro['"/]/);
  });

  it('does not compose blocks or inline section UI', () => {
    assert.doesNotMatch(source, /\bHero\b/);
    assert.doesNotMatch(source, /\bPostList\b/);
    assert.doesNotMatch(source, /\bArticle\b/);
    assert.doesNotMatch(source, /\bRelatedPosts\b/);
    assert.doesNotMatch(source, /\bNotFound\b/);
    assert.doesNotMatch(source, /<section\b/);
    assert.doesNotMatch(source, /<h1\b/);
    assert.doesNotMatch(source, /<article\b/);
    assert.doesNotMatch(source, /<main\b/);
  });
});

describe('pages file routes', () => {
  it('has no extra content file routes', () => {
    const files = listPageFiles(pagesDir).sort();
    assert.deepEqual(files, [
      '404.astro',
      '[locale]/[...path].astro',
      '[locale]/rss.xml.ts',
      'index.astro',
      'robots.txt.ts',
    ]);
    for (const file of files) {
      assert.doesNotMatch(file, /(^|\/)about\.astro$/);
    }
  });
});

describe('type layout map', () => {
  it('picks from collection / page type', () => {
    assert.equal(typeLayoutName({ collection: 'pages', data: { pageType: 'home' } }), 'home');
    assert.equal(typeLayoutName({ collection: 'pages', data: { pageType: 'listing' } }), 'listing');
    assert.equal(typeLayoutName({ collection: 'blog', data: {} }), 'post');
    assert.equal(typeLayoutName({ collection: 'tags', data: {} }), 'term');
    assert.throws(() => typeLayoutName({ collection: 'authors', data: {} }));
    assert.throws(() => typeLayoutName({ collection: 'pages', data: { pageType: 'contact' } }));
  });
});

describe('missing-locale chain', () => {
  const hrefFor = (locale: string, path?: string) => (path ? `/${locale}/${path}/` : `/${locale}/`);

  it('redirects a missing sibling to the default-locale document', async () => {
    const result = await missingLocaleChain({
      locale: 'de',
      path: 'only-in-en',
      defaultLocale: 'en',
      getContentByPath: async (locale, path) => {
        if (locale === 'en' && path === 'only-in-en') return { data: { id: 'solo' } };
        if (path === '/') return { data: { id: 'home' } };
        return undefined;
      },
      getAlternatePaths: async (entryId): Promise<Record<string, string>> =>
        entryId === 'solo' ? { en: 'only-in-en' } : {},
      hrefFor,
    });
    assert.deepEqual(result, { kind: 'redirect', href: '/en/only-in-en/' });
  });

  it('falls back to home in the requested locale, then 404', async () => {
    const toHome = await missingLocaleChain({
      locale: 'de',
      path: 'missing',
      defaultLocale: 'en',
      getContentByPath: async (locale, path) =>
        path === '/' && locale === 'de' ? { data: { id: 'home' } } : undefined,
      getAlternatePaths: async () => ({}),
      hrefFor,
    });
    assert.deepEqual(toHome, { kind: 'redirect', href: '/de/' });

    const missing = await missingLocaleChain({
      locale: 'de',
      path: 'missing',
      defaultLocale: 'en',
      getContentByPath: async () => undefined,
      getAlternatePaths: async () => ({}),
      hrefFor,
    });
    assert.deepEqual(missing, { kind: 'not-found' });
  });
});

const routedFixtures = {
  pages: [
    {
      id: 'pages/home/en',
      collection: 'pages',
      data: { id: 'home', locale: 'en', slug: '/', pageType: 'home' },
    },
    {
      id: 'pages/home/de',
      collection: 'pages',
      data: { id: 'home', locale: 'de', slug: '/', pageType: 'home' },
    },
    {
      id: 'pages/blog/en',
      collection: 'pages',
      data: { id: 'blog', locale: 'en', slug: 'blog', pageType: 'listing' },
    },
    {
      id: 'pages/blog/de',
      collection: 'pages',
      data: { id: 'blog', locale: 'de', slug: 'blog', pageType: 'listing' },
    },
  ],
  blog: [
    {
      id: 'blog/hello-world/en',
      collection: 'blog',
      data: { id: 'hello-world', locale: 'en', slug: 'hello-world' },
    },
    {
      id: 'blog/hello-world/de',
      collection: 'blog',
      data: { id: 'hello-world', locale: 'de', slug: 'hallo-welt' },
    },
    {
      id: 'blog/overwrite-container/en',
      collection: 'blog',
      data: { id: 'overwrite-container', locale: 'en', slug: 'overwrite-container' },
    },
    {
      id: 'blog/overwrite-container/de',
      collection: 'blog',
      data: { id: 'overwrite-container', locale: 'de', slug: 'overwrite-container' },
    },
  ],
  tags: [
    {
      id: 'tags/announcements/en',
      collection: 'tags',
      data: { id: 'announcements', locale: 'en', slug: 'announcements' },
    },
    {
      id: 'tags/announcements/de',
      collection: 'tags',
      data: { id: 'announcements', locale: 'de', slug: 'ankuendigungen' },
    },
  ],
  authors: [{ id: 'authors/demo/en', collection: 'authors', data: { id: 'demo', locale: 'en' } }],
};

function starterIntlConfig() {
  return defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    collections: {
      pages: { slugField: 'slug' },
      blog: { pathPrefix: 'blog' },
      tags: { pathPrefix: 'tags' },
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
      (routedFixtures[name as keyof typeof routedFixtures] ?? []) as never,
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

function paramKey(item: { params: { locale: string; path: string | undefined } }) {
  return `${item.params.locale}:${item.params.path ?? '/'}`;
}

describe('catch-all getStaticPaths', () => {
  it('emits compiled paths for home, listing, posts, and term pages', async () => {
    await withIntl(async () => {
      const paths = await getRoutedStaticPaths();
      const keys = new Set(paths.map(paramKey));
      assert.equal(keys.has('en:/'), true);
      assert.equal(keys.has('de:/'), true);
      assert.equal(keys.has('en:blog'), true);
      assert.equal(keys.has('de:blog'), true);
      assert.equal(keys.has('en:blog/hello-world'), true);
      assert.equal(keys.has('de:blog/hallo-welt'), true);
      assert.equal(keys.has('en:blog/overwrite-container'), true);
      assert.equal(keys.has('de:blog/overwrite-container'), true);
      assert.equal(keys.has('en:tags/announcements'), true);
      assert.equal(keys.has('de:tags/ankuendigungen'), true);
      assert.equal(
        paths.some((item) => item.params.path?.includes('authors')),
        false,
      );
      assert.equal(paths.filter((item) => item.params.path === 'blog').length, 2);
    });
  });
});

const typeLayouts = ['home', 'listing', 'post', 'term'] as const;

async function compileCatchAll() {
  await mkdir(compileCache, { recursive: true });
  const dir = await mkdtemp(path.join(compileCache, 'catchall-'));
  const compiled = new Map<string, string>();
  compiled.set(catchAllFile, path.join(dir, 'path.mjs'));
  for (const name of typeLayouts) {
    compiled.set(path.join(srcDir, `layouts/${name}.astro`), path.join(dir, `${name}.mjs`));
  }

  const i18nMock = path.join(dir, 'astro-i18n.mjs');
  await writeFile(
    i18nMock,
    `export function getRelativeLocaleUrl(locale, path = '') {
  if (!path || path === '/') return '/' + locale + '/';
  const tail = String(path).replace(/^\\/+|\\/+$/g, '');
  return '/' + locale + '/' + tail + '/';
}
`,
  );

  function rewriteSpecifier(fromFile: string, specifier: string): string | undefined {
    if (specifier === 'astro:i18n') return pathToFileURL(i18nMock).href;
    const resolved = resolveSpecifier(fromFile, specifier);
    if (compiled.has(resolved)) return pathToFileURL(compiled.get(resolved) ?? '').href;
    if (specifier.startsWith('.')) {
      const withAstro = resolved.endsWith('.astro') ? resolved : `${resolved}.astro`;
      if (compiled.has(withAstro)) return pathToFileURL(compiled.get(withAstro) ?? '').href;
      return pathToFileURL(resolved).href;
    }
    return undefined;
  }

  for (const name of typeLayouts) {
    const file = path.join(srcDir, `layouts/${name}.astro`);
    const source = `---
const { locale, entry } = Astro.props;
---
<div data-type-layout="${name}" data-locale={locale} data-entry-id={entry.data.id}></div>
`;
    const result = transform(source, {
      filename: `${name}.astro`,
      internalURL: 'astro/compiler-runtime',
      resultScopedSlot: true,
    });
    await writeFile(compiled.get(file) ?? '', toRunnableModule(result.code));
  }

  const source = readFileSync(catchAllFile, 'utf8');
  const result = transform(source, {
    filename: '[...path].astro',
    internalURL: 'astro/compiler-runtime',
    resultScopedSlot: true,
  });
  let code = toRunnableModule(result.code);
  code = code.replace(/from\s+['"]([^'"]+)['"]/g, (full, specifier: string) => {
    const next = rewriteSpecifier(catchAllFile, specifier);
    return next ? `from ${JSON.stringify(next)}` : full;
  });
  code = code.replace(/import\s+['"]([^'"]+)['"]/g, (full, specifier: string) => {
    const next = rewriteSpecifier(catchAllFile, specifier);
    return next ? `import ${JSON.stringify(next)}` : full;
  });
  await writeFile(compiled.get(catchAllFile) ?? '', code);
  return compiled;
}

describe('render catch-all', () => {
  it('picks the matching type layout and passes locale + entry', async () => {
    await withIntl(async () => {
      const compiled = await compileCatchAll();
      const mod = await import(pathToFileURL(compiled.get(catchAllFile) ?? '').href);
      const paths = await mod.getStaticPaths();
      const keys = new Set(
        paths.map((item: { params: { locale: string; path: string | undefined } }) =>
          paramKey(item),
        ),
      );
      assert.equal(keys.has('en:/'), true);
      assert.equal(keys.has('de:blog/hallo-welt'), true);
      assert.equal(keys.has('en:tags/announcements'), true);

      const container = await AstroContainer.create();

      async function renderPath(locale: string, rest: string | undefined, url: string) {
        return container.renderToString(mod.default, {
          params: { locale, path: rest },
          request: new Request(url),
        });
      }

      const home = await renderPath('en', undefined, 'https://example.com/en/');
      assert.match(home, /data-type-layout="home"/);
      assert.match(home, /data-locale="en"/);
      assert.match(home, /data-entry-id="home"/);

      const listing = await renderPath('de', 'blog', 'https://example.com/de/blog/');
      assert.match(listing, /data-type-layout="listing"/);
      assert.match(listing, /data-locale="de"/);
      assert.match(listing, /data-entry-id="blog"/);

      const post = await renderPath(
        'de',
        'blog/hallo-welt',
        'https://example.com/de/blog/hallo-welt/',
      );
      assert.match(post, /data-type-layout="post"/);
      assert.match(post, /data-locale="de"/);
      assert.match(post, /data-entry-id="hello-world"/);

      const term = await renderPath(
        'en',
        'tags/announcements',
        'https://example.com/en/tags/announcements/',
      );
      assert.match(term, /data-type-layout="term"/);
      assert.match(term, /data-locale="en"/);
      assert.match(term, /data-entry-id="announcements"/);
    });
  });
});
