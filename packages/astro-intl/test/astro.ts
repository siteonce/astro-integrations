/**
 * Temp project directories, `astroIntl` hook runs, view files, Astro's paginate,
 * and stand-ins for `astro:content` and `astro:i18n`.
 * The hook runner records injected routes, config updates, injected types,
 * logger lines, and thrown errors.
 * `renderingConfig` and `boot` are the shared startup for view rendering and refusals.
 */

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astroIntl } from '@repo/astro-intl';
import type { AstroConfig, AstroIntegration, PaginateFunction } from 'astro';
import { intlConfig } from './fixtures.ts';

type IntlConfigInput = Parameters<typeof astroIntl>[0];

type SetupParams = Parameters<NonNullable<AstroIntegration['hooks']['astro:config:setup']>>[0];
type DoneParams = Parameters<NonNullable<AstroIntegration['hooks']['astro:config:done']>>[0];
type RoutesParams = Parameters<NonNullable<AstroIntegration['hooks']['astro:routes:resolved']>>[0];
type RouteSetupParams = Parameters<NonNullable<AstroIntegration['hooks']['astro:route:setup']>>[0];
type BuildDoneParams = Parameters<NonNullable<AstroIntegration['hooks']['astro:build:done']>>[0];

/** One route `astro:routes:resolved` receives. */
export type ResolvedRoute = RoutesParams['routes'][number];

/** One `injectRoute` call. `prerender` is present only when the integration set it. */
export type InjectedRoute = {
  pattern: string;
  entrypoint: string | URL;
  prerender?: boolean;
};

/** One `injectTypes` call from `astro:config:done`. */
export type InjectedType = {
  filename: string;
  content: string;
};

/** One logger call. `fork` writes to the same list. */
export type IntlLog = {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
};

/**
 * Arguments for `astro:config:setup`.
 * Omitted fields stay unset on the config object passed to the hook.
 */
export type IntlSetupOptions = {
  /** Defaults to `build`, which injects the sitemap data route. */
  command?: 'dev' | 'build' | 'preview' | 'sync';
  /** Directory Astro reports as `srcDir`. Defaults to `src` under the project root. */
  srcDir?: string;
  i18n?: AstroConfig['i18n'];
  integrations?: AstroIntegration[];
  adapter?: AstroIntegration;
  base?: string;
  trailingSlash?: AstroConfig['trailingSlash'];
  buildFormat?: NonNullable<AstroConfig['build']>['format'];
};

/** What one `astroIntl(config)` call did across the hooks driven below. */
export type IntlHooks = {
  /** Project root the hooks see. */
  root: string;
  /** Unset when `astroIntl(config)` throws. */
  integration: ReturnType<typeof astroIntl> | undefined;
  /**
   * Every `injectRoute` argument, in call order.
   * On `build` this includes the sitemap data route.
   */
  injected: InjectedRoute[];
  /** Every `updateConfig` argument, in call order. */
  updates: Record<string, unknown>[];
  /** Every `injectTypes` argument, in call order. */
  types: InjectedType[];
  /** Logger calls, in order. */
  log: IntlLog[];
  /**
   * The exception from `astroIntl(config)`, or from the most recent hook call.
   * A hook that returns clears it. A hook that throws sets it and rethrows.
   */
  error: unknown;
  /** Runs `astro:config:setup`. */
  setup(options?: IntlSetupOptions): Promise<void>;
  /** Runs `astro:config:done`. Does not require `setup`. */
  configDone(): Promise<void>;
  /** Runs `astro:routes:resolved` with these routes. */
  routesResolved(routes: ResolvedRoute[]): Promise<void>;
  /**
   * Runs `astro:route:setup`.
   * `component` is the path Astro passes, resolved against the project root.
   * Fallback checks use the entrypoints recorded during `setup`.
   */
  routeSetup(route: { component: string; prerender?: boolean }): Promise<void>;
  /**
   * Runs `astro:build:done`. Reads `<dir>/_intl/sitemap-entries.json` into `integration.sitemap`.
   * `dir` defaults to the project root.
   */
  buildDone(dir?: URL): Promise<void>;
};

/**
 * A temp project directory. Removed when the test finishes, including when the test fails.
 */
