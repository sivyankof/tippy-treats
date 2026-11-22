import { describe, expect, it } from 'vitest';
import type * as Phaser from 'phaser';
import { fitScaleOf, sharedFitScale, wrapWithoutLoneWord } from './fit-text';

describe('fit scales', () => {
  it('is 1 for a label that fits and shrinks one that does not', () => {
    expect(fitScaleOf(100, 200, 0.5)).toBe(1);
    expect(fitScaleOf(400, 200, 0.5)).toBe(0.5);
    expect(fitScaleOf(250, 200, 0.5)).toBeCloseTo(0.8);
    expect(fitScaleOf(0, 200, 0.5)).toBe(1);
  });

  it('never goes below the minimum', () => {
    expect(fitScaleOf(1000, 200, 0.7)).toBe(0.7);
  });

  it('gives a row of labels the smallest scale any of them needs', () => {
    expect(sharedFitScale([120, 130, 250], 200, 0.5)).toBeCloseTo(0.8);
    expect(sharedFitScale([120, 130, 150], 200, 0.5)).toBe(1);
    expect(sharedFitScale([], 200, 0.5)).toBe(1);
  });
});

/** A text whose words are one pixel per letter wide, wrapped greedily like Phaser's word wrap. */
function fakeText(words: string): Phaser.GameObjects.Text & { width: number; lines(): string[] } {
  let wrapWidth = Infinity;
  const lines = (): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of words.split(' ')) {
      const next = line === '' ? word : `${line} ${word}`;
      if (line !== '' && next.length > wrapWidth) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
    return out;
  };
  const fake = {
    setWordWrapWidth(width: number) {
      wrapWidth = width;
      return fake;
    },
    getWrappedText: lines,
    lines,
    get width() {
      return wrapWidth;
    },
  };
  return fake as unknown as Phaser.GameObjects.Text & { width: number; lines(): string[] };
}

describe('wrapWithoutLoneWord', () => {
  it('leaves a line that fits alone', () => {
    const text = fakeText('Music: Tad');
    expect(wrapWithoutLoneWord(text, 100)).toBe(1);
    expect(text.lines()).toEqual(['Music: Tad']);
  });

  it('keeps the usual wrap while the last line has more than one word', () => {
    const credits = 'Music: Josh Lim (www.joshjameslim.com), Tad, Fupi, gilzoide';
    const text = fakeText(credits);
    expect(wrapWithoutLoneWord(text, 46)).toBe(2);
    expect(text.lines()).toEqual([
      'Music: Josh Lim (www.joshjameslim.com), Tad,',
      'Fupi, gilzoide',
    ]);
  });

  it('keeps the number of lines and leaves no lone word on the last one', () => {
    const credits = 'Music: Josh Lim (www.joshjameslim.com), Tad, Fupi, gilzoide';
    const greedy = fakeText(credits);
    greedy.setWordWrapWidth(52, true);
    expect(greedy.lines()).toEqual([
      'Music: Josh Lim (www.joshjameslim.com), Tad, Fupi,',
      'gilzoide',
    ]);

    const text = fakeText(credits);
    expect(wrapWithoutLoneWord(text, 52)).toBe(2);
    const lines = text.lines();
    expect(lines).toHaveLength(2);
    expect(lines[1]?.split(' ').length).toBeGreaterThan(1);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(52);
  });
});
