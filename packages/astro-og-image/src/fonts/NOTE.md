# Bundled default font

`inter-latin-400-normal.woff` / `inter-latin-700-normal.woff` are vendored verbatim from the `@fontsource/inter` package (kept as a lib devDependency for provenance and re-vendoring). They are the lib's built-in OG font so the default template renders with zero consumer setup.

- **Format is `.woff`, not `.woff2`** — Satori cannot consume brotli-compressed `.woff2`. Re-vendor only `.woff`/`.ttf`/`.otf` files.
- Inter is licensed under the SIL Open Font License 1.1 (`LICENSE` in this folder) — redistributable; keep the license file alongside the fonts.
- Ships to consumers via the package `files: ["src"]` allowlist.
