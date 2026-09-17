import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import intlConfig from './intl.config.ts';

function isRouted(collection: { pathPrefix?: unknown; slugField?: unknown } | undefined) {
  return collection?.pathPrefix !== undefined || collection?.slugField !== undefined;
}

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const contentDir = join(srcDir, 'content');

type Frontmatter = Record<string, unknown>;

function parseFrontmatter(source: string): Frontmatter {
  const match = /^---\n([\s\S]*?)\n---/u.exec(source);
  assert.ok(match, 'expected YAML frontmatter');
  const data: Frontmatter = {};
  let currentArray: string[] | undefined;
  for (const line of match[1].split('\n')) {
    if (line.startsWith('#')) continue;
    if (line.startsWith('  - ')) {
      assert.ok(currentArray, `list item without a key: ${line}`);
      currentArray.push(line.slice(4));
      continue;
    }
    const kv = /^([A-Za-z][A-Za-zA-Z0-9]*):\s*(.*)$/u.exec(line);
    if (!kv) continue;
    const [, key, raw] = kv;
    if (raw === '') {
      currentArray = [];
      data[key] = currentArray;
    } else {
      currentArray = undefined;
      data[key] = raw;
    }
  }
  return data;
}

function listEntries(collection: string): { filePath: string; data: Frontmatter }[] {
  const root = join(contentDir, collection);
  const out: { filePath: string; data: Frontmatter }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(md|mdx)$/u.test(name.name)) continue;
      out.push({ filePath: path, data: parseFrontmatter(readFileSync(path, 'utf8')) });
    }
  };
  walk(root);
  return out;
}

function pairKey(locale: string, id: string) {
  return `${locale}:${id}`;
}

function byIdLocale(entries: { data: Frontmatter }[]) {
  const map = new Map<string, Frontmatter>();
  for (const entry of entries) {
    const id = String(entry.data.id);
    const locale = String(entry.data.locale);
    const key = pairKey(locale, id);
    assert.equal(map.has(key), false, `duplicate (id, locale) ${key}`);
    map.set(key, entry.data);
  }
  return map;
}

const legacy = [
  { name: 'i18n-config', pattern: /(?:from|import)\s+['"][^'"]*i18n-config['"]/ },
  { name: 'virtual:app/i18n', pattern: /(?:from|import)\s+['"]virtual:app\/i18n['"]/ },
  { name: '@repo/astro runtime', pattern: /(?:from|import)\s+['"]@repo\/astro(?:['"/])/ },
  { name: 'siteonce()', pattern: /\bsiteonce\s*\(/ },
  { name: 'legacy t() i18n util', pattern: /(?:from|import)\s+['"]@repo\/astro\/utils\/i18n['"]/ },
];

describe('starter content', () => {
  const pages = listEntries('pages');
  const posts = listEntries('blog');
  const tags = listEntries('tags');
  const authors = listEntries('authors');

  it('pairs en/de home, listing, posts, term pages, and authors', () => {
    const pageMap = byIdLocale(pages);
    const postMap = byIdLocale(posts);
    const tagMap = byIdLocale(tags);
    const authorMap = byIdLocale(authors);

    const homeEn = pageMap.get(pairKey('en', 'home'));
    const homeDe = pageMap.get(pairKey('de', 'home'));
    assert.equal(homeEn?.slug, '/');
    assert.equal(homeEn?.pageType, 'home');
    assert.equal(homeDe?.slug, '/');
    assert.equal(homeDe?.pageType, 'home');

    const listingEn = pageMap.get(pairKey('en', 'blog'));
    const listingDe = pageMap.get(pairKey('de', 'blog'));
    assert.equal(listingEn?.slug, 'blog');
    assert.equal(listingEn?.pageType, 'listing');
    assert.equal(listingDe?.slug, 'blog');
    assert.equal(listingDe?.pageType, 'listing');

    const helloEn = postMap.get(pairKey('en', 'hello-world'));
    const helloDe = postMap.get(pairKey('de', 'hello-world'));
    assert.equal(helloEn?.slug, 'hello-world');
    assert.equal(helloDe?.slug, 'hallo-welt');
    assert.ok(postMap.get(pairKey('en', 'overwrite-container')));
    assert.ok(postMap.get(pairKey('de', 'overwrite-container')));

    const announcementsEn = tagMap.get(pairKey('en', 'announcements'));
    const announcementsDe = tagMap.get(pairKey('de', 'announcements'));
    assert.equal(announcementsEn?.slug, 'announcements');
    assert.equal(announcementsDe?.slug, 'ankuendigungen');
    assert.ok(tagMap.get(pairKey('en', 'engineering')));
    assert.ok(tagMap.get(pairKey('de', 'engineering')));
    assert.ok(tagMap.get(pairKey('en', 'design')));
    assert.ok(tagMap.get(pairKey('de', 'design')));

    const authorEn = authorMap.get(pairKey('en', 'demo'));
    const authorDe = authorMap.get(pairKey('de', 'demo'));
    assert.equal(authorEn?.name, 'Demo Author');
    assert.equal(authorDe?.name, 'Demo-Autor');
    assert.equal(authorEn?.slug, undefined);
    assert.equal(authorDe?.slug, undefined);
  });

  it('keeps authors as records and compiles routed paths', () => {
    assert.equal(isRouted(intlConfig.collections?.pages), true);
    assert.equal(isRouted(intlConfig.collections?.blog), true);
    assert.equal(isRouted(intlConfig.collections?.tags), true);
    assert.equal(isRouted(intlConfig.collections?.authors), false);

    const helloDe = posts.find(
      (entry) => entry.data.id === 'hello-world' && entry.data.locale === 'de',
    );
    assert.equal(helloDe?.data.slug, 'hallo-welt');
    assert.equal(`blog/${helloDe?.data.slug}`, 'blog/hallo-welt');
  });

  it('does not keep a locale-free blog-tags term shape', () => {
    assert.equal(existsSync(join(contentDir, 'blog-tags.json')), false);
    const config = readFileSync(join(srcDir, 'content.config.ts'), 'utf8');
    assert.doesNotMatch(config, /blogTags/);
    assert.doesNotMatch(config, /blog-tags/);
  });

  it('does not import legacy i18n', () => {
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.isDirectory()) {
          if (name.name === 'node_modules' || name.name === '.astro' || name.name === 'dist') {
            continue;
          }
          walk(path);
          continue;
        }
        if (name.name.endsWith('.test.ts')) continue;
        if (!/\.(ts|mjs|astro|md|mdx|json)$/u.test(name.name)) continue;
        const source = readFileSync(path, 'utf8');
        for (const rule of legacy) {
          assert.doesNotMatch(source, rule.pattern, `${path} must not use ${rule.name}`);
        }
      }
    };
    walk(join(srcDir, '..'));
  });
});
