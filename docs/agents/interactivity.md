# Interactivity ladder

Climb and stop at the first rung that works: (1) platform/CSS; (2) a few lines of vanilla JS in an Astro `<script>`; (3) a hydrated Svelte island (`client:*`) only for genuinely stateful reactive logic, not mere show/hide. A hydrated island is never the default first step.
