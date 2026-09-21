# layouts

## Conventions

- **SiteLayout** is chrome only: styles, Favicon, Analytics, locale switcher, head pass-through around **BaseLayout**. It does not compose **blocks**. Copied **BaseLayout** owns `<html lang>`.
- Chrome strings come from **catalogs** via `t()`, not from the document body.
- Locale switcher: current locale is `aria-current`. Other locales with a sibling are links. Missing siblings stay visible and disabled.
