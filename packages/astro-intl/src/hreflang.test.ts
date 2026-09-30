import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';

// Inside this package so the prerender bundle resolves astro from its node_modules.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

describe('hreflang.astro', () => {
  it('prints exactly the links it is given', async () => {
    const links = [
      { hreflang: 'de', href: 'https://example.com/de/artikel/hallo' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/hello' },
    ];
    const fixture = await mkdtemp(path.join(packageRoot, '.hreflang-fixture-'));
    const previousNodeEnv = process.env.NODE_ENV;
    try {
      const pages = path.join(fixture, 'src', 'pages');
      await mkdir(pages, { recursive: true });
      const component = fileURLToPath(new URL('./hreflang.astro', import.meta.url));
      // Partial so the built file is the component output. A full page adds a doctype.
      await writeFile(
        path.join(pages, 'index.astro'),
        [
          '---',
          'export const partial = true;',
          `import Hreflang from ${JSON.stringify(component)};`,
          `const links = ${JSON.stringify(links)};`,
          '---',
          '<Hreflang links={links} />',
          '',
        ].join('\n'),
      );
      await build({
        root: fixture,
        outDir: path.join(fixture, 'dist'),
        configFile: false,
        logLevel: 'silent',
        compressHTML: false,
      });
      const html = await readFile(path.join(fixture, 'dist', 'index.html'), 'utf8');
      const expected = links
        .map((link) => `<link rel="alternate" hreflang="${link.hreflang}" href="${link.href}">`)
        .join('');
      assert.equal(html, expected);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
