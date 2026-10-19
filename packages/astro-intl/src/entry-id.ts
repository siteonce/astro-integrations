export type PairingField = 'id' | 'locale' | 'slug';

/** A pairing field is present, and its value is not a string. */
export class NonStringFieldError extends Error {
  constructor(kind: PairingField, field: string, where: string) {
    super(
      `@siteonce/astro-intl: ${kind} field "${field}" on ${where} is not a string. Coerce it in the collection schema, for example with z.coerce.string().`,
    );
    this.name = 'NonStringFieldError';
  }
}

/**
 * The field's string, including `''`, or `undefined` when the field is absent.
 * Any other value aborts the load.
 */
export function readStringField(
  data: Record<string, unknown>,
  field: string,
  kind: PairingField,
  where: string,
): string | undefined {
  const value = data[field];
  if (typeof value === 'string') return value;
  if (value === undefined) return undefined;
  throw new NonStringFieldError(kind, field, where);
}

/** Pairing key: collection name + the id field on the entry. */
export function resolveEntryId(
  collection: string,
  data: Record<string, unknown>,
  field: string,
  where: string,
): string {
  const value = readStringField(data, field, 'id', where);
  if (!value) {
    throw new Error(`@siteonce/astro-intl: id field "${field}" is missing.`);
  }
  return `${collection}/${value}`;
}
