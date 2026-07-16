// Renders the development-only page, template, and collection OG image gallery.
import { i18nConfig } from 'virtual:astro-lib/config';
import { generationConfig } from 'virtual:astro-og-image/config';
import type { APIRoute } from 'astro';
import { escapeHtml, htmlResponse } from './html.ts';
import { enumerateImageRoutes, type RouteProps } from './route-data.ts';
import { isIncludedRoute, previewPath, rawImagePath } from './routing.ts';

function imageCard(route: RouteProps, label = route.pagePath): string {
  const raw = rawImagePath(route.pagePath, generationConfig);
  const preview = previewPath(route.pagePath, generationConfig);
  return `<article>
    <a class="image" href="${escapeHtml(preview)}"><img src="${escapeHtml(raw)}" width="1200" height="630" loading="lazy" alt=""></a>
    <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(route.pagePath)}</span><nav><a href="${escapeHtml(preview)}">Preview</a><a href="${escapeHtml(raw)}">PNG</a></nav></div>
  </article>`;
}

function emptyTemplateCard(templateId: string): string {
  return `<article class="empty"><div><strong>${escapeHtml(templateId)}</strong><span>No matching route</span></div></article>`;
}

export const GET: APIRoute = async ({ url }) => {
  const locales = i18nConfig.locales;
  const requestedLocale = url.searchParams.get('locale');
  const locale = locales.some((candidate) => candidate.code === requestedLocale)
    ? (requestedLocale as string)
    : i18nConfig.default;
  const collections = Array.from(
    new Set(
      Object.values(generationConfig.routes).flatMap((route) =>
        isIncludedRoute(route) && route.collection ? [route.collection] : [],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const views = ['pages', 'templates', ...collections];
  const requestedView = url.searchParams.get('view') ?? 'pages';
  const view = views.includes(requestedView) ? requestedView : 'pages';
  const localizedRoutes = (await enumerateImageRoutes(true)).filter(
    (route) => route.locale === locale,
  );

  const heading = view === 'pages' ? 'Pages' : view === 'templates' ? 'Templates' : view;
  let summary = '';
  let cards: string;
  if (view === 'templates') {
    cards = Object.keys(generationConfig.templates)
      .sort((left, right) => left.localeCompare(right))
      .map((templateId) => {
        const route = localizedRoutes.find((candidate) => candidate.templateId === templateId);
        return route ? imageCard(route, templateId) : emptyTemplateCard(templateId);
      })
      .join('');
  } else {
    const matches = localizedRoutes.filter((route) =>
      view === 'pages' ? !route.collection : route.collection === view,
    );
    const visible = view === 'pages' ? matches : matches.slice(0, 12);
    if (view !== 'pages' && matches.length > 12) summary = `12 of ${matches.length}`;
    cards = visible.map((route) => imageCard(route)).join('');
  }

  const viewOptions = views
    .map((value) => {
      const label = value === 'pages' ? 'Pages' : value === 'templates' ? 'Templates' : value;
      return `<option value="${escapeHtml(value)}"${value === view ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
  const localeSelect =
    locales.length > 1
      ? `<label>Locale<select name="locale">${locales
          .map(
            (candidate) =>
              `<option value="${escapeHtml(candidate.code)}"${candidate.code === locale ? ' selected' : ''}>${escapeHtml(candidate.label)}</option>`,
          )
          .join('')}</select></label>`
      : '';

  return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>OG image gallery</title>
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #202124; color: #f1f3f4; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header { position: sticky; z-index: 1; top: 0; display: flex; flex-wrap: wrap; align-items: end; gap: 16px; padding: 18px clamp(18px, 4vw, 48px); background: #292a2d; border-bottom: 1px solid #3c4043; }
      h1 { margin: 0 auto 0 0; font-size: 22px; }
      form, label { display: flex; align-items: end; gap: 8px; }
      label { flex-direction: column; align-items: start; color: #bdc1c6; font-size: 12px; }
      select, button { min-height: 36px; padding: 6px 10px; border: 1px solid #5f6368; border-radius: 5px; background: #35363a; color: inherit; }
      button { align-self: end; cursor: pointer; }
      main { padding: 28px clamp(18px, 4vw, 48px) 48px; }
      .title { display: flex; align-items: baseline; gap: 12px; margin-bottom: 18px; }
      h2 { margin: 0; font-size: 18px; text-transform: capitalize; }
      .title span { color: #9aa0a6; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 22px; }
      article { overflow: hidden; min-height: 140px; border: 1px solid #3c4043; border-radius: 7px; background: #292a2d; }
      article .image { display: block; background: #161719; }
      img { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: contain; }
      article > div { display: grid; gap: 5px; padding: 13px; }
      article span { overflow-wrap: anywhere; color: #9aa0a6; font: 12px ui-monospace, monospace; }
      article nav { display: flex; gap: 14px; margin-top: 5px; }
      a { color: #8ab4f8; }
      .empty { display: grid; place-items: center; border-style: dashed; }
    </style>
  </head>
  <body>
    <header><h1>OG images</h1><form method="get"><label>View<select name="view">${viewOptions}</select></label>${localeSelect}<button type="submit">Show</button></form></header>
    <main><div class="title"><h2>${escapeHtml(heading)}</h2>${summary ? `<span>${summary}</span>` : ''}</div><div class="grid">${cards}</div></main>
  </body>
</html>`);
};
