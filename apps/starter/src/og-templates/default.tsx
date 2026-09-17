/** @jsxImportSource @repo/og-image */
/** @jsxRuntime automatic */
import type { Blog } from '@repo/astro-site';
import type { OgContext } from '@repo/og-image/context';

function isBlogData(data: Record<string, unknown>): data is Blog {
  return typeof data.seoTitle === 'string';
}

/**
 * Disposable default OG card — REPLACE ME. A neutral layout (site name + page
 * title on a flat background) using the project-configured Inter font. Doubles
 * as the worked `OgContext` example:
 * read what you need off `ctx`, write fallbacks inline.
 *
 * Authoring notes (full loop in ./AGENTS.md):
 *  - Type the function against `OgContext`; the `@jsxImportSource` pragma above
 *    wires JSX to the lib's Satori runtime.
 *  - Copy that lives in locale files goes through `ctx.t('key')`.
 *  - Output is always 1200×630 PNG. Logos should be raster (PNG) — Satori's
 *    inline-SVG support is narrow.
 */
export default function defaultCard(ctx: OgContext) {
  const isHome = !ctx.entry;
  const data = ctx.entry?.data;
  const blog = data && isBlogData(data) ? data : undefined;
  // Fallback chain, visible at the point of use (no hidden cascade).
  const title = blog?.og?.title ?? blog?.seoTitle ?? ctx.siteConfig.siteName;
  const host = ctx.siteConfig.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '80px',
        backgroundColor: '#0b1020',
        color: '#ffffff',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {ctx.siteConfig.siteName}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: isHome ? 84 : 64,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: '#9aa4b2' }}>{host}</div>
    </div>
  );
}
