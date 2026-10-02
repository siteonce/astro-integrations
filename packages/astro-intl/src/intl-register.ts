import type { CollectionEntryLike } from './pairing.ts';

/**
 * Empty on purpose. `astroIntl()` injects a module augmentation that adds
 * `locale` as this app's locale union and `entries` as its collection entries.
 * Until that file is in the program, `Locale` is `string` and `EntryOf` is
 * `CollectionEntryLike`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: injected augmentation adds `locale` and `entries`
export interface IntlRegister {}

export type Locale = IntlRegister extends { locale: infer L extends string } ? L : string;

/** Collection entry for `C` when the injected register names it. Otherwise `CollectionEntryLike`. */
export type EntryOf<C extends string> = IntlRegister extends { entries: infer Entries }
  ? C extends keyof Entries
    ? Entries[C]
    : CollectionEntryLike
  : CollectionEntryLike;
