/**
 * Comparators for the function `listingPaths`'s `sort` returns.
 * `sortBy` chains them. The first non-zero result wins.
 */

/** Comparator for `Array.prototype.toSorted`. Negative when `a` comes first. */
export type Compare<T> = (a: T, b: T) => number;

/** `asc` keeps smaller values first. `desc` reverses that. */
export type Direction = 'asc' | 'desc';

/** Compares `get(entry)` as a date. */
export function byDate<T>(get: (entry: T) => Date, direction: Direction): Compare<T> {
  const sign = direction === 'asc' ? 1 : -1;
  return (a, b) => sign * (get(a).valueOf() - get(b).valueOf());
}

/** Compares `get(entry)` as a number. */
export function byNumber<T>(get: (entry: T) => number, direction: Direction): Compare<T> {
  const sign = direction === 'asc' ? 1 : -1;
  return (a, b) => sign * (get(a) - get(b));
}

/**
 * Compares `get(entry)` with `Intl.Collator` for `locale`, created once per call.
 *
 * ```ts
 * sort: ({ locale }) => sortBy(
 *   byFlag((entry) => entry.data.featured),
 *   byText((entry) => entry.data.title, locale, 'asc'),
 * ),
 * ```
 */
export function byText<T>(
  get: (entry: T) => string,
  locale: string,
  direction: Direction,
): Compare<T> {
  const collator = new Intl.Collator(locale);
  const sign = direction === 'asc' ? 1 : -1;
  return (a, b) => sign * collator.compare(get(a), get(b));
}

/** Puts `true` before `false`. */
export function byFlag<T>(get: (entry: T) => boolean): Compare<T> {
  return (a, b) => Number(get(b)) - Number(get(a));
}

/** First non-zero comparator wins. Returns 0 when every comparator ties. */
export function sortBy<T>(...compares: Compare<T>[]): Compare<T> {
  return (a, b) => {
    for (const compare of compares) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}
