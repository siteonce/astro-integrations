import { IntlMessageFormat, MissingValueError } from 'intl-messageformat';
import type { Locale } from './intl-register.ts';

export type CatalogValues = Record<string, string | number | boolean | Date | null | undefined>;

function lookup(tree: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
  return typeof value === 'string' ? value : undefined;
}

/** Every message string, nested groups included. A string that does not parse throws. */
function assertMessages(locale: string, tree: unknown, key: string): void {
  if (typeof tree === 'string') {
    try {
      new IntlMessageFormat(tree, locale);
    } catch {
      throw new Error(
        `@siteonce/astro-intl: message "${key}" in locale "${locale}" is not valid ICU. Fix it in the "${locale}" catalog.`,
      );
    }
    return;
  }
  if (typeof tree !== 'object' || tree === null) return;
  for (const [part, value] of Object.entries(tree)) {
    assertMessages(locale, value, key === '' ? part : `${key}.${part}`);
  }
}

// AST `type` from intl-messageformat: 2 number, 6 plural and selectordinal, 3 date, 4 time.
const NUMBER_PLACEHOLDER: readonly number[] = [2, 6];
const DATE_PLACEHOLDER: readonly number[] = [3, 4];

type MessageNode = {
  type: number;
  value?: string;
  children?: readonly MessageNode[];
  options?: Readonly<Record<string, { value: readonly MessageNode[] }>>;
};

function canFormatNumber(value: CatalogValues[string]): boolean {
  return typeof value === 'number' || (typeof value === 'string' && Number.isFinite(Number(value)));
}

function canFormatDate(value: CatalogValues[string]): boolean {
  return typeof value === 'number' || value instanceof Date;
}

/** A present value the placeholder cannot format. Nested options and tags count. A missing value does not. */
function valueCannotFormat(nodes: readonly MessageNode[], values: CatalogValues): boolean {
  for (const node of nodes) {
    if (node.value !== undefined && node.value in values) {
      const value = values[node.value];
      if (NUMBER_PLACEHOLDER.includes(node.type) && !canFormatNumber(value)) return true;
      if (DATE_PLACEHOLDER.includes(node.type) && !canFormatDate(value)) return true;
    }
    const nested = [
      ...(node.children ?? []),
      ...Object.values(node.options ?? {}).flatMap((option) => option.value),
    ];
    if (valueCannotFormat(nested, values)) return true;
  }
  return false;
}

function warnReturned(locale: string, key: string, missing: boolean): void {
  const detail = missing ? 'is missing a value' : 'could not format a value';
  console.warn(
    `@siteonce/astro-intl: message "${key}" in locale "${locale}" ${detail}; returned as written.`,
  );
}

function formatMessage(
  locale: string,
  key: string,
  message: string,
  values?: CatalogValues,
): string {
  const formatter = new IntlMessageFormat(message, locale);
  if (values && valueCannotFormat(formatter.getAst(), values)) {
    warnReturned(locale, key, false);
    return message;
  }
  try {
    const formatted = formatter.format(values);
    return typeof formatted === 'string' ? formatted : message;
  } catch (error) {
    warnReturned(locale, key, error instanceof MissingValueError);
    return message;
  }
}

/**
 * Pure translator factory. The caller passes one message tree per locale.
 * The locale type defaults to `Locale`: the app's injected union, or `string`
 * when that augmentation is not in the program. A missing catalog for the
 * union is a type error. This module never reads catalog files.
 *
 * Every message string is parsed as ICU, nested groups included. A message
 * that does not parse throws, naming the locale and the dotted key.
 * Missing keys stay visible as the dotted path (`HomePage.title`). Values are
 * not merged from another locale. A call that omits a value the message names,
 * or passes a value its placeholder can't format, returns the message as
 * written and warns, naming the locale and the key.
 */
// NoInfer so the default `Locale` is used. Inferring keys from the catalog
// object would accept a set that omits a configured locale.
export function createT<L extends string = Locale>(catalogs: NoInfer<Record<L, unknown>>) {
  const byLocale = catalogs as Record<string, unknown>;
  for (const [locale, tree] of Object.entries(byLocale)) {
    assertMessages(locale, tree, '');
  }

  function t(locale: L, key: string, values?: CatalogValues): string {
    const message = lookup(byLocale[locale], key);
    if (message === undefined) return key;
    return formatMessage(locale, key, message, values);
  }

  function useTranslations(locale: L, namespace?: string) {
    return (key: string, values?: CatalogValues) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(locale, fullKey, values);
    };
  }

  return { t, useTranslations };
}
