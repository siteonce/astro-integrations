function readStringField(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Pairing key: collection name + data[idField]. */
export function resolveEntryId(
  collection: string,
  data: Record<string, unknown>,
  idField = 'id',
): string {
  const value = readStringField(data, idField);
  if (!value) {
    throw new Error(`@repo/astro-intl: id field "${idField}" is missing.`);
  }
  return `${collection}/${value}`;
}
