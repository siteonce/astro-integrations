import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineIntl, getAlternatePaths } from '@repo/astro-intl';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { localeSwitcherLinks } from './locale-switcher.ts';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const appRoot = path.join(srcDir, '..');
const repoRoot = path.join(appRoot, '../..');

const astroRequire = createRequire(createRequire(import.meta.url).resolve('astro/package.json'));
const { transform } = (await import(astroRequire.resolve('@astrojs/compiler-rs'))) as {
  transform: (source: string, options?: Record<string, unknown>) => { code: string };
};

const compileCache = path.join(appRoot, 'node_modules', '.cache', 'starter-layouts');

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
export function getAbsoluteLocaleUrl(locale, path = '') {
  return 'https://example.com' + getRelativeLocaleUrl(locale, path);
}
`,
  );
  const contentMock = path.join(dir, 'astro-content.mjs');
  await writeFile(
    contentMock,
    `export async function render() {
  throw new Error('astro:content render() is not available in this fixture');
}
`,
  );

  const siteBarrel = path.join(dir, 'astro-site-components.mjs');
  await writeFile(
    siteBarrel,
    `export { default as BaseLayout } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro')) ?? '').href)};
export { default as Seo } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro')) ?? '').href)};
export { default as Schema } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/astro/schema.astro')) ?? '').href)};
export { default as Hero } from ${JSON.stringify(pathToFileURL(compiled.get(path.join(repoRoot, 'packages/astro-site/src/components/blocks/hero.astro')) ?? '').href)};
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

describe('layout source', () => {
  it('does not add src/views or inline section UI in SiteLayout', () => {
    assert.equal(existsSync(path.join(srcDir, 'views')), false);
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

  it('home type layout owns head, landmark frame, t(), and blocks', () => {
    const home = readFileSync(new URL('./layouts/home.astro', import.meta.url), 'utf8');
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
      { en: 'blog/hello-world', de: 'blog/hallo-welt' },
      hrefFor,
    );
    assert.equal(withSibling[1]?.href, '/de/blog/hallo-welt/');
  });
});

describe('render home type layout', () => {
  it('renders a fixture en entry with missing de sibling', async () => {
    const { resetIntlQuery, setIntlLoaders } = await import(
      '../../../packages/astro-intl/src/helpers.ts'
    );
    const { setIntlConfig } = await import('../../../packages/astro-intl/src/runtime.ts');

    const config = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: {
        pages: { slugField: 'slug' },
      },
    });
    const collections = {
      pages: [
        {
          id: 'home-en',
          data: {
            id: 'home',
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
      assert.deepEqual(await getAlternatePaths('home'), { en: '/' });

      const compiled = await compileGraph([
        path.join(srcDir, 'layouts/home.astro'),
        path.join(srcDir, 'layouts/site-layout.astro'),
        path.join(srcDir, 'components/favicon.astro'),
        path.join(repoRoot, 'packages/astro-site/src/components/astro/base-layout.astro'),
        path.join(repoRoot, 'packages/astro-site/src/components/astro/seo.astro'),
        path.join(repoRoot, 'packages/astro-site/src/components/astro/schema.astro'),
        path.join(repoRoot, 'packages/astro-site/src/components/blocks/hero.astro'),
        path.join(repoRoot, 'packages/astro-intl/src/hreflang.astro'),
      ]);

      const homeMod = await import(
        pathToFileURL(compiled.get(path.join(srcDir, 'layouts/home.astro')) ?? '').href
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
