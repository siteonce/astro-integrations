import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentConfigRuntimeError, importsAstroIntlRuntime } from './content-config-runtime.ts';

const message =
  '@repo/astro-intl: src/content.config.ts imports @repo/astro-intl/runtime. ' +
  'Astro loads the content config before page modules exist, so astro:config/server is unavailable there. ' +
  'Read locales from your intl config instead.';

describe('importsAstroIntlRuntime', () => {
  it('matches static, side-effect, export-from, and dynamic imports', () => {
    const sources = [
      `import { locales } from '@repo/astro-intl/runtime';`,
      `import { locales } from "@repo/astro-intl/runtime";`,
      `import locales from '@repo/astro-intl/runtime';`,
      `import type { Locale } from '@repo/astro-intl/runtime';`,
      `import '@repo/astro-intl/runtime';`,
      `import "@repo/astro-intl/runtime";`,
      `import\n  '@repo/astro-intl/runtime';`,
      `import {\n  locales,\n} from '@repo/astro-intl/runtime';`,
      `export { locales } from '@repo/astro-intl/runtime';`,
      `export * from "@repo/astro-intl/runtime";`,
      `export type { Locale } from '@repo/astro-intl/runtime';`,
      `const locales = await import('@repo/astro-intl/runtime');`,
      `import(\n  "@repo/astro-intl/runtime"\n);`,
      `import { id } from '@repo/astro-intl';\nimport { locales } from '@repo/astro-intl/runtime';`,
    ];
    for (const source of sources) {
      assert.equal(importsAstroIntlRuntime(source), true, source);
    }
  });

  it('ignores other specifiers and a bare mention of the module', () => {
    const sources = [
      `import { id, locale } from '@repo/astro-intl';`,
      `import { locales } from '@repo/astro-intl/sorting';`,
      `import { locales } from '@repo/astro-intl/runtime/extra';`,
      `import { locales } from '@repo/astro-intl/runtime.ts';`,
      `const spec = '@repo/astro-intl/runtime';`,
      `import { id } from '@repo/astro-intl';\nconst spec = '@repo/astro-intl/runtime';`,
      `import { locales } from "@repo/astro-intl/runtime';`,
    ];
    for (const source of sources) {
      assert.equal(importsAstroIntlRuntime(source), false, source);
    }
  });
});

describe('contentConfigRuntimeError', () => {
  const srcDir = '/app/src';
  const root = '/app';

  it('returns undefined when no content config exists', () => {
    assert.equal(
      contentConfigRuntimeError(
        srcDir,
        root,
        () => false,
        () => {
          throw new Error('unread');
        },
      ),
      undefined,
    );
  });

  it('names the content config that imports runtime', () => {
    const file = `${srcDir}/content.config.ts`;
    assert.equal(
      contentConfigRuntimeError(
        srcDir,
        root,
        (candidate) => candidate === file,
        () => `import { locales } from '@repo/astro-intl/runtime';\n`,
      ),
      message,
    );
  });

  it('stops at the first existing content config', () => {
    const modern = `${srcDir}/content.config.mjs`;
    const typed = `${srcDir}/content.config.ts`;
    assert.equal(
      contentConfigRuntimeError(
        srcDir,
        root,
        (candidate) => candidate === modern || candidate === typed,
        (candidate) => {
          if (candidate === modern) return `import { id } from '@repo/astro-intl';\n`;
          return `import { locales } from '@repo/astro-intl/runtime';\n`;
        },
      ),
      undefined,
    );
  });

  it('checks a legacy content config when no modern file exists', () => {
    const legacy = `${srcDir}/content/config.mts`;
    const found = contentConfigRuntimeError(
      srcDir,
      root,
      (candidate) => candidate === legacy,
      () => `export { locales } from '@repo/astro-intl/runtime';\n`,
    );
    assert.match(found ?? '', /^@repo\/astro-intl: src\/content\/config\.mts imports /);
  });

  it('prefers a modern content config over a legacy one', () => {
    const modern = `${srcDir}/content.config.ts`;
    const legacy = `${srcDir}/content/config.ts`;
    assert.equal(
      contentConfigRuntimeError(
        srcDir,
        root,
        (candidate) => candidate === modern || candidate === legacy,
        (candidate) => {
          if (candidate === modern) return `import { id } from '@repo/astro-intl';\n`;
          return `import('@repo/astro-intl/runtime');\n`;
        },
      ),
      undefined,
    );
  });
});
