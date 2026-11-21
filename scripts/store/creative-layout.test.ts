import { describe, expect, it } from 'vitest';
import {
  STORE_CAPTION,
  STORE_CREATIVES,
  STORE_LANGS,
  STORE_VARIANTS,
} from '../../src/data/debug/store-shots';
import {
  SHARP_WIDTH,
  creativeCreatures,
  creativeLayout,
  intersects,
  posterTextBox,
  turnedBounds,
} from './creative-layout';
import { containsRect, posterInk, posterText, type Rect } from './layout';

// The hero render is 1254 x 1254. The game's creature pictures are about 0.62 times as tall as
// wide; flatter and taller ones are tried too (the compose page checks the real ones again).
const HERO = { width: 1254, height: 1254 };
const ASPECTS = [0.55, 0.62, 0.7];
/** Glyphs as wide as a slanted outlined Nunito Black. */
const measure = (line: string) => line.length * 0.8;

function layouts() {
  const out = [];
  for (const c of STORE_CREATIVES) {
    for (const variant of STORE_VARIANTS) {
      for (const lang of STORE_LANGS) {
        for (const aspect of ASPECTS) {
          const plan = creativeCreatures(c, variant);
          const sizes = plan.map((p) => ({ width: p.width, height: p.width * aspect }));
          const { box, spec } = posterTextBox(c, variant);
          const text = posterText(lang, box, measure, spec);
          const layout = creativeLayout(c, variant, sizes, HERO, text);
          out.push({ c, variant, lang, aspect, plan, box, text, layout });
        }
      }
    }
  }
  return out;
}

const ALL = layouts();
const name = (x: (typeof ALL)[number]) =>
  `${x.c.id} ${x.variant} ${x.lang} (creatures ${String(x.aspect)})`;

describe('App Store pictures, both variants', () => {
  it('keep the hero and the text, with their shadow and outline, inside the art safe area', () => {
    for (const x of ALL) {
      const ink = posterInk(
        x.layout.poster,
        x.text,
        x.box.width,
        STORE_CAPTION.outlineWidth,
        false,
      );
      expect(containsRect(x.c.safe, ink), name(x)).toBe(true);
    }
  });

  it('keep the text off the hero', () => {
    for (const x of ALL) {
      const { hero, title, subtitle } = x.layout.poster;
      expect(intersects(hero, title), name(x)).toBe(false);
      expect(intersects(hero, subtitle), name(x)).toBe(false);
    }
  });

  it('keep the whole poster of variant A inside the safe area', () => {
    for (const x of ALL.filter((y) => y.variant === 'a')) {
      const ink = posterInk(x.layout.poster, x.text, x.box.width, STORE_CAPTION.outlineWidth);
      expect(containsRect(x.c.safe, ink), name(x)).toBe(true);
    }
  });

  it('put no decor in the safe area, nor over the hero or the text', () => {
    for (const x of ALL) {
      const { poster } = x.layout;
      const decor: Rect[] = [
        ...x.layout.creatures
          .filter((p) => p.role !== 'poster')
          .map((p) => turnedBounds(p.rect, p.angle)),
        ...x.layout.jars.map((j) => j.rect),
        ...x.layout.scatter.map((s) => turnedBounds(s.rect, s.angle)),
      ];
      for (const r of decor) {
        expect(intersects(r, x.c.safe), name(x)).toBe(false);
        for (const key of [poster.hero, poster.title, poster.subtitle]) {
          expect(intersects(r, key), name(x)).toBe(false);
        }
      }
    }
  });

  it('draw every sharp creature no wider than the game picture stands', () => {
    for (const x of ALL) {
      for (const p of x.layout.creatures.filter((q) => q.blur === 0)) {
        expect(p.rect.width, name(x)).toBeLessThanOrEqual(SHARP_WIDTH + 1);
      }
      for (const p of x.layout.creatures.filter((q) => q.rect.width > SHARP_WIDTH + 1)) {
        expect(p.blur, name(x)).toBeGreaterThan(0);
      }
    }
  });

  it('give variant B a tower that goes on below the safe area to the bottom edge', () => {
    for (const x of ALL.filter((y) => y.variant === 'b')) {
      const tower = x.layout.poster.tower;
      const lowest = Math.max(...tower.map((r) => r.y + r.height));
      expect(lowest, name(x)).toBeGreaterThanOrEqual(x.c.height);
      expect(tower.length, name(x)).toBeGreaterThan(2);
    }
  });

  it('keep the jars apart and clear of the side towers', () => {
    for (const x of ALL) {
      const towers = x.layout.creatures.filter((p) => p.role === 'stack');
      const jars = x.layout.jars;
      for (const [i, j] of jars.entries()) {
        for (const t of towers) {
          expect(intersects(j.rect, turnedBounds(t.rect, t.angle)), name(x)).toBe(false);
        }
        for (const other of jars.slice(i + 1)) {
          expect(intersects(j.rect, other.rect), name(x)).toBe(false);
        }
      }
    }
  });

  it('scatter the same coins, berries and sprinkles every run', () => {
    const [a, b] = [layouts(), layouts()];
    expect(a.map((x) => x.layout.scatter)).toEqual(b.map((x) => x.layout.scatter));
    expect(a.every((x) => x.layout.scatter.some((s) => s.kind === 'coin'))).toBe(true);
  });
});
