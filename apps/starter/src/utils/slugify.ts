import { slug } from 'github-slugger';

const german: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/** Public-tail rest only. Transliterates German, then `github-slugger` `slug()`. */
export function slugify(value: string): string {
  let transliterated = value;
  for (const [from, to] of Object.entries(german)) {
    transliterated = transliterated.replaceAll(from, to);
  }
  return slug(transliterated);
}
