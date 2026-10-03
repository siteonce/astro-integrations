import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import type { SitemapEntry } from '@repo/astro-intl';
import type { AstroIntegration } from 'astro';
import { type IntlHooks, intlHooks } from './astro.ts';
import { intlConfig } from './fixtures.ts';

const enLoc = 'https://example.com/en/blog/hello-world';
const deLoc = 'https://example.com/de/artikel/hallo-welt';
const appPage = 'https://example.com/app-page';

/** Path of the build-only data route. The build writes `_intl/sitemap-entries.json`. */
const dataRoute = '/_intl/sitemap-entries.json';

/** Locale siblings of one entry, in the shape the data route writes. */
const helloEntries: SitemapEntry[] = [
  {
    locale: 'en',
    path: 'blog/hello-world',
    loc: enLoc,
    entryId: 'blog/hello-world',
    alternates: { en: enLoc, de: deLoc },
    xDefault: enLoc,
  },
  {
    locale: 'de',
    path: 'artikel/hallo-welt',
    loc: deLoc,
    entryId: 'blog/hello-world',
    alternates: { en: enLoc, de: deLoc },
    xDefault: enLoc,
  },
];

/** A published tail with no pairing id. */
const homeTail: SitemapEntry = {
  locale: 'en',
  path: '/',
  loc: 'https://example.com/en',
  alternates: {
    en: 'https://example.com/en',
    de: 'https://example.com/de',
  },
  xDefault: 'https://example.com/en',
};

/**
 * Build output the data route would have written.
 * A JSON list of sitemap entries at `<dir>/_intl/sitemap-entries.json`.
 */
async function writeSitemapData(dir: string, body: string): Promise<string> {
  const file = join(dir, '_intl', 'sitemap-entries.json');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
  return file;
}

/**
 * One sitemap item. `serialize` returns its argument type, so `links` is named here
 * even when the page passed in has none.
 */
type SitemapPage = {
  url: string;
  links?: { lang: string; url: string }[];
};

function page(url: string): SitemapPage {
  return { url };
}

function sitemapOf(hooks: IntlHooks) {
  assert.ok(hooks.integration);
  return hooks.integration.sitemap;
}

/** Writes `entries` as that build output, then runs `astro:build:done`. */
async function loadEntries(hooks: IntlHooks, entries: readonly SitemapEntry[]): Promise<void> {
  await writeSitemapData(hooks.root, JSON.stringify(entries));
  await hooks.buildDone();
}

