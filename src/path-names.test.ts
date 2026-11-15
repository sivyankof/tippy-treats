import { describe, expect, it } from 'vitest';

/** Words that ad blockers cut from the dev server: each module loads as its own request. */
const BANNED = [
  'ads',
  'advert',
  'banner',
  'sponsor',
  'track',
  'analytics',
  'counter',
  'pixel',
  'popup',
];

/** The words of one path: split on / - _ . and on camel case, so "loads" is fine but "ads" is not. */
export function pathWords(path: string): string[] {
  return path
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s/\-_.]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
}

describe('pathWords', () => {
  it('splits on separators and camel case', () => {
    expect(pathWords('/src/game/no-ads_offer/FlyingTracker.ts')).toEqual([
      'src',
      'game',
      'no',
      'ads',
      'offer',
      'flying',
      'tracker',
      'ts',
    ]);
  });
  it('keeps a banned word inside another word', () => {
    expect(pathWords('/src/loads/uploads.ts')).not.toContain('ads');
  });
});

describe('file paths under src', () => {
  it('contain no word that an ad blocker cuts', () => {
    const paths = Object.keys(import.meta.glob('/src/**/*', { eager: false }));
    expect(paths.length).toBeGreaterThan(100);
    const bad = paths.filter((path) => pathWords(path).some((word) => BANNED.includes(word)));
    expect(bad).toEqual([]);
  });
});
