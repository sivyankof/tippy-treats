import { describe, expect, it } from 'vitest';
import {
  STORE_CAPTION,
  STORE_CREATIVES,
  STORE_FEATURE,
  STORE_LANGS,
  type StoreCreativeId,
} from '../../src/data/debug/store-shots';
import {
  backgroundBand,
  containsRect,
  creativePosterBox,
  fitAspect,
  fitCaption,
  glueShortWords,
  insetRect,
  posterInk,
  posterLayout,
  posterText,
  wavePoints,
  type CaptionLimits,
  type Rect,
} from './layout';

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

describe('fitAspect, insetRect, containsRect', () => {
  const box: Rect = { x: 100, y: 50, width: 400, height: 100 };

  it('takes the largest rectangle of the proportions, centred', () => {
    expect(fitAspect(2, box)).toEqual({ x: 200, y: 50, width: 200, height: 100 });
    expect(fitAspect(8, box)).toEqual({ x: 100, y: 75, width: 400, height: 50 });
  });

  it('insets by a share of the smaller side and tells what lies inside', () => {
    expect(insetRect(box, 0.1)).toEqual({ x: 110, y: 60, width: 380, height: 80 });
    expect(containsRect(box, insetRect(box, 0.1))).toBe(true);
    expect(containsRect(box, { ...box, x: 99 })).toBe(false);
    expect(containsRect(box, { ...box, height: 101 })).toBe(false);
  });
});

describe('backgroundBand', () => {
  const frame = { width: 1080, height: 1920 };

  it('takes the whole width, centred and kept inside the frame', () => {
    expect(backgroundBand(frame, 2, 0.25)).toEqual({ x: 0, y: 210, width: 1080, height: 540 });
    expect(backgroundBand(frame, 2, 0)).toEqual({ x: 0, y: 0, width: 1080, height: 540 });
  });

  it('stays above the floor, narrowing when the band is taller than the room', () => {
    const band = backgroundBand(frame, 1.5, 0.25, 0.35);
    expect(band.y + band.height).toBeLessThanOrEqual(1920 * 0.35 + 1e-9);
    expect(band.width / band.height).toBeCloseTo(1.5);
    expect(band.x).toBeCloseTo((1080 - band.width) / 2);
  });
});

/** Apple's sizes (Creative assets specifications, checked 2026-11-21). */
const APPLE: Record<StoreCreativeId, { width: number; height: number; aspect: number }> = {
  header: { width: 3840, height: 1646, aspect: 21 / 9 },
  search: { width: 3840, height: 2560, aspect: 3 / 2 },
  universal: { width: 5244, height: 2950, aspect: 16 / 9 },
};

describe('App Store creative assets', () => {
  it('have the sizes of the spec and a safe area inside the picture', () => {
    expect(STORE_CREATIVES.map((c) => c.id).sort()).toEqual(['header', 'search', 'universal']);
    for (const c of STORE_CREATIVES) {
      const apple = APPLE[c.id];
      expect([c.width, c.height]).toEqual([apple.width, apple.height]);
      expect(c.width / c.height).toBeCloseTo(apple.aspect, 2);
      expect(containsRect({ x: 0, y: 0, width: c.width, height: c.height }, c.safe)).toBe(true);
    }
  });

  // The hero render is 1254 x 1254. The creature pictures the game draws are 0.62 times as tall
  // as wide (Rainbow 0.616, Puff 0.625, measured 2026-11-21); a margin either way is tried, and
  // the compose page checks the real ones again.
  const hero = { width: 1254, height: 1254 };
  const towers = [0.55, 0.62, 0.68].map((h) => [
    { width: 100, height: 100 * h },
    { width: 100, height: 100 * h },
  ]);
  // Glyphs as wide as a slanted outlined Nunito Black and a narrower font: the text fits either way.
  const measures = [(line: string) => line.length * 0.8, (line: string) => line.length * 0.55];

  for (const c of STORE_CREATIVES) {
    it(`${c.id}: the tower, the hero and the text lie in the art safe area`, () => {
      const box = creativePosterBox(c);
      expect(containsRect(c.safe, box)).toBe(true);
      expect(box.width / box.height).toBeCloseTo(STORE_FEATURE.width / STORE_FEATURE.height);
      for (const lang of STORE_LANGS) {
        for (const measure of measures) {
          const text = posterText(lang, box, measure);
          for (const tower of towers) {
            const layout = posterLayout(box, STORE_FEATURE, { tower, hero }, text);
            for (const part of [...layout.tower, layout.hero, layout.title, layout.subtitle]) {
              expect(containsRect(c.safe, part)).toBe(true);
            }
            const ink = posterInk(layout, text, box.width, STORE_CAPTION.outlineWidth);
            expect(containsRect(c.safe, ink)).toBe(true);
          }
        }
      }
    });
  }

  it('keeps the hero no larger than its render (no magnified, soft hero)', () => {
    for (const c of STORE_CREATIVES) {
      expect(STORE_FEATURE.hero.height * creativePosterBox(c).height).toBeLessThanOrEqual(
        hero.height,
      );
    }
  });
});
