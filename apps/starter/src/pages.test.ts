import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

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
