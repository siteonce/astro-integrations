import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SitemapItem } from '@astrojs/sitemap';
import { getAlternatePaths, getSitemapEntries, type SitemapEntry } from '@repo/astro-intl';
import type { AstroIntegration } from 'astro';
import intlConfig from './intl.config.ts';

/** Filled at `astro:build:done` from intl pairing so compiled paths print without a catch-all. */
export const intlSitemapPages: string[] = [];

const cachePath = resolve(process.cwd(), 'node_modules/.astro/intl-sitemap-entries.json');

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

let cached: SitemapEntry[] | undefined;

export function persistIntlSitemapEntries(entries: SitemapEntry[]): void {
  cached = entries;
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(entries)}\n`);
}

function readPersisted(): SitemapEntry[] {
  if (!existsSync(cachePath)) return [];
  return JSON.parse(readFileSync(cachePath, 'utf8')) as SitemapEntry[];
}

async function sitemapEntries(): Promise<SitemapEntry[]> {
  if (cached) return cached;
  const persisted = readPersisted();
  if (persisted.length > 0) {
    cached = persisted;
    return cached;
  }
  cached = await getSitemapEntries();
  persistIntlSitemapEntries(cached);
  return cached;
}

function documentLocs(entries: SitemapEntry[]): string[] {
  return [...new Set(entries.filter((entry) => entry.entryId).map((entry) => entry.loc))];
}

export function sitemapFilter(page: string): boolean {
  const path = new URL(page).pathname;
  if (/(?:^|\/)rss\.xml\/?$/u.test(path)) return false;
  if (/(?:^|\/)robots\.txt\/?$/u.test(path)) return false;
  if (path.includes('/_og')) return false;
  return true;
}

export async function serializeSitemap(item: SitemapItem): Promise<SitemapItem> {
  const entries = await sitemapEntries();
  const entry = entries.find((candidate) => normalizeLoc(candidate.loc) === normalizeLoc(item.url));
  if (!entry) return item;

  let alternates = entry.alternates;
  if (entry.entryId) {
    try {
      const tails = await getAlternatePaths(entry.entryId);
      alternates = Object.fromEntries(
        Object.entries(entry.alternates).filter(([locale]) => tails[locale] !== undefined),
      );
    } catch {
      // Node sitemap hooks cannot import astro:content; pairing is already on the entry.
    }
  }

  const links = Object.entries(alternates).map(([lang, url]) => ({ lang, url }));
  const xDefault = alternates[intlConfig.defaultLocale];
  if (xDefault) links.push({ lang: 'x-default', url: xDefault });
  return { ...item, links };
}

/** Runs before `@astrojs/sitemap` so `customPages` already holds compiled locale paths. */
export const collectIntlSitemapPages: AstroIntegration = {
  name: 'starter-collect-intl-sitemap-pages',
  hooks: {
    'astro:build:done': async () => {
      const entries = await sitemapEntries();
      intlSitemapPages.push(...documentLocs(entries));
    },
  },
};
