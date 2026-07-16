// Presents one development OG image at intrinsic size on a responsive editor-like canvas.
import { generationConfig } from 'virtual:astro-og-image/config';
import type { APIRoute } from 'astro';
import { escapeHtml, htmlResponse } from './html.ts';
import { resolveImageRoute } from './route-data.ts';
import { pagePathFromEndpointParam, rawImagePath } from './routing.ts';

export const GET: APIRoute = async ({ params }) => {
  const pagePath = pagePathFromEndpointParam(params.path ?? '');
  const route = await resolveImageRoute(pagePath, true);
  if (!route) return htmlResponse('<h1>OG image route not found.</h1>', 404);
  const imagePath = rawImagePath(route.pagePath, generationConfig);
  const safeRoute = escapeHtml(route.pagePath);
  const safeImagePath = escapeHtml(imagePath);

  return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeRoute} · OG image preview</title>
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #4b4d50; color: #f5f5f5; }
      header { position: fixed; z-index: 1; inset: 0 0 auto; min-height: 64px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 12px 20px; background: #292a2c; border-bottom: 1px solid #18191a; box-shadow: 0 1px 8px #0005; }
      strong { font-size: 14px; overflow-wrap: anywhere; }
      span { color: #babdc2; font-size: 13px; }
      a { margin-inline-start: auto; color: #b9d7ff; font-size: 13px; }
      main { position: fixed; inset: 64px 0 0; display: grid; place-items: center; padding: 24px; overflow: auto; background-color: #55575a; background-image: linear-gradient(45deg, #525457 25%, transparent 25%), linear-gradient(-45deg, #525457 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #525457 75%), linear-gradient(-45deg, transparent 75%, #525457 75%); background-size: 24px 24px; background-position: 0 0, 0 12px, 12px -12px, -12px 0; }
      img { display: block; width: min(1200px, calc(100vw - 48px), calc((100vh - 112px) * 1.90476)); height: auto; max-width: 1200px; max-height: 630px; box-shadow: 0 8px 32px #0008; }
      @media (max-width: 520px) { header { min-height: 84px; } main { inset-block-start: 84px; padding: 12px; } img { width: min(1200px, calc(100vw - 24px), calc((100vh - 108px) * 1.90476)); } a { margin-inline-start: 0; } }
    </style>
  </head>
  <body>
    <header><strong>${safeRoute}</strong><span>1200 × 630 PNG</span><a href="${safeImagePath}">Open raw PNG</a></header>
    <main><img src="${safeImagePath}" width="1200" height="630" alt="OG image preview for ${safeRoute}"></main>
  </body>
</html>`);
};
