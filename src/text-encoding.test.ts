import { describe, expect, it } from 'vitest';

/**
 * UTF-8 Cyrillic read back as Windows-1251 turns every letter into "Р" or "С" followed by a byte
 * from 0x80..0xBF of that code page ("Мастерство" -> "РњР°СЃС‚..."). Three such pairs in a row
 * do not happen in real Russian text.
 */
const MOJIBAKE =
  /(?:[\u0420\u0421][\u00a0-\u00bf\u0401-\u040f\u0451-\u045f\u0490\u0491\u2013-\u2122]){3,}/u;

/** The first garbled fragment of a text, or null when the text is clean. */
export function findMojibake(text: string): string | null {
  return MOJIBAKE.exec(text)?.[0] ?? null;
}

describe('findMojibake', () => {
  it('finds Cyrillic that went through the wrong code page', () => {
    expect(findMojibake('see "РњР°СЃС‚РµСЂСЃС‚РІРѕ"')).toBe('РњР°СЃС‚РµСЂСЃС‚РІРѕ');
    expect(findMojibake('"РџСЂРѕРєР°С‡РєР°"')).not.toBeNull();
  });
  it('passes real Russian words', () => {
    expect(findMojibake('Мастерство, Прокачка, Рёбрышки, СССР, Сёмга')).toBeNull();
  });
});

describe('text files of the repository', () => {
  it('contain no garbled Cyrillic', () => {
    const files = {
      ...import.meta.glob<string>('/src/**/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
      ...import.meta.glob<string>('/scripts/**/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
      ...import.meta.glob<string>('/docs/**/*.md', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    };
    expect(Object.keys(files).length).toBeGreaterThan(100);
    const bad = Object.entries(files)
      .filter(([path]) => !path.endsWith('/text-encoding.test.ts'))
      .map(([path, text]) => [path, findMojibake(text)])
      .filter(([, fragment]) => fragment !== null);
    expect(bad).toEqual([]);
  });
});
