// Dev uses the same request handler without exporting getStaticPaths. Astro's
// content data is resolved on demand after the initial content sync.
export { GET } from './route.ts';
