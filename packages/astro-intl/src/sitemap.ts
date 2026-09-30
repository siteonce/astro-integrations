/**
 * Sitemap options for one `astroIntl()` call.
 * That call owns `customPages` and the entry cache. Nothing here is shared
 * across calls. `astro:build:done` replaces `customPages` from the cache file
 * a prerendered route wrote. `serialize` adds `x-default` from this call's
 * default locale.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SitemapEntry } from './query.ts';

/** The part of a sitemap item this module reads and returns. */
export type SitemapItemLike = {
  url: string;
  links?: { lang: string; url: string }[];
};

export type IntlSitemapOptions = {
  customPages: string[];
  serialize: <T extends SitemapItemLike>(item: T) => Promise<T>;
};

const cachePath = resolve(process.cwd(), 'node_modules/.astro/intl-sitemap-entries.json');

const MISSING_ENTRIES =
  '@repo/astro-intl: no sitemap entries were persisted. A prerendered route must call persistIntlSitemapEntries().';

/** Writes the sitemap entries a prerendered route collected. Later reads use this file. */
export function persistIntlSitemapEntries(entries: SitemapEntry[]): void {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(entries)}\n`);
}

function readPersisted(): SitemapEntry[] {
  if (!existsSync(cachePath)) return [];
  return JSON.parse(readFileSync(cachePath, 'utf8')) as SitemapEntry[];
}

function normalizeLoc(url: string): string {
  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/u, '') : parsed.pathname;
    return `${parsed.origin}${path}`;
  } catch {
    return url.replace(/\/+$/u, '');
  }
}

/** `customPages` and `serialize` bound to one parsed intl config. */
export function createSitemapOptions(config: { defaultLocale: string }): {
  sitemap: IntlSitemapOptions;
  fillCustomPages: () => void;
} {
  const customPages: string[] = [];
  let cached: SitemapEntry[] | undefined;

  function entries(): SitemapEntry[] {
    if (cached) return cached;
    const persisted = readPersisted();
    if (persisted.length === 0) throw new Error(MISSING_ENTRIES);
    cached = persisted;
    return cached;
  }

  async function serialize<T extends SitemapItemLike>(item: T): Promise<T> {
    const entry = entries().find(
      (candidate) => normalizeLoc(candidate.loc) === normalizeLoc(item.url),
    );
    if (!entry) return item;
    const links = Object.entries(entry.alternates).map(([lang, url]) => ({ lang, url }));
    const xDefault = entry.alternates[config.defaultLocale];
    if (xDefault) links.push({ lang: 'x-default', url: xDefault });
    return { ...item, links };
  }

  function fillCustomPages(): void {
    // Re-read the file so a second build in this process picks up a new write.
    cached = undefined;
    const locs = [...new Set(entries().map((entry) => entry.loc))];
    // Mutates the array the app passed to the printer. Replacing it would
    // leave the printer holding the empty one from config load.
    customPages.splice(0, customPages.length, ...locs);
  }

  return { sitemap: { customPages, serialize }, fillCustomPages };
}