export async function projectRoot(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'astro-intl-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

/**
 * A resolved route for `routesResolved`. `origin` defaults to `external` and `type` to `page`.
 * `patternRegex` defaults to a pattern that matches nothing.
 */
export function resolvedRoute(options: {
  entrypoint: string;
  pattern: string;
  isPrerendered: boolean;
  origin?: ResolvedRoute['origin'];
  type?: ResolvedRoute['type'];
  patternRegex?: RegExp;
}): ResolvedRoute {
  return {
    type: options.type ?? 'page',
    origin: options.origin ?? 'external',
    entrypoint: options.entrypoint,
    pattern: options.pattern,
    patternRegex: options.patternRegex ?? /$^/u,
    isPrerendered: options.isPrerendered,
    params: [],
    segments: [],
    fallbackRoutes: [],
    generate: () => options.pattern,
  };
}

/**
 * A `redirect` at `/` with project origin.
 * `astro:routes:resolved` reports a config redirect this way.
 */
export function siteRootRoute(): ResolvedRoute {
  return resolvedRoute({
    entrypoint: '/',
    pattern: '/',
    isPrerendered: true,
    origin: 'project',
    type: 'redirect',
    patternRegex: /^\/$/u,
  });
}

/**
 * An `@astrojs/node` adapter.
 * `viewRendering: 'request'` refuses to boot without an adapter, outside `astro dev`.
 */
export const nodeAdapter = { name: '@astrojs/node', hooks: {} } as AstroIntegration;

/**
 * Writes empty `<name>.astro` files under the project `src/views/`.
 * A name may include directories (`blog/archive` writes `src/views/blog/archive.astro`).
 */
export async function writeViews(root: string, names: readonly string[]): Promise<void> {
  for (const name of names) {
    const file = join(root, 'src', 'views', `${name}.astro`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '');
  }
}

/**
 * View file path relative to the project root, as Astro reports it.
 * `missing.astro` is `src/views/missing.astro`.
 */
export function viewComponent(file: string): string {
  return join('src', 'views', file);
}

function viewsPrefix(root: string): string {
  return `${join(root, 'src', 'views')}${sep}`;
}

/**
 * Pattern plus the view file under the project `views` directory.
 * Every entrypoint must be a view file.
 */
export function injectedViews(root: string, injected: readonly InjectedRoute[]) {
  const prefix = viewsPrefix(root);
  return injected.map((route) => {
    const entrypoint = String(route.entrypoint);
    assert.ok(entrypoint.startsWith(prefix), entrypoint);
    return { pattern: route.pattern, view: entrypoint.slice(prefix.length) };
  });
}

/**
 * Injected routes whose entrypoint is a view file.
 * The build-only sitemap data route is left out.
 * `prerender` is present only when the integration set it.
 */
export function renderedViews(root: string, injected: readonly InjectedRoute[]) {
  const prefix = viewsPrefix(root);
  return injected.flatMap((route) => {
    const entrypoint = String(route.entrypoint);
    if (!entrypoint.startsWith(prefix)) return [];
    return [
      {
        pattern: route.pattern,
        view: entrypoint.slice(prefix.length),
        ...(Object.hasOwn(route, 'prerender') ? { prerender: route.prerender } : {}),
      },
    ];
  });
}

/**
 * Astro's `paginate` for a `page` or `...page` segment.
 * Base defaults to `/`. Trailing slash defaults to `always`.
 */
export async function astroPaginate(
  param: 'page' | '...page',
  options?: { base?: string; trailingSlash?: AstroConfig['trailingSlash'] },
): Promise<PaginateFunction> {
  const require = createRequire(import.meta.url);
  const astroJson = require.resolve('astro/package.json');
  const paginateHref = pathToFileURL(join(dirname(astroJson), 'dist/core/render/paginate.js')).href;
  const { generatePaginateFunction } = (await import(paginateHref)) as {
    generatePaginateFunction: (
      route: { params: string[]; segments: unknown[] },
      base: string,
      trailingSlash: AstroConfig['trailingSlash'],
    ) => PaginateFunction;
  };
  return generatePaginateFunction(
    { params: [param], segments: [] },
    options?.base ?? '/',
    options?.trailingSlash ?? 'always',
  );
}

/** A `data:` URL whose body is this JavaScript module source. */
function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

/**
 * The data route calls `createIntl` with no loaders, so collection and URL reads
 * are Astro's `astro:content` and `astro:i18n`.
 * `getCollection('blog')` returns one `en` entry and its `de` sibling.
 * Locale URLs are `https://example.com/<locale>/<path>` and `/<locale>/<path>/`.
 */
export function stubAstroModules() {
  const content = moduleUrl(
    [
      'const blog = [',
      '  {',
      '    id: "hello-en",',
      '    collection: "blog",',
      '    data: { id: "hello-world", locale: "en", slug: "hello-world" },',
      '  },',
      '  {',
      '    id: "hello-de",',
      '    collection: "blog",',
      '    data: { id: "hello-world", locale: "de", slug: "hallo-welt" },',
      '  },',
      '];',
      'export async function getCollection(name) {',
      '  return name === "blog" ? blog : [];',
      '}',
    ].join('\n'),
  );
  const i18n = moduleUrl(
    [
      'export function getAbsoluteLocaleUrl(locale, path = "") {',
      '  return "https://example.com/" + locale + (path ? "/" + path : "");',
      '}',
      'export function getRelativeLocaleUrl(locale, path = "") {',
      '  return "/" + locale + (path ? "/" + path : "") + "/";',
      '}',
    ].join('\n'),
  );
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'astro:content') return { url: content, shortCircuit: true };
      if (specifier === 'astro:i18n') return { url: i18n, shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
}

function recordingLogger(log: IntlLog[]): SetupParams['logger'] {
  const logger = {
    info(message: string) {
      log.push({ level: 'info', message });
    },
    warn(message: string) {
      log.push({ level: 'warn', message });
    },
    error(message: string) {
      log.push({ level: 'error', message });
    },
    debug(message: string) {
      log.push({ level: 'debug', message });
    },
    fork() {
      return logger;
    },
  };
  return logger as unknown as SetupParams['logger'];
}

class Session implements IntlHooks {
  readonly root: string;
  integration: ReturnType<typeof astroIntl> | undefined;
  readonly injected: InjectedRoute[] = [];
  readonly updates: Record<string, unknown>[] = [];
  readonly types: InjectedType[] = [];
  readonly log: IntlLog[] = [];
  error: unknown;

  constructor(root: string, config: IntlConfigInput) {
    this.root = root;
    try {
      this.integration = astroIntl(config);
    } catch (caught) {
      this.error = caught;
    }
  }

  private async call(body: () => Promise<void> | void): Promise<void> {
    if (this.integration === undefined) {
      throw this.error === undefined
        ? new Error('astroIntl(config) did not return an integration.')
        : this.error;
    }
    this.error = undefined;
    try {
      await body();
    } catch (caught) {
      this.error = caught;
      throw caught;
    }
  }

  async setup(options: IntlSetupOptions = {}): Promise<void> {
    await this.call(async () => {
      const integration = this.integration;
      if (integration === undefined) return;
      const srcDir = options.srcDir ?? join(this.root, 'src');
      const codegenDir = join(this.root, '.astro', 'integrations', 'astro-intl');
      const setup = integration.hooks['astro:config:setup'];
      if (setup === undefined) throw new Error('astro:config:setup is not registered.');
      await setup({
        command: options.command ?? 'build',
        config: {
          root: pathToFileURL(`${this.root}/`),
          srcDir: pathToFileURL(`${srcDir}/`),
          base: options.base,
          i18n: options.i18n,
          integrations: options.integrations ?? [],
          adapter: options.adapter,
          trailingSlash: options.trailingSlash,
          build: options.buildFormat === undefined ? undefined : { format: options.buildFormat },
        },
        updateConfig: (newConfig: Record<string, unknown>) => {
          this.updates.push(newConfig);
          return newConfig as unknown as AstroConfig;
        },
        injectRoute: (route: InjectedRoute) => {
          this.injected.push({
            pattern: route.pattern,
            entrypoint: route.entrypoint,
            ...(route.prerender === undefined ? {} : { prerender: route.prerender }),
          });
        },
        createCodegenDir: () => {
          mkdirSync(codegenDir, { recursive: true });
          return pathToFileURL(`${codegenDir}/`);
        },
        logger: recordingLogger(this.log),
      } as unknown as SetupParams);
    });
  }

  async configDone(): Promise<void> {
    await this.call(async () => {
      const hook = this.integration?.hooks['astro:config:done'];
      if (hook === undefined) throw new Error('astro:config:done is not registered.');
      await hook({
        injectTypes: (entry: InjectedType) => {
          this.types.push({ filename: entry.filename, content: entry.content });
          return new URL('intl-locales.d.ts', pathToFileURL(`${this.root}/`));
        },
        logger: recordingLogger(this.log),
      } as unknown as DoneParams);
    });
  }

  async routesResolved(routes: ResolvedRoute[]): Promise<void> {
    await this.call(async () => {
      const hook = this.integration?.hooks['astro:routes:resolved'];
      if (hook === undefined) throw new Error('astro:routes:resolved is not registered.');
      await hook({ routes, logger: recordingLogger(this.log) } as RoutesParams);
    });
  }

  async routeSetup(route: { component: string; prerender?: boolean }): Promise<void> {
    await this.call(async () => {
      const hook = this.integration?.hooks['astro:route:setup'];
      if (hook === undefined) throw new Error('astro:route:setup is not registered.');
      await hook({
        route,
        logger: recordingLogger(this.log),
      } as unknown as RouteSetupParams);
    });
  }

  async buildDone(dir?: URL): Promise<void> {
    await this.call(async () => {
      const hook = this.integration?.hooks['astro:build:done'];
      if (hook === undefined) throw new Error('astro:build:done is not registered.');
      await hook({
        dir: dir ?? pathToFileURL(`${this.root}/`),
        logger: recordingLogger(this.log),
      } as unknown as BuildDoneParams);
    });
  }
}

/**
 * Static about, a `{slug}` post with fallback view `missing`, and a blog listing.
 * `blog/{page}` has the same section as `blog/{slug}`.
 * Omitted `viewRendering` is the default, `'build'`.
 * `routeSetup` reads the fallback view's `prerender` flag.
 */
export function renderingConfig(viewRendering?: 'build' | 'request'): IntlConfigInput {
  return intlConfig({
    ...(viewRendering === undefined ? {} : { viewRendering }),
    routes: [
      { slug: { en: 'about', de: 'ueber' }, view: 'about' },
      {
        slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
        collection: 'blog',
        view: 'post',
        fallbackView: 'missing',
      },
      {
        slug: { en: 'blog', de: 'artikel' },
        collection: 'blog',
        view: 'blog',
        pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

/**
 * Builds `astroIntl(config)` and runs `astro:config:setup`.
 * The project root is a temp directory removed when the test finishes.
 * `views` are written under `src/views/` before setup, when passed.
 */
export async function boot(
  t: TestContext,
  config: IntlConfigInput,
  options?: IntlSetupOptions,
  views?: readonly string[],
): Promise<IntlHooks> {
  const hooks = await intlHooks(t, config);
  if (views !== undefined) await writeViews(hooks.root, views);
  await hooks.setup(options);
  return hooks;
}

/**
 * Builds `astroIntl(config)` and drives its hooks.
 * `root` defaults to a new temp directory removed when the test finishes.
 * A passed `root` is not removed here.
 * When `astroIntl(config)` throws, `integration` is unset and `error` is that exception.
 */
export async function intlHooks(
  t: TestContext,
  config: IntlConfigInput,
  options?: { root?: string },
): Promise<IntlHooks> {
  const root = options?.root ?? (await projectRoot(t));
  return new Session(root, config);
}

/**
 * Writes `<name>.astro` under `src/views/` and runs `astro:config:setup` under `astro dev`.
 * Dev skips the build-only sitemap data route, so `injected` is the row routes.
 */
export async function inject(
  t: TestContext,
  config: IntlConfigInput,
  views: readonly string[],
): Promise<{ root: string; injected: InjectedRoute[] }> {
  const hooks = await intlHooks(t, config);
  await writeViews(hooks.root, views);
  await hooks.setup({ command: 'dev' });
  return { root: hooks.root, injected: hooks.injected };
}
