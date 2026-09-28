import type { ImageMetadata } from 'astro';

// Editorial media is a URL in frontmatter. The demo may store a co-located
// relative path (`./feat.png`) so preview needs no cloud account.
const images = import.meta.glob<ImageMetadata>(
  '/src/content/posts/**/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true, import: 'default' },
);

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function mediaBaseUrl(): string {
  return (process.env.MEDIA_BASE_URL ?? '').trim();
}

function joinMediaUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Resolve featImage for a string `src`: local metadata URL, remote URL, or
 * undefined. `id` is the pairing folder (`hello-world`), not the collection
 * id (`hello-world/en`) — co-located files sit next to the locale files.
 */
export function resolveFeatImage(id: string, featImage: string): string | undefined {
  if (isAbsoluteHttpUrl(featImage)) {
    return featImage;
  }

  // Demo co-located relative path — glob; do not invent a host.
  if (featImage.startsWith('./') || featImage.startsWith('../')) {
    const rel = featImage.replace(/^\.\//, '');
    const local = images[`/src/content/posts/${id}/${rel}`];
    return typeof local === 'string' ? local : local?.src;
  }

  const base = mediaBaseUrl();
  if (!base) return undefined;
  return joinMediaUrl(base, featImage);
}
