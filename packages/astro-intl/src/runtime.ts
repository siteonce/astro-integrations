import type { IntlConfig } from './define-intl.ts';

export type IntlRuntime = {
  config: IntlConfig;
  /** Tails from `astro:routes:resolved` (catch-all excluded). */
  routeTails: string[];
  /** `routeTails` plus optional `reservedPaths` from config. */
  reservedTails: string[];
};

let config: IntlConfig | undefined;
let routeTails: string[] = [];
let generation = 0;

export function runtimeGeneration(): number {
  return generation;
}

function reservedTails(): string[] {
  return [...new Set([...routeTails, ...(config?.reservedPaths ?? [])])];
}

export function setIntlConfig(next: IntlConfig | undefined): void {
  // Replacing the object rebuilds pairing. The same object does not.
  if (next === config) return;
  config = next;
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
