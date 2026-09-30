# Product

Agreements about this snapshot. They change when we change our mind. A rename or a new helper does not get a paragraph. Where the tree lags, the owning file says so under **Today**. Delete that note when the gap closes.

Glossary: [`CONTEXT.md`](../../CONTEXT.md). How we build: [`docs/agents/`](../agents/).

## Who

The **customer** copies the repo and owns every file. They ship a directory, magazine, or blog. They are a developer.

The **visitor** reads that site. Locale, the document they land on, and the search and social tags are the product they meet.

## Promise

A **snapshot** for Astro **content sites**. No promised upgrades. Workspace packages stay in-tree. The visitor gets documents in their language, a locale switch that lands on the same document, and head tags driven by that document.

## No boxing in

Tooling hands the customer building blocks and the data behind them. The customer can add to, wrap, or replace every piece a package hands them. They can also skip a package's convenience path and build the same result from the same data.

A public URL, route, or render mode exists because a config line names it, not because another field implies it. Where Astro needs something the customer did not write, such as a spread segment, the owning file names it next to the line that causes it.

Hidden plumbing is fine when it eases integration or carries data the customer builds from, and takes no decision away from them. Examples are a build-only route, a generated file, or a hidden folder. The owning file names each one.

## Reading order

| File                             | Agreement                             |
| -------------------------------- | ------------------------------------- |
| [`site.md`](site.md)             | What the visitor gets                 |
| [`snapshot.md`](snapshot.md)     | What the customer copies and owns     |
| [`intl.md`](intl.md)             | Translation on top of Astro           |
| [`publishing.md`](publishing.md) | Who emits URLs, feeds, and robots     |
| [`later.md`](later.md)           | Parked, and what this product refuses |
