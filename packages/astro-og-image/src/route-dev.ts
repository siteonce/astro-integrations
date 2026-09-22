// Serves raw PNGs on demand in dev after Astro's initial content sync completes.
import type { APIRoute } from 'astro';
import { handleImageRequest } from './route.ts';

export const GET: APIRoute = (context) => handleImageRequest(context, true);
