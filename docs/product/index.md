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

A public URL, route, or render mode exists because a config line names it, not because another field implies it. The same holds for every behavior: a field's name or a value's shape never switches what a package does unless config says so. Where Astro needs something the customer did not write, such as a spread segment, the owning file names it next to the line that causes it.

Hidden plumbing is fine when it eases integration or carries data the customer builds from, and takes no decision away from them. Examples are a build-only route, a generated file, or a hidden folder. The owning file names each one.

## Refuse, don't repair

A package uses its input as written, or fails with an error that names the fix. It does not convert a value, trim it, or accept a second spelling of the same thing. Shaping values is the customer's job, in the collection schema or the config line. Each repair is a rule the customer must know without seeing it, and a second spelling is a second way to write one thing ([`builders.md`](../agents/builders.md#small-write-surface)).

## Tests document behavior

The starter shows one setup by example. A package's tests show the rest: each capability and each refusal its product file names, run through the package's public calls. Tests are written before the code, so the record exists before the behavior does. When a product file and a test disagree, one of them is wrong; fix both in the same change. A refusal the code makes and the product file doesn't name stays when it stops silently wrong output, and the product file names it. A check that only repeats another one goes ([No false rules](../agents/builders.md#no-false-rules)).

## Reading order

| File                             | Agreement                             |
| -------------------------------- | ------------------------------------- |
| [`site.md`](site.md)             | What the visitor gets                 |
| [`snapshot.md`](snapshot.md)     | What the customer copies and owns     |
| [`intl.md`](intl.md)             | Translation on top of Astro           |
| [`publishing.md`](publishing.md) | Who emits URLs, feeds, and robots     |
| [`later.md`](later.md)           | Parked, and what this product refuses |
