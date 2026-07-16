import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type HashInputs = {
  path: string;
  templateId: string;
  templateSource: string;
  templateConfig: unknown;
  locale: string;
  entryData: unknown;
  siteConfig: unknown;
  fontDigest: string;
  packageVersion: string;
};

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeHash(inputs: HashInputs): string {
  return sha(
    [
      inputs.path,
      inputs.templateId,
      sha(inputs.templateSource),
      JSON.stringify(inputs.templateConfig),
      inputs.locale,
      JSON.stringify(inputs.entryData),
      JSON.stringify(inputs.siteConfig),
      inputs.fontDigest,
      inputs.packageVersion,
    ].join('\u0000'),
  ).slice(0, 24);
}

function cachePath(cacheDir: string, hash: string): string {
  return resolve(cacheDir, `${hash}.png`);
}

export function readCached(cacheDir: string, hash: string): Buffer | undefined {
  const path = cachePath(cacheDir, hash);
  return existsSync(path) ? readFileSync(path) : undefined;
}

export function writeCached(cacheDir: string, hash: string, image: Buffer): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath(cacheDir, hash), image);
}
