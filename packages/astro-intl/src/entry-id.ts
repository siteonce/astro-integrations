function readStringField(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Pairing key: collection name + the id field on the entry. */
export function resolveEntryId(
  collection: string,
  data: Record<string, unknown>,
  field = 'id',
): string {
  const value = readStringField(data, field);
  if (!value) {
    throw new Error(`@repo/astro-intl: id field "${field}" is missing.`);
  }
  return `${collection}/${value}`;
}
