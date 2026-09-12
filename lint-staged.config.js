// Runs on *staged files only* via the Husky pre-commit hook, then auto-restages
// the results — so a commit no longer leaves reformatted-but-unstaged files
// behind (the whole-repo `pnpm check` did). The tool split mirrors `pnpm check`
// and biome.json's `files.includes`: Biome owns JS/TS/JSON/CSS/Svelte, and
// lints Astro (filename + embedded JS) without formatting it. Prettier owns
// `.astro`/`.md`/`.mdx` formatting.
//
// Type-checking is whole-program (tsc needs the full graph), so it cannot ride
// this per-file scoping — it runs in CI instead (.github/workflows/ci.yml).
//
// `--no-errors-on-unmatched`: don't fail if every staged path in the glob lands
// on a biome-ignored file (e.g. something under an ignored dir).
// `--files-ignore-unknown=true`: pairs with `files.ignoreUnknown` so unknown
// staged extensions don't fail the hook.
export default {
  '*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc,css,svelte}': [
    'biome check --write --no-errors-on-unmatched --files-ignore-unknown=true',
  ],
  '*.astro': ['biome lint --no-errors-on-unmatched --files-ignore-unknown=true'],
  '*.{astro,md,mdx}': ['prettier --write'],
};
