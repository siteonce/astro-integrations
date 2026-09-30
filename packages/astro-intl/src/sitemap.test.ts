import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { defineIntl } from './define-intl.ts';
import astroIntl, { persistIntlSitemapEntries, type SitemapEntry } from './integration.ts';
import type { SitemapItemLike } from './sitemap.ts';

const cachePath = resolve(process.cwd(), 'node_modules/.astro/intl-sitemap-entries.json');

const enLoc = 'https://example.com/en/blog/hello-world';
const deLoc = 'https://example.com/de/artikel/hallo-welt';

const paired: SitemapEntry[] = [
  {
    locale: 'en',
    path: 'blog/hello-world',
    loc: enLoc,
    entryId: 'blog/hello-world',
    alternates: { en: enLoc, de: deLoc },
  },
  {
    locale: 'de',
    path: 'artikel/hallo-welt',
    loc: deLoc,
    entryId: 'blog/hello-world',
    alternates: { en: enLoc, de: deLoc },
  },
];

const homeTail: SitemapEntry = {
  locale: 'en',
  path: '/',
  loc: 'https://example.com/en',
  alternates: {
    en: 'https://example.com/en',
    de: 'https://example.com/de',
  },
};

const missingEntries =
  /no sitemap entries were persisted\. A prerendered route must call persistIntlSitemapEntries\(\)\./;

function config(defaultLocale: 'en' | 'de') {
  return defineIntl({
    locales: ['en', 'de'],
    defaultLocale,
    routing: { prefixDefaultLocale: true },
  });
}

type Intl = ReturnType<typeof astroIntl>;

function page(url: string): SitemapItemLike {
  return { url };
}

async function runBuildDone(intl: Intl): Promise<void> {
  const hook = intl.hooks['astro:build:done'];
  if (hook === undefined) throw new Error('astro:build:done is missing');
  await hook({ logger: { error() {} } } as never);
}

describe('sitemap options', { concurrency: false }, () => {
  afterEach(() => {
    rmSync(cachePath, { force: true });
  });

  it('attaches pairing alternates and x-default after persist', async () => {
    const intl = astroIntl(config('en'));
    persistIntlSitemapEntries(paired);

    const item = page(`${enLoc}/`);
    const serialized = await intl.sitemap.serialize(item);

    assert.deepEqual(serialized.links, [
      { lang: 'en', url: enLoc },
      { lang: 'de', url: deLoc },
      { lang: 'x-default', url: enLoc },
    ]);
  });

  it('adds x-default from the bound config default locale', async () => {
    persistIntlSitemapEntries(paired);
    const item = page(`${enLoc}/`);

    const enSerialized = await astroIntl(config('en')).sitemap.serialize(item);
    const deSerialized = await astroIntl(config('de')).sitemap.serialize(item);

    assert.deepEqual(enSerialized.links?.at(-1), { lang: 'x-default', url: enLoc });
    assert.deepEqual(deSerialized.links?.at(-1), { lang: 'x-default', url: deLoc });
  });

  it('leaves unknown pages unchanged', async () => {
    const intl = astroIntl(config('en'));
    persistIntlSitemapEntries(paired);

    const item = page('https://example.com/en/unknown/');
    const serialized = await intl.sitemap.serialize(item);
    assert.equal(serialized, item);
    assert.equal(serialized.links, undefined);
  });

  it('replaces customPages from persisted locs at build:done', async () => {
    const intl = astroIntl(config('en'));
    persistIntlSitemapEntries(paired);

    await runBuildDone(intl);
    assert.deepEqual(intl.sitemap.customPages, [enLoc, deLoc]);

    await runBuildDone(intl);
    assert.deepEqual(intl.sitemap.customPages, [enLoc, deLoc]);
  });

  it('includes a published tail that has no entry id', async () => {
    const intl = astroIntl(config('en'));
    persistIntlSitemapEntries([...paired, homeTail]);

    await runBuildDone(intl);

    assert.ok(intl.sitemap.customPages.includes(homeTail.loc));
  });

  it('does not share customPages or the entry cache across astroIntl calls', async () => {
    const first = astroIntl(config('en'));
    const second = astroIntl(config('de'));
    assert.notEqual(first.sitemap.customPages, second.sitemap.customPages);

    persistIntlSitemapEntries(paired);
    await runBuildDone(first);
    assert.deepEqual(first.sitemap.customPages, [enLoc, deLoc]);
    assert.deepEqual(second.sitemap.customPages, []);

    const item = page(`${enLoc}/`);
    const cached = await first.sitemap.serialize(item);
    assert.ok(cached.links?.some((link) => link.lang === 'de'));

    persistIntlSitemapEntries([
      {
        locale: 'en',
        path: 'blog/hello-world',
        loc: enLoc,
        alternates: { en: enLoc },
      },
    ]);

    assert.deepEqual((await first.sitemap.serialize(item)).links, cached.links);
    assert.deepEqual((await second.sitemap.serialize(item)).links, [{ lang: 'en', url: enLoc }]);
    assert.deepEqual(first.sitemap.customPages, [enLoc, deLoc]);
  });

  it('fails when no sitemap entries were persisted', async () => {
    rmSync(cachePath, { force: true });
    const intl = astroIntl(config('en'));
    await assert.rejects(runBuildDone(intl), missingEntries);
    assert.deepEqual(intl.sitemap.customPages, []);

    persistIntlSitemapEntries([]);
    await assert.rejects(astroIntl(config('en')).sitemap.serialize(page(enLoc)), missingEntries);
  });
});
