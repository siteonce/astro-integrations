/**
 * Temp project directories, `astroIntl` hook runs, and Astro's paginate.
 * The hook runner records injected routes, config updates, injected types,
 * logger lines, and thrown errors.
 */

import { mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astroIntl } from '@repo/astro-intl';
import type { AstroConfig, AstroIntegration, PaginateFunction } from 'astro';

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
  } as ResolvedRoute;
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
