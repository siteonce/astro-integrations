import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { astroIntl } from '@siteonce/astro-intl';
import { type AstroIntegration, build } from 'astro';
import { projectRoot, type ResolvedRoute, viewComponent, writeViews } from './astro.ts';
import { intlConfig } from './fixtures.ts';

/** Installed `astro`. The temp project resolves `astro/entrypoints/prerender` from its own `node_modules`. */
const astroPackage = realpathSync(
  dirname(createRequire(import.meta.url).resolve('astro/package.json')),
);

/**
 * The injected static route is a spread, so Astro calls `getStaticPaths`.
 * One empty rest param is the single URL that row publishes.
 */
const aboutView = `---
export function getStaticPaths() {
  return [{ params: { index: undefined } }];
}
---
`;

describe('a real Astro build', () => {
  it('serves / with a prerendered project redirect, and injected views arrive as external pages', async (t) => {
    // macOS reports tmpdir under `/var`, which is a symlink. Astro's entrypoint is relative to `root`,
    // so the canonical path keeps it `src/views/about.astro`.
    const root = realpathSync(await projectRoot(t));
    await mkdir(join(root, 'node_modules'));
    await symlink(astroPackage, join(root, 'node_modules', 'astro'));
    await writeViews(root, ['about']);
    await writeFile(join(root, 'src', 'views', 'about.astro'), aboutView);

    const calls: ResolvedRoute[][] = [];
    const recordRoutes: AstroIntegration = {
      name: 'record-resolved-routes',
      hooks: {
        'astro:routes:resolved'({ routes }) {
          calls.push([...routes]);
        },
      },
    };

    const previous = process.cwd();
    process.chdir(root);
    try {
      await build({
        root,
        logLevel: 'silent',
        configFile: false,
        outDir: join(root, 'dist'),
        redirects: { '/': '/en/' },
        integrations: [
          astroIntl(
            intlConfig({
              routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
            }),
          ),
          recordRoutes,
        ],
      });
    } finally {
      process.chdir(previous);
    }

    const view = viewComponent('about.astro');
    assert.ok(calls.length > 0);
    for (const resolved of calls) {
      const seen = resolved
        .map(
          (route) =>
            `${route.origin} ${route.type} ${route.pattern} ${route.entrypoint} ${JSON.stringify(route.redirect)}`,
        )
        .join('\n');
      const redirects = resolved
        .filter((route) => route.pattern === '/')
        .map((route) => ({
          type: route.type,
          origin: route.origin,
          pattern: route.pattern,
          isPrerendered: route.isPrerendered,
        }));
      assert.deepEqual(
        redirects,
        [{ type: 'redirect', origin: 'project', pattern: '/', isPrerendered: true }],
        seen,
      );

      const injected = resolved
        .filter((route) => route.entrypoint === view)
        .map((route) => ({ pattern: route.pattern, origin: route.origin, type: route.type }))
        .sort((left, right) =>
          left.pattern < right.pattern ? -1 : left.pattern > right.pattern ? 1 : 0,
        );
      assert.deepEqual(
        injected,
        [
          { pattern: '/de/ueber/[...index]', origin: 'external', type: 'page' },
          { pattern: '/en/about/[...index]', origin: 'external', type: 'page' },
        ],
        seen,
      );
    }
  });
});
