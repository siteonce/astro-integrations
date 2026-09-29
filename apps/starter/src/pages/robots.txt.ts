import type { APIRoute } from 'astro';
import { deployConfig } from '../deploy.config.ts';
import { siteConfig } from '../site.config.ts';

// Prerendered so the body can branch on deploy class at build. Governs
// crawling only; per-page indexing is Seo `noindex`, which does not feed this.
export const prerender = true;

const sitemap = new URL('/sitemap-index.xml', siteConfig.siteUrl).href;

// Previews and branch deploys are never crawled.
const preview = `User-agent: *
Disallow: /
`;

// AI crawlers: change `Allow` to `Disallow` to opt one out.
const open = `User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: *
Allow: /

Sitemap: ${sitemap}
`;

export const GET: APIRoute = () =>
  new Response(deployConfig.class === 'preview' ? preview : open, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
