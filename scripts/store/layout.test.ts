import { describe, expect, it } from 'vitest';
import { fitCaption, glueShortWords, wavePoints, type CaptionLimits } from './layout';

/** Every letter and space is 0.6 of the font size wide. */
const mono = (line: string): number => line.length * 0.6;

const LIMITS: CaptionLimits = {
  maxSize: 100,
  minSize: 40,
  maxWidth: 1000,
  maxHeight: 400,
  maxLines: 2,
  lineHeight: 1,
  glueUpTo: 2,
  moreLinesCost: 1,
};

describe('fitCaption', () => {
  it('keeps a short caption on one line at the largest size', () => {
    expect(fitCaption('TIPPY TREATS', mono, LIMITS)).toEqual({
      lines: ['TIPPY TREATS'],
      size: 100,
    });
  });

  it('breaks a long caption between words, never inside a word, at the size that fits', () => {
    const fit = fitCaption('НОВАЯ БАШНЯ КАЖДЫЙ ДЕНЬ!', mono, LIMITS);
    expect(fit?.lines).toEqual(['НОВАЯ БАШНЯ', 'КАЖДЫЙ ДЕНЬ!']);
    expect(fit?.lines.join(' ')).toBe('НОВАЯ БАШНЯ КАЖДЫЙ ДЕНЬ!');
    expect(fit!.size * mono('КАЖДЫЙ ДЕНЬ!')).toBeLessThanOrEqual(1000 + 1e-6);
  });

  it('takes the more even break when two give the same size', () => {
    expect(fitCaption('NEW TOWER DAILY!', mono, { ...LIMITS, maxSize: 60 })?.lines).toEqual([
      'NEW TOWER DAILY!',
    ]);
    const twoLines = fitCaption('NEW TOWER DAILY!', mono, {
      ...LIMITS,
      maxSize: 120,
      maxWidth: 800,
    });
    expect(twoLines?.lines).toEqual(['NEW TOWER', 'DAILY!']);
  });

  it('respects the height and gives null when even the smallest size does not fit', () => {
    const low = fitCaption('ONE TWO', mono, { ...LIMITS, maxWidth: 300, maxHeight: 90 });
    expect(low?.lines).toEqual(['ONE TWO']);
    expect(
      fitCaption('AVERYLONGWORDTHATCANNOTBREAK', mono, { ...LIMITS, maxWidth: 300 }),
    ).toBeNull();
  });
});

describe('fitCaption with a cost of the second line', () => {
  it('keeps one line unless two make the text larger by more than the cost', () => {
    const limits = { ...LIMITS, maxSize: 200, maxWidth: 600, moreLinesCost: 0.85 };
    // One line: 600 / (13 * 0.6) = 76.9; two lines ('TAP', 'TO STACK!'): 600 / 5.4 = 111 * 0.85 = 94.4.
    expect(fitCaption('TAP TO STACK!', mono, limits)?.lines).toEqual(['TAP', 'TO STACK!']);
    // 'ABCDEFG HIJKLMN': one line 600 / 9 = 66.7; two lines 600 / 4.2 = 142.9 * 0.85, but the height caps it.
    const capped = fitCaption('ABCDEFG HIJKLMN', mono, { ...limits, maxHeight: 150 });
    expect(capped?.lines).toEqual(['ABCDEFG HIJKLMN']);
  });
});

describe('glueShortWords', () => {
  it('joins a short word to the next one, so no line ends with it', () => {
    expect(glueShortWords(['СОБИРАЙ', 'И', 'ПРОКАЧИВАЙ!'], 2)).toEqual([
      'СОБИРАЙ',
      'И ПРОКАЧИВАЙ!',
    ]);
    expect(glueShortWords(['12', 'СПОСОБНОСТЕЙ!'], 2)).toEqual(['12 СПОСОБНОСТЕЙ!']);
    expect(glueShortWords(['COLLECT', '&', 'LEVEL', 'UP!'], 2)).toEqual(['COLLECT', '& LEVEL UP!']);
    expect(glueShortWords(['ОТ', 'КУХНИ', 'ДО', 'КОСМОСА!'], 2)).toEqual([
      'ОТ КУХНИ',
      'ДО КОСМОСА!',
    ]);
  });

  it('keeps a short last word with the word before it', () => {
    expect(glueShortWords(['GO', 'UP'], 2)).toEqual(['GO UP']);
  });
});

describe('fitCaption with short words', () => {
  it('never leaves a short word at the end of a line', () => {
    const fit = fitCaption('СОБИРАЙ И ПРОКАЧИВАЙ!', mono, { ...LIMITS, maxWidth: 800 });
    expect(fit?.lines).toEqual(['СОБИРАЙ', 'И ПРОКАЧИВАЙ!']);
  });
});

describe('wavePoints', () => {
  const spec = { width: 1000, top: 500, amplitude: 20, length: 400, phase: 0.25 };

  it('runs from side to side and stays within the amplitude', () => {
    const points = wavePoints(spec, 10);
    expect(points[0]?.x).toBe(0);
    expect(points.at(-1)?.x).toBe(1000);
    for (const p of points) expect(Math.abs(p.y - 500)).toBeLessThanOrEqual(20 + 1e-9);
  });

  it('puts a crest at the phase and repeats every wave length', () => {
    const points = wavePoints(spec, 100);
    expect(points.find((p) => p.x === 100)?.y).toBeCloseTo(480);
    expect(points.find((p) => p.x === 500)?.y).toBeCloseTo(480);
    expect(points.find((p) => p.x === 300)?.y).toBeCloseTo(520);
  });
});
