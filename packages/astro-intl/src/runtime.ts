import * as z from 'zod';
import {
  type IntlConfig,
  type IntlConfigInput,
  isParsedIntlConfig,
  safeParseIntlConfig,
} from './define-intl.ts';

export type IntlRuntime = {
  config: IntlConfig;
  /** Tails from `astro:routes:resolved` (intl's own routes excluded). */
  routeTails: string[];
  /** `routeTails` plus optional `reservedPaths` from config. */
  reservedTails: string[];
};

let config: IntlConfig | undefined;
let routeTails: string[] = [];
let generation = 0;
const flatConfigs = new WeakMap<object, IntlConfig>();

export function runtimeGeneration(): number {
  return generation;
}

function reservedTails(): string[] {
  return [...new Set([...routeTails, ...(config?.reservedPaths ?? [])])];
}

function storedConfig(next: IntlConfig | IntlConfigInput): IntlConfig {
  // A config this package already parsed keeps its entry id and defaults.
  if (isParsedIntlConfig(next)) return next;
  const cached = flatConfigs.get(next);
  if (cached) return cached;
  // Defaults and collection flattening run once per authored object.
  // The same object does not rebuild pairing.
  const parsed = safeParseIntlConfig(next);
  if (!parsed.success) {
    throw new Error(
      `@repo/astro-intl: intl config failed validation.\n${z.prettifyError(parsed.error)}`,
    );
  }
  flatConfigs.set(next, parsed.data);
  return parsed.data;
}

export function setIntlConfig(next: IntlConfig | IntlConfigInput | undefined): void {
  const resolved = next === undefined ? undefined : storedConfig(next);
  if (resolved === config) return;
  config = resolved;
  generation += 1;
}

export function setRouteTails(tails: string[]): void {
  routeTails = tails;
  generation += 1;
}

export function getIntlRuntime(): IntlRuntime {
  if (!config) {
    throw new Error('@repo/astro-intl: astroIntl() has not run.');
  }
  return {
    config,
    routeTails,
    reservedTails: reservedTails(),
  };
}
