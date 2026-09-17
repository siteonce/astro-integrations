import { robotsTxt } from '@repo/astro-site';
import type { APIRoute } from 'astro';
import { deployConfig } from '../deploy-config.ts';
import { siteConfig } from '../site-config.ts';

// Prerendered endpoint so the body can branch on deploy class at build.
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(robotsTxt(siteConfig, deployConfig), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
