import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineIntl } from './define-intl.ts';
import astroIntl, { type SitemapEntry } from './integration.ts';
import { SITEMAP_DATA_PATH, type SitemapItemLike } from './sitemap.ts';

const enLoc = 'https://example.com/en/blog/hello-world';
const deLoc = 'https://example.com/de/artikel/hallo-welt';
const appPage = 'https://example.com/app-page';

const paired: SitemapEntry[] = [
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

const missingDataRoute = /the sitemap data route was not built/;

function config(defaultLocale: 'en' | 'de') {
  return defineIntl({
    locales: ['en', 'de'],
    defaultLocale,
    routing: { prefixDefaultLocale: true },
  });
}

type Intl = ReturnType<typeof astroIntl>;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeDir(): Promise<URL> {
  const root = await mkdtemp(join(tmpdir(), 'astro-intl-sitemap-'));
  tempRoots.push(root);
  return pathToFileURL(`${root}/`);
}

function dataPath(dir: URL): string {
  return join(filePath(dir), '_intl', 'sitemap-entries.json');
}

function filePath(dir: URL): string {
  return fileURLToPath(dir);
}

async function writeEntries(dir: URL, entries: SitemapEntry[], body?: string): Promise<string> {
  const file = dataPath(dir);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body ?? JSON.stringify(entries));
  return file;
}

function page(url: string): SitemapItemLike {
  return { url };
}

async function runBuildDone(intl: Intl, dir: URL): Promise<void> {
  const hook = intl.hooks['astro:build:done'];
  if (hook === undefined) throw new Error('astro:build:done is missing');
  await hook({ dir, logger: { error() {} } } as never);
}

async function load(intl: Intl, entries: SitemapEntry[]): Promise<URL> {
  const dir = await makeDir();
  await writeEntries(dir, entries);
  await runBuildDone(intl, dir);
  return dir;
}

function silentLogger() {
  const logger = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    fork() {
      return logger;
    },
  };
  return logger;
}

async function useBase(base: string): Promise<Intl> {
  const intl = astroIntl(config('en'));
  const dir = await makeDir();
  const root = filePath(dir);
  const codegen = join(root, 'codegen');
  await mkdir(codegen, { recursive: true });
  const setup = intl.hooks['astro:config:setup'];
  assert.ok(setup);
  await setup({
    command: 'dev',
    config: {
      root: dir,
      srcDir: pathToFileURL(`${join(root, 'src')}/`),
      base,
      integrations: [],
    },
    updateConfig() {
      return {};
    },
    injectRoute() {},
    createCodegenDir() {
      return pathToFileURL(`${codegen}/`);
    },
    logger: silentLogger(),
  } as never);
  return intl;
}

