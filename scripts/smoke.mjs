/**
 * Packs @siteonce/astro-intl and installs that tarball into a copy of
 * fixtures/intl-smoke outside this repo, then runs `astro build` and `astro check`.
 *
 * The copy is not a workspace member. Nothing in this repo sets a `source`
 * condition through NODE_OPTIONS. The demo passes `--conditions=source` on its
 * own command line, and this fixture does not, so resolution uses dist/.
 *
 * Intl writes `_intl/sitemap-entries.json` while prerendering and deletes it at
 * `astro:build:done` after reading the list. A successful build is that read.
 * The build log names the route, and the file is gone afterward.
 */

import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureSource = join(repoRoot, 'fixtures', 'intl-smoke');

const resolvedSubpaths = [
  ['@siteonce/astro-intl', 'dist/integration.js'],
  ['@siteonce/astro-intl/runtime', 'dist/runtime.js'],
  ['@siteonce/astro-intl/sorting', 'dist/sorting.js'],
  ['@siteonce/astro-intl/create-intl', 'dist/create-intl.js'],
  ['@siteonce/astro-intl/shadowed-entries', 'dist/shadowed-entries.js'],
  ['@siteonce/astro-intl/package.json', 'package.json'],
];

const builtPages = [
  ['dist/posts/hello/index.html', 'Packed intro'],
  ['dist/de/artikel/hallo/index.html', 'Uebersetztes Intro'],
];

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('close', (status, signal) => {
      if (status !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited ${status ?? signal}`));
        return;
      }
      resolveRun({ stdout, stderr });
    });
  });
}

function assertTarball(listing) {
  const names = listing.split('\n').filter((line) => line.length > 0);
  for (const suffix of ['dist/create-intl.js', 'src/create-intl.ts']) {
    if (!names.some((name) => name.endsWith(suffix))) {
      throw new Error(`tarball is missing ${suffix}`);
    }
  }
  const refused = names.find((name) => {
    return (
      /(^|\/)test\//u.test(name) ||
      name.endsWith('src/env.d.ts') ||
      /(^|\/)tsconfig[^/]*\.json$/u.test(name) ||
      name.endsWith('stryker.config.json')
    );
  });
  if (refused) throw new Error(`tarball contains ${refused}`);
}

function findNamed(dir, name) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findNamed(path, name);
      if (found) return found;
    } else if (entry.name === name) {
      return path;
    }
  }
  return undefined;
}

function resolutionProbe() {
  const checks = resolvedSubpaths
    .map(([specifier, suffix]) => {
      return `  {
    const url = import.meta.resolve(${JSON.stringify(specifier)});
    if (!url.includes(${JSON.stringify(suffix)})) {
      throw new Error(${JSON.stringify(specifier)} + ' resolved to ' + url);
    }
  }`;
    })
    .join('\n');
  // runtime.js imports astro:config/server, which exists only inside Astro.
  return `const loaded = [
  '@siteonce/astro-intl',
  '@siteonce/astro-intl/sorting',
  '@siteonce/astro-intl/create-intl',
  '@siteonce/astro-intl/shadowed-entries',
];
${checks}
for (const specifier of loaded) await import(specifier);
`;
}

async function smoke(work) {
  await run(
    'pnpm',
    ['--filter', '@siteonce/astro-intl', 'pack', '--pack-destination', work],
    repoRoot,
  );
  const tarballs = readdirSync(work).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`expected one tarball in ${work}, found ${tarballs.join(', ') || 'none'}`);
  }
  const tarball = join(work, tarballs[0]);
  const listed = await run('tar', ['-tzf', tarball], work);
  assertTarball(listed.stdout);

  const appDir = join(work, 'app');
  cpSync(fixtureSource, appDir, { recursive: true });
  const manifestPath = join(appDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.dependencies['@siteonce/astro-intl'] = `file:${tarball}`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // CI sets a frozen lockfile when one exists. This copy has none until install.
  await run('pnpm', ['install', '--no-frozen-lockfile'], appDir);

  const probe = join(appDir, 'resolve-dist.mjs');
  writeFileSync(probe, resolutionProbe());
  try {
    await run('node', [probe], appDir);
  } finally {
    rmSync(probe);
  }

  const built = await run('pnpm', ['exec', 'astro', 'build'], appDir);
  const buildLog = `${built.stdout}\n${built.stderr}`;
  // Vite's wording when a packed map names a source that is not in the package.
  // Reproduced with `src` left out of `files`:
  // [WARN] [vite] Sourcemap for "<dist file>" points to missing source files
  const sourceMapWarning = buildLog.split('\n').find((line) => {
    return (
      line.includes('@siteonce/astro-intl') &&
      line.includes('Sourcemap for "') &&
      line.includes('" points to missing source files')
    );
  });
  if (sourceMapWarning) {
    throw new Error(`astro build warned about an intl source map:\n${sourceMapWarning.trim()}`);
  }
  if (!buildLog.includes('sitemap-entries.json')) {
    throw new Error('astro build did not prerender /_intl/sitemap-entries.json');
  }
  const dataFile = join(appDir, 'dist', '_intl', 'sitemap-entries.json');
  if (existsSync(dataFile)) {
    throw new Error('sitemap data file is still in dist after astro:build:done');
  }

  const routeSource = findNamed(join(appDir, '.astro'), 'sitemap-entries.ts');
  if (!routeSource) throw new Error('sitemap data route was not written');
  const route = readFileSync(routeSource, 'utf8');
  for (const specifier of [
    '@siteonce/astro-intl/create-intl',
    '@siteonce/astro-intl/shadowed-entries',
  ]) {
    if (!route.includes(specifier)) {
      throw new Error(`sitemap data route does not import ${specifier}`);
    }
  }

  for (const [relativePath, text] of builtPages) {
    const file = join(appDir, relativePath);
    if (!existsSync(file)) throw new Error(`missing built page ${relativePath}`);
    const html = readFileSync(file, 'utf8');
    if (!html.includes(text)) {
      throw new Error(`${relativePath} does not include ${JSON.stringify(text)}`);
    }
    if (!html.includes('en,de')) {
      throw new Error(`${relativePath} does not include the runtime locale list`);
    }
  }

  await run('pnpm', ['exec', 'astro', 'check'], appDir);
}

const work = mkdtempSync(join(tmpdir(), 'astro-intl-smoke-'));
try {
  await smoke(work);
  console.log('smoke: packed tarball built and type-checked');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
