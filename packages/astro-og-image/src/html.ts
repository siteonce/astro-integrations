// Supplies small escaping and response helpers for development-only tooling pages.
export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function htmlResponse(markup: string, status = 200): Response {
  return new Response(markup, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
