# layouts

## Conventions

- **SiteLayout** is chrome only: styles, Favicon, locale switcher, head pass-through around **BaseLayout**. It does not compose **blocks**. Copied **BaseLayout** owns `<html lang>`.
- Chrome strings come from **catalogs** via `t()`, not from the document body.
- Locale switcher links to the sibling, or that locale’s homepage when the sibling is missing.
