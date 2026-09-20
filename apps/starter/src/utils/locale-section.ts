import type { z } from 'astro/zod';
import { slugify } from './slugify.ts';

/** One locale → public-tail prefix (`en` → `blog`, or `en` → `about/history`). */
export type LocaleSectionMap = Readonly<Record<string, string>>;

/** List of prefixes. An entry passes if any prefix for that locale matches. */
export type LocaleSectionList = readonly LocaleSectionMap[];

function normalizeTail(slug: string): string {
  if (slug === '' || slug === '/') return '/';
  return slug.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function prefixesForLocale(sections: LocaleSectionList, locale: string): string[] {
  const prefixes: string[] = [];
  for (const row of sections) {
    const prefix = row[locale];
    if (prefix === undefined || prefix === '') continue;
    prefixes.push(normalizeTail(prefix));
  }
  return prefixes;
}

function restAfterPrefix(tail: string, prefix: string): string | undefined {
  if (tail === prefix) return undefined;
  const head = `${prefix}/`;
  if (!tail.startsWith(head)) return undefined;
  const rest = tail.slice(head.length);
  return rest.length > 0 ? rest : undefined;
}

function notUnderSection(locale: string, slug: string, prefixes: readonly string[]): string {
  if (prefixes.length === 1) {
    return `locale "${locale}" slug "${slug}" is not under section "${prefixes[0]}"`;
  }
  return `locale "${locale}" slug "${slug}" matches no section`;
}

/**
 * Per-entry check: `{ locale, slug }` must sit under a listed prefix for that locale.
 * `listing` — slug equals a prefix. `entry` — prefix plus one slugified rest segment.
 */
export function localeSection(sections: LocaleSectionList, kind: 'listing' | 'entry') {
  return (value: { locale: string; slug: string }, ctx: z.RefinementCtx) => {
    const prefixes = prefixesForLocale(sections, value.locale);
    if (prefixes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: `locale "${value.locale}" has no section in the locale section map`,
      });
      return;
    }

    const tail = normalizeTail(value.slug);
    if (kind === 'listing') {
      if (!prefixes.includes(tail)) {
        ctx.addIssue({
          code: 'custom',
          message: `locale "${value.locale}" listing slug "${value.slug}" must be "${prefixes[0]}"`,
        });
      }
      return;
    }

    for (const prefix of prefixes) {
      const rest = restAfterPrefix(tail, prefix);
      if (rest === undefined || rest.includes('/')) continue;
      const slugified = slugify(rest);
      if (slugified === '' || slugified !== rest) {
        ctx.addIssue({
          code: 'custom',
          message: `locale "${value.locale}" slug "${value.slug}" rest "${rest}" is not a slug`,
        });
        return;
      }
      return;
    }

    ctx.addIssue({
      code: 'custom',
      message: notUnderSection(value.locale, value.slug, prefixes),
    });
  };
}

/**
 * Pages mix home (`/`) and listings. Only `pageType: listing` is checked.
 * A listing passes when its slug equals one registered section for that locale.
 */
export function listingLocaleSection(sectionsByName: Readonly<Record<string, LocaleSectionList>>) {
  return (value: { locale: string; slug: string; pageType: string }, ctx: z.RefinementCtx) => {
    if (value.pageType !== 'listing') return;
    const tail = normalizeTail(value.slug);
    const known = Object.values(sectionsByName).some((sections) =>
      prefixesForLocale(sections, value.locale).includes(tail),
    );
    if (!known) {
      ctx.addIssue({
        code: 'custom',
        message: `listing slug "${value.slug}" has no locale section map for locale "${value.locale}"`,
      });
    }
  };
}
