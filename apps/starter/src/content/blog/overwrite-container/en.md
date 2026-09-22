---
id: overwrite-container
locale: en
slug: blog/overwrite-container
pubDate: 2026-01-15
status: published
seoTitle: Overwrite Measure
seoDesc: Tune a Measure with static measure classes on the landmark, or by editing the co-located utilities file — do not wrap it.
# Co-located demo image so preview needs no cloud account — not the B2 path.
featImage: ./feat.png
featImageAlt: Placeholder feature image — replace with your own.
primaryKeyword: container overwrite
secondaryKeywords:
  - measure
  - call-site class
tags:
  - engineering
excerpt: Put measure classes on the landmark for one-off size and gutter, or edit the utilities file to change defaults — do not wrap it.
---

# Overwrite Measure

A Measure is a width constraint — a centered max width and a side inset so contents do not touch the viewport edge. The class is `measure` (Tailwind already owns `container`). Put it on the element that is already the landmark.

```astro
<main class="measure measure-size-wide mx-auto bg-body">…</main>
```

Background on `measure` cannot go edge-to-edge. Full-bleed paint wraps it:

```astro
<main class="bg-body">
  <div class="measure measure-size-wide mx-auto">…</div>
</main>
```

Open lengths stay static literals. Tailwind’s scan cannot see interpolated class names.

```astro
<main class="measure measure-size-[40rem] measure-gutter-8 mx-auto">…</main>
```

Center with `mx-auto`. Start/end are `ms-0 me-auto` / `me-0 ms-auto`.

**Edit the file** to change defaults — `packages/astro-site/src/components/ui/measure/utilities.css`. That is how you change every instance.

Do **not** wrap `measure` in a project component that injects default classes for every instance. Put classes at the call site, or edit the utilities file.
