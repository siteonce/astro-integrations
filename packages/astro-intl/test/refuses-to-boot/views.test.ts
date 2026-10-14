import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import {
  type IntlSetupOptions,
  injectedViews,
  intlHooks,
  nodeAdapter,
  renderingConfig,
  viewComponent,
} from '../astro.ts';
import { type IntlConfigInput, intlConfig } from '../fixtures.ts';

const viewsDirectory = ['src', 'views'].join('/');

const fallbackOnDemand =
  '@repo/astro-intl: a fallback view exports prerender = false. ' +
  'A fallback route shares its pattern with the {slug} route, and two on-demand routes cannot share one pattern.';

function missingViewMessage(view: string): string {
  return `@repo/astro-intl: view "${view}" has no file under ${viewsDirectory}/.`;
}

function bothFilesMessage(view: string): string {
  return `@repo/astro-intl: view "${view}" has both "${view}.astro" and "${view}/index.astro".`;
}

async function writeViewFiles(root: string, names: readonly string[]): Promise<void> {
  for (const name of names) {
    const file = join(root, viewsDirectory, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '');
  }
}

async function prepare(t: TestContext, config: IntlConfigInput, files: readonly string[]) {
  const hooks = await intlHooks(t, config);
  if (files.length > 0) await writeViewFiles(hooks.root, files);
  return hooks;
}

function blogListing(view: string): IntlConfigInput {
  return intlConfig({
    routes: [
      {
        slug: { en: 'blog', de: 'artikel' },
        collection: 'blog',
        view: 'blog',
        pagination: {
          pageSize: 10,
          slug: { en: 'blog/{page}', de: 'artikel/{page}' },
          view,
        },
      },
    ],
    collections: { translated: ['blog'] },
  });
}

async function bootViews(
  t: TestContext,
  config: IntlConfigInput,
  files: readonly string[],
  options?: IntlSetupOptions,
) {
  const hooks = await prepare(t, config, files);
  await hooks.setup(options);
  return hooks;
}

describe('A row names a view that has no file under `src/views/`, or that has both `<view>.astro` and `<view>/index.astro`.', () => {
  it('refuses when the view file is missing', async (t) => {
    const hooks = await prepare(
      t,
      intlConfig({
        routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'missing' }],
      }),
      [],
    );
    await assert.rejects(() => hooks.setup(), { message: missingViewMessage('missing') });
    assert.deepEqual(hooks.updates, []);
  });

  it('refuses when the view file and the folder index both exist', async (t) => {
    const hooks = await prepare(
      t,
      intlConfig({
        routes: [{ slug: { en: 'post', de: 'beitrag' }, view: 'post' }],
      }),
      ['post.astro', join('post', 'index.astro')],
    );
    await assert.rejects(() => hooks.setup(), { message: bothFilesMessage('post') });
    assert.deepEqual(hooks.updates, []);
  });

  it('boots when only the view file exists', async (t) => {
    const hooks = await bootViews(
      t,
      intlConfig({
        routes: [{ slug: { en: 'post', de: 'beitrag' }, view: 'post' }],
      }),
      ['post.astro'],
      { command: 'dev' },
    );
    assert.deepEqual(injectedViews(hooks.root, hooks.injected), [
      { pattern: '/en/post/[...index]', view: 'post.astro' },
      { pattern: '/de/beitrag/[...index]', view: 'post.astro' },
    ]);
  });

  it('boots when only the folder index exists', async (t) => {
    const hooks = await bootViews(
      t,
      intlConfig({
        routes: [{ slug: { en: 'blog', de: 'artikel' }, view: 'blog' }],
      }),
      [join('blog', 'index.astro')],
      { command: 'dev' },
    );
    assert.deepEqual(injectedViews(hooks.root, hooks.injected), [
      { pattern: '/en/blog/[...index]', view: 'blog/index.astro' },
      { pattern: '/de/artikel/[...index]', view: 'blog/index.astro' },
    ]);
  });
});

describe('`pagination.view` names a missing file, both a file and a folder index, or the wrong locales.', () => {
  it('refuses when the file is missing', async (t) => {
    const hooks = await prepare(t, blogListing('archive'), ['blog.astro']);
    await assert.rejects(() => hooks.setup(), { message: missingViewMessage('archive') });
    assert.deepEqual(hooks.updates, []);
  });

  it('refuses when the file and the folder index both exist', async (t) => {
    const hooks = await prepare(t, blogListing('archive'), [
      'blog.astro',
      'archive.astro',
      join('archive', 'index.astro'),
    ]);
    await assert.rejects(() => hooks.setup(), { message: bothFilesMessage('archive') });
    assert.deepEqual(hooks.updates, []);
  });
});

describe("`viewRendering` is `'request'` and a fallback view exports `prerender = false`, outside `astro dev`.", () => {
  const viewFiles = ['about.astro', 'post.astro', 'blog.astro', 'missing.astro'];

  it('refuses when the fallback view exports prerender = false', async (t) => {
    const hooks = await bootViews(t, renderingConfig('request'), viewFiles, {
      adapter: nodeAdapter,
      command: 'build',
    });
    await assert.rejects(
      () => hooks.routeSetup({ component: viewComponent('missing.astro'), prerender: false }),
      { message: fallbackOnDemand },
    );
  });

  it('boots when viewRendering is build and the fallback view exports prerender = false', async (t) => {
    const hooks = await bootViews(t, renderingConfig('build'), viewFiles, { command: 'build' });
    await hooks.routeSetup({ component: viewComponent('missing.astro'), prerender: false });
    assert.equal(hooks.error, undefined);
  });

  it('boots when astro dev runs and the fallback view exports prerender = false', async (t) => {
    const hooks = await bootViews(t, renderingConfig('request'), viewFiles, { command: 'dev' });
    await hooks.routeSetup({ component: viewComponent('missing.astro'), prerender: false });
    assert.equal(hooks.error, undefined);
  });

  it('boots when the fallback view is prerendered and other views are on demand', async (t) => {
    const hooks = await bootViews(t, renderingConfig('request'), viewFiles, {
      adapter: nodeAdapter,
      command: 'build',
    });
    await hooks.routeSetup({ component: viewComponent('missing.astro'), prerender: true });
    await hooks.routeSetup({ component: viewComponent('blog.astro'), prerender: false });
    await hooks.routeSetup({ component: viewComponent('post.astro'), prerender: false });
    await hooks.routeSetup({ component: viewComponent('about.astro'), prerender: false });
    assert.equal(hooks.error, undefined);
  });
});
