/**
 * Empty on purpose. `astroIntl()` injects a module augmentation that adds
 * `locale` as this app's locale union. Until that file is in the program,
 * `Locale` is `string`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: injected augmentation adds `locale`
export interface IntlRegister {}

export type Locale = IntlRegister extends { locale: infer L extends string } ? L : string;
