import type { AstroConfig } from 'astro';

type TrailingSlash = NonNullable<AstroConfig['trailingSlash']>;
type BuildFormat = NonNullable<NonNullable<AstroConfig['build']>['format']>;

/**
 * A startup warning when `trailingSlash` and `build.format` disagree on the host.
 * `undefined` when the pair agrees, including `ignore` and `preserve`.
 */
export function urlFormatMismatch(
  trailingSlash: TrailingSlash | undefined,
  format: BuildFormat | undefined,
): string | undefined {
  if (trailingSlash === 'never' && format === 'directory') {
    return 'trailingSlash "never" writes pages as folders (build.format "directory"), and many hosts add the slash back. Set build.format to "file".';
  }
  if (trailingSlash === 'always' && format === 'file') {
    return 'trailingSlash "always" links to "/path/", but build.format "file" writes "/path.html". Set build.format to "directory".';
  }
  return undefined;
}
