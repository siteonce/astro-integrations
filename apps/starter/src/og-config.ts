import type { OgImageConfigInput } from '@repo/og-image/config';

// Generation-only. Templates live in `src/og-templates/`. Fonts are
// project-owned; Satori-compatible `.woff`, `.ttf`, or `.otf` only, never
// `.woff2`.
export const ogConfig = {
  basePath: '/_og',
  templates: {
    default: {},
  },
  routes: {
    '*': { template: 'default' },
    '/404': false,
  },
  fonts: [
    {
      name: 'Inter',
      path: '@fontsource/inter/files/inter-latin-400-normal.woff',
      weight: 400,
    },
    {
      name: 'Inter',
      path: '@fontsource/inter/files/inter-latin-700-normal.woff',
      weight: 700,
    },
  ],
} satisfies OgImageConfigInput;
