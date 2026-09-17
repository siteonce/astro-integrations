import type { EntryIdContext, EntryIdResolver } from './define-intl.ts';

function lastSegment(filePath: string): string {
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function stripKnownExt(name: string): string {
  return name.replace(/\.(mdx|md|json|yml|yaml|ts|js|mjs|cjs)$/iu, '');
}

function fileStem(filePath: string | undefined, locale: string): string | undefined {
  if (!filePath) return undefined;
  const stem = stripKnownExt(lastSegment(filePath));
  if (!stem) return undefined;
  const localeSuffix = new RegExp(`\\.${locale}$`, 'iu');
  if (localeSuffix.test(stem)) return stem.replace(localeSuffix, '');
  return stem;
}

function parentDir(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

function readStringField(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Resolve the translation group key for one collection entry. */
export function resolveEntryId(
  resolver: EntryIdResolver,
  ctx: EntryIdContext,
  entryIdField = 'id',
): string {
  if (typeof resolver === 'function') {
    const value = resolver(ctx);
    if (!value) {
      throw new Error('@repo/astro-intl: entryId hook returned an empty string.');
    }
    return value;
  }
  switch (resolver) {
    case 'frontmatter': {
      const value = readStringField(ctx.data, entryIdField);
      if (!value) {
        throw new Error(`@repo/astro-intl: entryId field "${entryIdField}" is missing.`);
      }
      return value;
    }
    case 'slug': {
      if (!ctx.slug) {
        throw new Error('@repo/astro-intl: slug is missing for entryId strategy "slug".');
      }
      return ctx.slug;
    }
    case 'astroId':
      return ctx.id;
    case 'fileStem': {
      const stem = fileStem(ctx.filePath, ctx.locale);
      if (!stem) {
        throw new Error('@repo/astro-intl: fileStem could not be resolved.');
      }
      return stem;
    }
    case 'parentDir': {
      const dir = parentDir(ctx.filePath);
      if (!dir) {
        throw new Error('@repo/astro-intl: parentDir could not be resolved.');
      }
      return dir;
    }
  }
}
