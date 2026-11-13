import en from './en.json';
import ru from './ru.json';

export type Lang = 'en' | 'ru';

type Dictionary = { [key: string]: string | Dictionary };

export const DICTIONARIES: Record<Lang, Dictionary> = { en, ru };

let current: Lang = 'en';

/** Russian when the system (first) locale is Russian, English otherwise. */
export function detectLang(locales: readonly string[]): Lang {
  return locales[0]?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translated string for a dotted key; `{name}` placeholders are filled from params. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const template = lookup(DICTIONARIES[current], key) ?? lookup(DICTIONARIES.en, key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

const GROUP_SIZE_PATTERN = /\B(?=(\d{3})+(?!\d))/g;
const separators = new Map<Lang, string>();

/** Thousands separator of the language, taken from Intl (a thin space for ru, a comma for en). */
function groupSeparator(lang: Lang): string {
  let separator = separators.get(lang);
  if (separator === undefined) {
    const parts = new Intl.NumberFormat(lang).formatToParts(1_000_000);
    separator = parts.find((part) => part.type === 'group')?.value ?? ',';
    separators.set(lang, separator);
  }
  return separator;
}

/**
 * Integer with thousands separators for the current language: `1 250` or `1,250`.
 * Grouping is always applied, even to four digits (Intl skips it for ru).
 */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(GROUP_SIZE_PATTERN, groupSeparator(current));
}

/** Every dotted key of a dictionary, sorted. */
export function keysOf(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary)
    .flatMap(([name, value]) =>
      typeof value === 'string' ? [prefix + name] : keysOf(value, `${prefix}${name}.`),
    )
    .sort();
}