describe('sitemap options', { concurrency: false }, () => {
  it('attaches pairing alternates and x-default from the entry', async () => {
    const intl = astroIntl(config('de'));
    await load(intl, paired);

    const serialized = await intl.sitemap.serialize(page(`${enLoc}/`));

    assert.deepEqual(serialized.links, [
      { lang: 'en', url: enLoc },
      { lang: 'de', url: deLoc },
      { lang: 'x-default', url: enLoc },
    ]);
  });

  it('omits x-default when the entry has none', async () => {
    const intl = astroIntl(config('en'));
    await load(intl, [
      {
        locale: 'de',
        path: 'artikel/nur',
        loc: deLoc,
        alternates: { de: deLoc },
      },
    ]);

    const serialized = await intl.sitemap.serialize(page(deLoc));
    assert.deepEqual(serialized.links, [{ lang: 'de', url: deLoc }]);
  });

  it('leaves unknown pages unchanged', async () => {
    const intl = astroIntl(config('en'));
    await load(intl, paired);

    const item = page('https://example.com/en/unknown/');
    const serialized = await intl.sitemap.serialize(item);
    assert.equal(serialized, item);
    assert.equal(serialized.links, undefined);
  });

  it('keeps app-added customPages across two builds', async () => {
    const intl = astroIntl(config('en'));
    const between = 'https://example.com/added-between';
    intl.sitemap.customPages.push(appPage, enLoc);

    await load(intl, paired);
    assert.deepEqual(intl.sitemap.customPages, [appPage, enLoc, enLoc, deLoc]);

    await load(intl, paired);
    assert.deepEqual(intl.sitemap.customPages, [appPage, enLoc, enLoc, deLoc]);

    intl.sitemap.customPages.push(between);
    await load(intl, [paired[0]]);
    assert.deepEqual(intl.sitemap.customPages, [appPage, enLoc, between, enLoc]);
  });

  it('includes a published tail that has no entry id', async () => {
    const intl = astroIntl(config('en'));
    await load(intl, [...paired, homeTail]);

    assert.ok(intl.sitemap.customPages.includes(homeTail.loc));
  });

  it('does not share customPages or loaded entries across astroIntl calls', async () => {
    const first = astroIntl(config('en'));
    const second = astroIntl(config('de'));
    assert.notEqual(first.sitemap.customPages, second.sitemap.customPages);

    await load(first, paired);
    assert.deepEqual(first.sitemap.customPages, [enLoc, deLoc]);
    assert.deepEqual(second.sitemap.customPages, []);

    const item = page(`${enLoc}/`);
    const cached = await first.sitemap.serialize(item);
    assert.ok(cached.links?.some((link) => link.lang === 'de'));

    await load(second, [
      {
        locale: 'en',
        path: 'blog/hello-world',
        loc: enLoc,
        alternates: { en: enLoc },
        xDefault: enLoc,
      },
    ]);

    assert.deepEqual((await first.sitemap.serialize(item)).links, cached.links);
    assert.deepEqual((await second.sitemap.serialize(item)).links, [
      { lang: 'en', url: enLoc },
      { lang: 'x-default', url: enLoc },
    ]);
    assert.deepEqual(first.sitemap.customPages, [enLoc, deLoc]);
    assert.deepEqual(second.sitemap.customPages, [enLoc]);
  });

  it('fails when the data route was not built', async () => {
    const intl = astroIntl(config('en'));
    intl.sitemap.customPages.push(appPage);
    const dir = await makeDir();
    await assert.rejects(runBuildDone(intl, dir), missingDataRoute);
    assert.deepEqual(intl.sitemap.customPages, [appPage]);
  });

  it('accepts an empty entry list', async () => {
    const intl = astroIntl(config('en'));
    intl.sitemap.customPages.push(appPage);
    const dir = await makeDir();
    const file = await writeEntries(dir, []);
    await runBuildDone(intl, dir);
    assert.deepEqual(intl.sitemap.customPages, [appPage]);
    const item = page(enLoc);
    assert.equal(await intl.sitemap.serialize(item), item);
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(dirname(file)), false);
  });

  it('rejects an empty file', async () => {
    for (const body of ['', ' \n\t']) {
      const intl = astroIntl(config('en'));
      const dir = await makeDir();
      await writeEntries(dir, [], body);
      await assert.rejects(runBuildDone(intl, dir), /did not return a list/);
      assert.deepEqual(intl.sitemap.customPages, []);
    }
  });

  it('deletes the data file and keeps _intl when another file is in it', async () => {
    const intl = astroIntl(config('en'));
    const dir = await makeDir();
    const file = await writeEntries(dir, paired);
    const sibling = join(dirname(file), 'keep.txt');
    writeFileSync(sibling, 'keep');
    await runBuildDone(intl, dir);
    assert.equal(existsSync(file), false);
    assert.equal(existsSync(sibling), true);
    assert.equal(existsSync(dirname(file)), true);
  });

  it('drops only the data route', () => {
    const intl = astroIntl(config('en'));
    const route = `https://example.com${SITEMAP_DATA_PATH}`;
    assert.equal(intl.sitemap.filter(route), false);
    assert.equal(intl.sitemap.filter(`${route}/`), false);
    assert.equal(intl.sitemap.filter(`${route}?x=1`), false);
    assert.equal(intl.sitemap.filter('https://example.com/en/blog/'), true);
    assert.equal(intl.sitemap.filter('https://example.com/en/_intl/sitemap-entries.json'), true);
    assert.equal(intl.sitemap.filter('https://example.com/_intl/other.json'), true);
    assert.equal(intl.sitemap.filter('https://example.com/sitemap-entries.json'), true);
    assert.equal(intl.sitemap.filter('https://example.com/blog/_intl/sitemap-entries.json'), true);
    assert.equal(intl.sitemap.filter('not a url'), true);
  });

  it('drops the data route under config.base and nowhere else', async () => {
    for (const base of ['/docs', '/docs/']) {
      const intl = await useBase(base);
      const route = `https://example.com/docs${SITEMAP_DATA_PATH}`;
      assert.equal(intl.sitemap.filter(route), false, base);
      assert.equal(intl.sitemap.filter(`${route}/`), false, base);
      assert.equal(intl.sitemap.filter('https://example.com/docs/en/blog/'), true, base);
      assert.equal(intl.sitemap.filter(`https://example.com${SITEMAP_DATA_PATH}`), true, base);
      assert.equal(
        intl.sitemap.filter('https://example.com/docs/sitemap-entries.json'),
        true,
        base,
      );
      assert.equal(
        intl.sitemap.filter('https://example.com/docs/blog/_intl/sitemap-entries.json'),
        true,
        base,
      );
      assert.equal(intl.sitemap.filter('not a url'), true, base);
    }
  });
});
