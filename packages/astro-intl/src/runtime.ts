import { flattenIntlConfig, type IntlConfig, type IntlConfigInput } from './define-intl.ts';

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
  const cached = flatConfigs.get(next);
  if (cached) return cached;
  const flat = flattenIntlConfig(next);
  if (flat !== next) flatConfigs.set(next, flat);
  return flat;
}

export function setIntlConfig(next: IntlConfig | IntlConfigInput | undefined): void {
  // A collection object is stored as its key and optional pairing id.
  // Replacing the object rebuilds pairing. The same object does not.
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
