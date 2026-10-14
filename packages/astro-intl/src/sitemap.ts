/**
 * Sitemap options for one `astroIntl()` call.
 * That call owns `customPages` and the entries loaded from this build.
 * Nothing here is shared across calls. `astro:build:done` reads
 * `<dir>/_intl/sitemap-entries.json`, adds those URLs to `customPages`, and
 * deletes the file. A second build in the same process replaces only the URLs
 * this call added. `serialize` adds alternates and `x-default` from each entry.
 * `filter` drops the data route.
 */

import { existsSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SitemapEntry } from './query.ts';

/** The part of a sitemap item this module reads and returns. */
export type SitemapItemLike = {
  url: string;
  links?: { lang: string; url: string }[];
};

export type IntlSitemapOptions = {
  customPages: string[];
  serialize: <T extends SitemapItemLike>(item: T) => Promise<T>;
  filter: (page: string) => boolean;
};

/** Pathname of the build-only route that carries sitemap entries. */
export const SITEMAP_DATA_PATH = '/_intl/sitemap-entries.json';

const MISSING_DATA_ROUTE = '@repo/astro-intl: the sitemap data route was not built.';

const DATA_ROUTE_NOT_A_LIST = '@repo/astro-intl: the sitemap data route did not return a list.';

function normalizeLoc(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/u, '');
  return `${parsed.origin}${path}`;
}

/** Astro resolves `base` with a leading slash and at most one trailing slash. */
function normalizeBase(base: string | undefined): string {
  const trimmed = (base ?? '').replace(/\/$/u, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Pathname with `base` removed. Undefined when `pathname` is outside `base`. */
function pathAfterBase(pathname: string, base: string): string | undefined {
  if (base === '/') return pathname;
  if (!pathname.startsWith(`${base}/`)) return undefined;
  return pathname.slice(base.length);
}

function isDataRoute(pathname: string): boolean {
  return pathname.replace(/\/+$/u, '') === SITEMAP_DATA_PATH;
}

function intlDir(dir: URL): string {
  return join(fileURLToPath(dir), '_intl');
}

/** The sitemap data file this build wrote. */
function dataFile(dir: URL): string | undefined {
  const file = join(intlDir(dir), 'sitemap-entries.json');
  if (existsSync(file) && statSync(file).isFile()) return file;
  return undefined;
}

function removeIfEmpty(directory: string): void {
  if (existsSync(directory) && readdirSync(directory).length === 0) rmdirSync(directory);
}

function removeDataFile(target: string, folder: string): void {
  unlinkSync(target);
  removeIfEmpty(folder);
}

function readDataRoute(dir: URL): SitemapEntry[] {
  const target = dataFile(dir);
  if (target === undefined) throw new Error(MISSING_DATA_ROUTE);
  const text = readFileSync(target, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(DATA_ROUTE_NOT_A_LIST);
  }
  if (!Array.isArray(parsed)) throw new Error(DATA_ROUTE_NOT_A_LIST);
  removeDataFile(target, intlDir(dir));
  return parsed as SitemapEntry[];
}

/** Drop the URLs added last time, as one slice, so URLs the app added stay. */
function removeAdded(pages: string[], previous: readonly string[]): void {
  if (previous.length > pages.length) return;
  let start = -1;
  for (let index = 0; index <= pages.length - previous.length; index += 1) {
    if (previous.every((loc, offset) => pages[index + offset] === loc)) start = index;
  }
  if (start !== -1) pages.splice(start, previous.length);
}

/** `customPages`, `serialize`, and `filter` bound to one `astroIntl()` call. */
export function createSitemapOptions(): {
  sitemap: IntlSitemapOptions;
  fillCustomPages: (dir: URL) => void;
  setBase: (base: string | undefined) => void;
} {
  const customPages: string[] = [];
  let loaded: SitemapEntry[] | undefined;
  let added: string[] = [];
  let base = '/';

  function setBase(next: string | undefined): void {
    base = normalizeBase(next);
  }

  async function serialize<T extends SitemapItemLike>(item: T): Promise<T> {
    const entry = (loaded ?? []).find(
      (candidate) => normalizeLoc(candidate.loc) === normalizeLoc(item.url),
    );
    if (!entry) return item;
    const links = Object.entries(entry.alternates).map(([lang, url]) => ({ lang, url }));
    if (entry.xDefault) links.push({ lang: 'x-default', url: entry.xDefault });
    return { ...item, links };
  }

  function filter(page: string): boolean {
    let pathname: string;
    try {
      pathname = new URL(page).pathname;
    } catch {
      return true;
    }
    const rest = pathAfterBase(pathname, base);
    if (rest === undefined) return true;
    return !isDataRoute(rest);
  }

  function fillCustomPages(dir: URL): void {
    const entries = readDataRoute(dir);
    loaded = entries;
    const locs = [...new Set(entries.map((entry) => entry.loc))];
    removeAdded(customPages, added);
    for (const loc of locs) customPages.push(loc);
    added = locs;
  }

  return { sitemap: { customPages, serialize, filter }, fillCustomPages, setBase };
}
