# layouts

Site chrome and **type layouts**. No `src/views/`.

## Conventions

- **SiteLayout** is chrome only: styles, Favicon, locale switcher, head pass-through around **BaseLayout**. It does not compose **blocks**. Copied **BaseLayout** owns `<html lang>`.
- **Type layouts** (`home`, `listing`, `post`, `term`) receive `locale` + entry. They own `render()` when the entry has a body, `t()`, **Seo** / `<Hreflang />` / **Schema** in `slot="head"`, Measure / Flow on `<main>`, and **block** composition. No section UI inlined beyond the landmark frame.
- Chrome strings come from **catalogs** via `t()`, not from the document body.
- Locale switcher links to the sibling, or that locale’s homepage when the sibling is missing.
