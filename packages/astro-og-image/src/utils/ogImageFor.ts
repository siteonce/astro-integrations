// Maps an included page pathname to Seo-compatible generated-image properties.
import type { OgImageConfigInput } from '../config.ts';
import { matchRoute, rawImagePath, templateForMatch } from '../routing.ts';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = 'image/png';

/** Return props that can be spread directly into core's `<Seo>`. */
export function ogImageFor(pathname: string, ogConfig: OgImageConfigInput) {
  const match = matchRoute(pathname, ogConfig);
  if (!templateForMatch(match, ogConfig)) return {};

  return {
    image: rawImagePath(pathname, { basePath: ogConfig.basePath ?? '/_og' }),
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    imageType: OG_IMAGE_TYPE,
  } as const;
}
