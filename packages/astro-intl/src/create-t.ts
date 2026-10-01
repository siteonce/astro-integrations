import { IntlMessageFormat } from 'intl-messageformat';
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

function formatMessage(locale: string, message: string, values?: CatalogValues): string {
  try {
    const formatted = new IntlMessageFormat(message, locale).format(values);
    return typeof formatted === 'string' ? formatted : message;
  } catch {
    return message;
  }
}

/**
 * Pure translator factory. The caller passes one message tree per locale.
 * The locale type defaults to `Locale`: the app's injected union, or `string`
 * when that augmentation is not in the program. A missing catalog for the
 * union is a type error. This module never reads catalog files.
 *
 * Missing keys stay visible as the dotted path (`HomePage.title`). Values are
 * not merged from another locale.
 */
// NoInfer so the default `Locale` is used. Inferring keys from the catalog
// object would accept a set that omits a configured locale.
export function createT<L extends string = Locale>(catalogs: NoInfer<Record<L, unknown>>) {
  const byLocale = catalogs as Record<string, unknown>;

  function t(locale: string, key: string, values?: CatalogValues): string {
    const message = lookup(byLocale[locale], key);
    if (message === undefined) return key;
    return formatMessage(locale, message, values);
  }

  function useTranslations(locale: string, namespace?: string) {
    return (key: string, values?: CatalogValues) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(locale, fullKey, values);
    };
  }

  return { t, useTranslations };
}
