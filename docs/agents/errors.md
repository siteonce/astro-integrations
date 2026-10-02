# Error policy

If a problem can be known without rendering a particular request, fail loudly at startup (or build start) and abort — schema parse failure, missing required config, unknown route/collection that config can name up front, missing required env. Prefer pushing checks to startup. If the same class of condition can only be detected while rendering a specific response, skip or no-op and log at that path so one bad optional resolution does not take down the page.

Error message wording: [`builders.md`](builders.md#error-messages-name-the-fix).
