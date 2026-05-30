// Runs on *staged files only* via the Husky pre-commit hook, then auto-restages
// the results — so a commit no longer leaves reformatted-but-unstaged files
// behind (the whole-repo `pnpm check` did). The tool split mirrors `pnpm check`
// and biome.json's `files.includes`: Biome owns JS/TS/JSON, Prettier owns
// `.astro`/`.md` (Biome parses neither). `.svelte` is intentionally absent —
// neither tool formats it today, matching `pnpm check`.
//
// Type-checking is whole-program (tsc needs the full graph), so it cannot ride
// this per-file scoping — it runs in CI instead (.github/workflows/ci.yml).
//
// `--no-errors-on-unmatched`: don't fail if every staged path in the glob lands
// on a biome-ignored file (e.g. something under an ignored dir).
export default {
  '*.{js,ts,jsx,tsx,json,jsonc}': ['biome check --write --no-errors-on-unmatched'],
  '*.{astro,md}': ['prettier --write'],
};