describe('sitemap', () => {
  it("adds the entry's alternates and x-default", async (t) => {
    // The entry carries x-default as the en URL. defaultLocale is de.
    const hooks = await intlHooks(t, intlConfig({ defaultLocale: 'de' }));
    await loadEntries(hooks, helloEntries);

    const serialized = await sitemapOf(hooks).serialize(page(`${enLoc}/`));
    assert.deepEqual(serialized.links, [
      { lang: 'en', url: enLoc },
      { lang: 'de', url: deLoc },
      { lang: 'x-default', url: enLoc },
    ]);
  });

  it('omits x-default when the entry has none', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await loadEntries(hooks, [
      {
        locale: 'de',
        path: 'artikel/nur',
        loc: deLoc,
        alternates: { de: deLoc },
      },
    ]);

    const serialized = await sitemapOf(hooks).serialize(page(deLoc));
    assert.deepEqual(serialized.links, [{ lang: 'de', url: deLoc }]);
  });

  it('leaves a URL pairing does not know unchanged', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await loadEntries(hooks, helloEntries);

    const item = page('https://example.com/en/unknown/');
    const serialized = await sitemapOf(hooks).serialize(item);
    assert.equal(serialized, item);
    assert.equal(serialized.links, undefined);
  });

  it('keeps URLs the app added to customPages across builds', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    const sitemap = sitemapOf(hooks);
    sitemap.customPages.push(appPage, enLoc);

    await loadEntries(hooks, helloEntries);
    assert.deepEqual(sitemap.customPages, [appPage, enLoc, enLoc, deLoc]);

    await loadEntries(hooks, helloEntries);
    assert.deepEqual(sitemap.customPages, [appPage, enLoc, enLoc, deLoc]);

    sitemap.customPages.push('https://example.com/added-between');
    // This build publishes only the en URL, so the previous de URL leaves.
    await loadEntries(hooks, helloEntries.slice(0, 1));
    assert.deepEqual(sitemap.customPages, [
      appPage,
      enLoc,
      'https://example.com/added-between',
      enLoc,
    ]);
  });

  it('lists a published tail that has no entry', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    await loadEntries(hooks, [...helloEntries, homeTail]);
    const sitemap = sitemapOf(hooks);

    assert.deepEqual(sitemap.customPages, [enLoc, deLoc, 'https://example.com/en']);
    assert.deepEqual((await sitemap.serialize(page('https://example.com/en'))).links, [
      { lang: 'en', url: 'https://example.com/en' },
      { lang: 'de', url: 'https://example.com/de' },
      { lang: 'x-default', url: 'https://example.com/en' },
    ]);
  });

  it('keeps customPages and alternates on the astroIntl call that loaded them', async (t) => {
    const first = await intlHooks(t, intlConfig());
    const second = await intlHooks(t, intlConfig());
    const firstSitemap = sitemapOf(first);
    const secondSitemap = sitemapOf(second);
    assert.notEqual(firstSitemap.customPages, secondSitemap.customPages);

    await loadEntries(first, helloEntries);
    assert.deepEqual(firstSitemap.customPages, [enLoc, deLoc]);
    assert.deepEqual(secondSitemap.customPages, []);

    const item = page(`${enLoc}/`);
    const cached = await firstSitemap.serialize(item);
    assert.deepEqual(cached.links, [
      { lang: 'en', url: enLoc },
      { lang: 'de', url: deLoc },
      { lang: 'x-default', url: enLoc },
    ]);

    await loadEntries(second, [
      {
        locale: 'en',
        path: 'blog/hello-world',
        loc: enLoc,
        alternates: { en: enLoc },
        xDefault: enLoc,
      },
    ]);

    assert.deepEqual((await firstSitemap.serialize(item)).links, cached.links);
    assert.deepEqual((await secondSitemap.serialize(item)).links, [
      { lang: 'en', url: enLoc },
      { lang: 'x-default', url: enLoc },
    ]);
    assert.deepEqual(firstSitemap.customPages, [enLoc, deLoc]);
    assert.deepEqual(secondSitemap.customPages, [enLoc]);
  });

  it('fails the build when the data route was not built', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    const sitemap = sitemapOf(hooks);
    sitemap.customPages.push(appPage);

    await assert.rejects(() => hooks.buildDone(), {
      message: '@repo/astro-intl: the sitemap data route was not built.',
    });
    assert.deepEqual(sitemap.customPages, [appPage]);
  });

  it('accepts a build that published no URLs and removes the data file', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    const sitemap = sitemapOf(hooks);
    sitemap.customPages.push(appPage);
    const file = await writeSitemapData(hooks.root, '[]');

    await hooks.buildDone();
    assert.deepEqual(sitemap.customPages, [appPage]);
    const item = page(enLoc);
    assert.equal(await sitemap.serialize(item), item);
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(dirname(file)), false);
  });

  it('fails the build when the data file is not a list', async (t) => {
    for (const body of ['', ' \n\t']) {
      const hooks = await intlHooks(t, intlConfig());
      const sitemap = sitemapOf(hooks);
      await writeSitemapData(hooks.root, body);

      await assert.rejects(() => hooks.buildDone(), {
        message: '@repo/astro-intl: the sitemap data route did not return a list.',
      });
      assert.deepEqual(sitemap.customPages, []);
    }
  });

  it('removes the data file and leaves the rest of _intl', async (t) => {
    const hooks = await intlHooks(t, intlConfig());
    const file = await writeSitemapData(hooks.root, JSON.stringify(helloEntries));
    const sibling = join(dirname(file), 'keep.txt');
    await writeFile(sibling, 'keep');

    await hooks.buildDone();
    assert.deepEqual(sitemapOf(hooks).customPages, [enLoc, deLoc]);
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(sibling), true);
    assert.equal(existsSync(dirname(file)), true);
  });

  it('drops only the data route', async (t) => {
    const { filter } = sitemapOf(await intlHooks(t, intlConfig()));

    for (const url of [
      `https://example.com${dataRoute}`,
      `https://example.com${dataRoute}/`,
      `https://example.com${dataRoute}?x=1`,
    ]) {
      assert.equal(filter(url), false, url);
    }
    for (const url of [
      'https://example.com/en/blog/',
      'https://example.com/en/_intl/sitemap-entries.json',
      'https://example.com/_intl/other.json',
      'https://example.com/sitemap-entries.json',
      'https://example.com/blog/_intl/sitemap-entries.json',
      'not a url',
    ]) {
      assert.equal(filter(url), true, url);
    }
  });

  it('drops the data route under the site base and nowhere else', async (t) => {
    for (const base of ['/docs', '/docs/']) {
      const hooks = await intlHooks(t, intlConfig());
      await hooks.setup({ base });
      const { filter } = sitemapOf(hooks);
      const route = `https://example.com/docs${dataRoute}`;

      assert.equal(filter(route), false, base);
      assert.equal(filter(`${route}/`), false, base);
      assert.equal(filter('https://example.com/docs/en/blog/'), true, base);
      assert.equal(filter(`https://example.com${dataRoute}`), true, base);
      assert.equal(filter('https://example.com/docs/sitemap-entries.json'), true, base);
      assert.equal(filter('https://example.com/docs/blog/_intl/sitemap-entries.json'), true, base);
      assert.equal(filter('not a url'), true, base);
    }
  });

  it('injects the data route only during build', async (t) => {
    for (const command of ['dev', 'preview', 'sync'] as const) {
      const hooks = await intlHooks(t, intlConfig());
      await hooks.setup({ command });
      assert.deepEqual(
        hooks.injected.map((route) => route.pattern),
        [],
        command,
      );
    }

    const hooks = await intlHooks(t, intlConfig({ fallbackView: 'missing' }));
    await hooks.setup({ command: 'build' });
    assert.deepEqual(
      hooks.injected.map((route) => ({ pattern: route.pattern, prerender: route.prerender })),
      [{ pattern: dataRoute, prerender: true }],
    );
    const data = hooks.injected[0];
    assert.ok(data);
    const source = await readFile(data.entrypoint, 'utf8');
    assert.ok(source.includes('export const prerender = true;'));
    assert.ok(
      source.includes('return new Response(JSON.stringify(await intl.getSitemapEntries()));'),
    );
    assert.ok(
      source.includes(
        'createIntl({"locales":["en","de"],"defaultLocale":"en","routing":{"prefixDefaultLocale":true},"fallbackView":"missing"})',
      ),
    );
  });

  it('prerenders the data route when viewRendering is request', async (t) => {
    const hooks = await intlHooks(
      t,
      intlConfig({
        viewRendering: 'request',
        routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
      }),
    );
    const view = join(hooks.root, 'src', 'views', 'about.astro');
    await mkdir(dirname(view), { recursive: true });
    await writeFile(view, '');
    await hooks.setup({
      adapter: { name: '@astrojs/node', hooks: {} } as AstroIntegration,
    });

    const data = hooks.injected.find((route) => route.pattern === dataRoute);
    assert.ok(data);
    assert.equal(data.prerender, true);
    assert.deepEqual(
      hooks.injected.filter((route) => route.pattern !== dataRoute).map((route) => route.prerender),
      [false, false],
    );
  });
});
