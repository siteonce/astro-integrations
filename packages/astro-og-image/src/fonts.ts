// Validates, loads, and fingerprints consumer-owned fonts for Satori renders.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve } from 'node:path';
import type { OgImageConfig } from './config.ts';

export type SatoriFont = {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
};

export function resolveFontPath(path: string, projectRoot: string): string {
  if (!path.startsWith('.') && !path.startsWith('/')) {
    try {
      return createRequire(resolve(projectRoot, 'package.json')).resolve(path);
    } catch {
      // Fall through to project-root-relative resolution for a useful error path.
    }
  }
  return resolve(projectRoot, path);
}

export function assertFontFiles(fonts: OgImageConfig['fonts'], projectRoot: string): void {
  for (const font of fonts) {
    const extension = extname(font.path).toLowerCase();
    if (extension === '.woff2') {
      throw new Error(`Satori cannot consume .woff2; use .woff, .ttf, or .otf: ${font.path}`);
    }
    if (!['.woff', '.ttf', '.otf'].includes(extension)) {
      throw new Error(`OG font must be .woff, .ttf, or .otf: ${font.path}`);
    }
    const absolute = resolveFontPath(font.path, projectRoot);
    if (!existsSync(absolute)) {
      throw new Error(`OG font not found: ${font.path} (resolved ${absolute})`);
    }
  }
}

export function loadFonts(fonts: OgImageConfig['fonts'], projectRoot: string): SatoriFont[] {
  return fonts.map((font) => ({
    name: font.name,
    data: readFileSync(resolveFontPath(font.path, projectRoot)),
    weight: font.weight,
    style: font.style,
  }));
}

export function fontRegistryDigest(fonts: SatoriFont[]): string {
  return fonts
    .map(
      (font) =>
        `${font.name}:${font.weight}:${font.style}:${createHash('sha256').update(font.data).digest('hex')}`,
    )
    .join('|');
}
