# Version policy

Never infer package/framework versions from training data. Framework and dependency majors are whatever the installed lockfile pins. Resolve via an MCP docs server or the installed `package.json` / `pnpm-lock.yaml` before generating code that names a version, API surface, or feature.
