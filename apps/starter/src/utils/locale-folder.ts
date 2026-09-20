/** Parent folder of a locale file (`hello-world/en.mdx` → `hello-world`). */
export function localeFolder(entry: { id: string; filePath?: string }): string {
  const fromPath = parentDir(entry.filePath);
  if (fromPath) return fromPath;
  const parts = entry.id.replaceAll('\\', '/').split('/').filter(Boolean);
  const fromId = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!fromId) {
    throw new Error(`starter: locale folder missing on ${entry.id}`);
  }
  return fromId;
}

function parentDir(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}
