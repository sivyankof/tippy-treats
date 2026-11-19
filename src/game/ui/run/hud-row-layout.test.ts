import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { getLang, setLang, tn, type Lang } from '../../../i18n';
import {
  badgeRowRight,
  captionSpot,
  isCompactNext,
  nextChipClearsRow,
  nextChipSpan,
  nextLabelPopScale,
  type CaptionSpot,
} from './hud-row-layout';

const WIDTH = LOGICAL_SIZE.width;
const { nextFont, badgeMargin, nextBadgeGap, badgeSize } = HUD_LAYOUT;
/** A generous width of a text of `chars` characters in the next-creature font. */
const textWidth = (chars: number): number => chars * nextFont * 0.65;
const MOST_BADGES = 6;

describe('badge row', () => {
  it('is empty at 0 and grows by one badge and gap', () => {
    expect(badgeRowRight(0)).toBe(0);
    expect(badgeRowRight(2) - badgeRowRight(1)).toBe(HUD_LAYOUT.badgeSize + HUD_LAYOUT.badgeGap);
  });

  it('turns the next-creature chip compact from three badges', () => {
    expect([0, 1, 2, 3, 4].map(isCompactNext)).toEqual([false, false, false, true, true]);
  });
});

describe('next-creature chip', () => {
  it('never touches the badges: words with 0-2 badges, icon and number from 3', () => {
    for (let count = 0; count <= MOST_BADGES; count++) {
      // "через 5 слоёв" is the widest words (13 letters); the compact text is two digits.
      const label = textWidth(isCompactNext(count) ? 2 : 13);
      const span = nextChipSpan(WIDTH, label);
      expect(nextChipClearsRow(span.chipLeft, count), `${count} badges`).toBe(true);
    }
  });

  it('is not clear with the long words and four badges (why it goes compact)', () => {
    expect(nextChipClearsRow(nextChipSpan(WIDTH, textWidth(13)).chipLeft, 4)).toBe(false);
  });
});

describe('captionSpot', () => {
  const out: CaptionSpot = { centreX: 0, scale: 1 };

  it('sits at the right margin at full size when the badges leave room', () => {
    captionSpot(400, 2, WIDTH, out);
    expect(out.scale).toBe(1);
    expect(out.centreX + 200).toBe(WIDTH - badgeMargin);
  });

  it('shrinks to stay clear of the badges, never over them', () => {
    for (let count = 0; count <= MOST_BADGES; count++) {
      captionSpot(500, count, WIDTH, out);
      const left = out.centreX - (500 * out.scale) / 2;
      expect(left, `${count} badges`).toBeGreaterThanOrEqual(
        badgeRowRight(count) + nextBadgeGap - 1e-9,
      );
    }
  });
});

describe('icon-only next-creature chip', () => {
  it('hugs the icon with no gap for text', () => {
    const span = nextChipSpan(WIDTH, null);
    expect(span.chipRight - span.chipLeft).toBeLessThan(
      nextChipSpan(WIDTH, textWidth(1)).chipRight - nextChipSpan(WIDTH, textWidth(1)).chipLeft,
    );
    expect(span.iconX - badgeSize / 2 - span.chipLeft).toBeCloseTo(HUD_LAYOUT.nextChip.padX);
    expect(span.chipRight - (span.iconX + badgeSize / 2)).toBeCloseTo(HUD_LAYOUT.nextChip.padX);
  });
});

describe('next-creature text at the peak of its pop', () => {
  let savedLang: Lang;
  beforeEach(() => {
    savedLang = getLang();
  });
  afterEach(() => {
    setLang(savedLang);
  });

  /** The font size the widths below were measured at: a change of `nextFont` needs a new measure. */
  const MEASURED_FONT = 56;
  /**
   * The text and its width as Phaser measured it in the browser (Nunito Black 56 px with the stroke
   * padding), `ru` and `en`, for a count of 1, 2, 5, 8, 10, 17 and 20. A changed wording fails the
   * test: measure the new text again.
   */
  const MEASURED: Record<Lang, Record<number, { text: string; width: number }>> = {
    ru: {
      1: { text: 'через 1 слой', width: 379 },
      2: { text: 'через 2 слоя', width: 377 },
      5: { text: 'через 5 слоёв', width: 409 },
      8: { text: 'через 8 слоёв', width: 409 },
      10: { text: 'через 10 слоёв', width: 443 },
      17: { text: 'через 17 слоёв', width: 443 },
      20: { text: 'через 20 слоёв', width: 443 },
    },
    en: {
      1: { text: 'in 1 layer', width: 268 },
      2: { text: 'in 2 layers', width: 295 },
      5: { text: 'in 5 layers', width: 295 },
      8: { text: 'in 8 layers', width: 295 },
      10: { text: 'in 10 layers', width: 329 },
      17: { text: 'in 17 layers', width: 329 },
      20: { text: 'in 20 layers', width: 329 },
    },
  };

  it('uses the font the widths were measured at', () => {
    expect(nextFont).toBe(MEASURED_FONT);
  });

  for (const lang of ['ru', 'en'] as Lang[]) {
    for (const n of [1, 2, 5, 8, 10, 17, 20]) {
      it(`stays right of the icon and keeps the chip padding at the right: ${lang}, ${n}`, () => {
        setLang(lang);
        const text = tn('run.nextCreatureIn', n);
        const measured = MEASURED[lang][n]!;
        expect(text).toBe(measured.text);
        // The measured width and a width a fifth bigger than the widest measure per character.
        for (const width of [measured.width, textWidth(text.length)]) {
          const span = nextChipSpan(WIDTH, width);
          const peakRight = span.labelLeft + width * nextLabelPopScale(width);
          expect(span.labelLeft).toBeGreaterThanOrEqual(
            span.iconX + badgeSize / 2 + HUD_LAYOUT.badgeGap,
          );
          expect(peakRight).toBeLessThanOrEqual(span.chipRight - HUD_LAYOUT.nextChip.padX + 1e-9);
          expect(peakRight).toBeLessThanOrEqual(WIDTH - badgeMargin);
        }
      });
    }
  }
});
