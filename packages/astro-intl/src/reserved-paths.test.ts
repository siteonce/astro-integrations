import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileRouteCollision, isIntlRoute, servesSiteRoot } from './reserved-paths.ts';
import type { CompiledRoute } from './routing.ts';

function compiled(pattern: string, kind: CompiledRoute['kind'], view: string): CompiledRoute {
  return { pattern, view, locale: 'en', rowIndex: 0, kind };
}

function assertCollision(file: string, injected: CompiledRoute): void {
  assert.deepEqual(fileRouteCollision([{ pattern: file }], [injected]), { file, injected });
}

function assertNoCollision(file: string, injected: CompiledRoute): void {
  assert.equal(fileRouteCollision([{ pattern: file }], [injected]), undefined);
}

describe('fileRouteCollision', () => {
  const entry = compiled('/en/blog/[slug]', 'entry', 'post');
  const listing = compiled('/en/blog/[...page]', 'listing', 'blog');

  it('flags a file route that wins over the injected route', () => {
    assertCollision('/en/blog/[post]', entry);
    assertCollision('/de/artikel/[id]', compiled('/de/artikel/[slug]', 'fallback', 'missing'));
    assertCollision('/en/about', compiled('/en/about/[...index]', 'static', 'about'));
    assertCollision('/en/about/[...rest]', compiled('/en/about/[...index]', 'static', 'about'));
    assertCollision('/', compiled('/[...index]', 'static', 'home'));
    assertCollision('/en/blog', listing);
    assertCollision('/en/blog/2', listing);
    assertCollision('/en/blog/[n]', listing);
    assertCollision('/en/blog/[...rest]', listing);
  });

  it('ignores a file route that does not win', () => {
    assertNoCollision('/en/blog/rss.xml', listing);
    assertNoCollision('/en/blog/rss.xml', entry);
    assertNoCollision('/en/blog/[slug].json', entry);
    assertNoCollision('/[locale]/[...path]', entry);
    assertNoCollision('/[locale]/[...path]', listing);
    assertNoCollision('/[locale]/blog/[slug]', entry);
    assertNoCollision('/en/about/[section]', compiled('/en/about/[...index]', 'static', 'about'));
    assertNoCollision('/en/about/2', compiled('/en/about/[...index]', 'static', 'about'));
    assertNoCollision('/en/other', compiled('/en/about/[...index]', 'static', 'about'));
  });

  it('flags a number or param on a [page] listing and ignores the bare tail', () => {
    const numbered = compiled('/en/blog/[page]', 'listing', 'blog');
    assertCollision('/en/blog/2', numbered);
    assertCollision('/en/blog/[n]', numbered);
    assertNoCollision('/en/blog', numbered);
    assertNoCollision('/en/blog/[...rest]', numbered);
    assertNoCollision('/en/blog/rss.xml', numbered);
  });

  it('lets an unprefixed rss.xml sit beside the default-locale home', () => {
    const home = compiled('/[...index]', 'static', 'home');
    assertNoCollision('[...locale]/rss.xml', home);
    assertNoCollision('/rss.xml', home);
    assertNoCollision('[...locale]/rss.xml', compiled('/blog/[slug]', 'entry', 'post'));
  });
});

describe('servesSiteRoot', () => {
  it('matches a page or a redirect at /', () => {
    assert.equal(servesSiteRoot([{ patternRegex: /^\/$/u }]), true);
  });

  it('rejects locale-prefixed routes', () => {
    assert.equal(
      servesSiteRoot([{ patternRegex: /^\/en\/$/u }, { patternRegex: /^\/de\/$/u }]),
      false,
    );
  });
});

describe('isIntlRoute', () => {
  const projectRoot = '/app';
  const post = resolve(projectRoot, 'src/views/post.astro');
  const patterns = new Set(['/de/artikel/[slug]']);

  it('rejects an external route that is not an intl entrypoint', () => {
    assert.equal(
      isIntlRoute(
        {
          origin: 'external',
          entrypoint: '/pkg/astro-og-image/src/route.ts',
          pattern: '/_og/[...path].png',
        },
        new Set([post]),
        projectRoot,
        patterns,
      ),
      false,
    );
  });

  it('accepts an intl entrypoint on an injected pattern', () => {
    assert.equal(
      isIntlRoute(
        {
          origin: 'external',
          entrypoint: 'src/views/post.astro',
          pattern: 'de/artikel/[slug]',
        },
        new Set([post]),
        projectRoot,
        patterns,
      ),
      true,
    );
  });
});
