export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = 'image/png';

function endpointPath(pathname: string): string {
  const normalized = `/${pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  const route = normalized === '/' ? 'index' : normalized.slice(1);
  return `/og/${route}.png`;
}

/** Return props that can be spread directly into core's `<Seo>`. */
export function ogImageFor(pathname: string) {
  return {
    image: endpointPath(pathname),
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    imageType: OG_IMAGE_TYPE,
  } as const;
}
