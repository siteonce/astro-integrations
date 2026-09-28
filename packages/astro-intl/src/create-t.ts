import { IntlMessageFormat } from 'intl-messageformat';

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
 * With an explicit locale type, a missing locale is a type error.
 * This module never reads catalog files.
 *
 * Missing keys stay visible as the dotted path (`HomePage.title`). Values are
 * not merged from another locale.
 */
export function createT<L extends string = string>(catalogs: Record<L, unknown>) {
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
