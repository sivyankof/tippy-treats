import { describe, expect, it } from 'vitest';
import {
  STORE_CAPTION,
  STORE_CREATIVE,
  STORE_CREATIVES,
  STORE_LANGS,
  STORE_VARIANTS,
  variantMakes,
} from '../../src/data/debug/store-shots';
import {
  SHARP_WIDTH,
  creativeBox,
  creativeCreatures,
  creativeLayout,
  creativeText,
  intersects,
  turnedBounds,
} from './creative-layout';
import { textRoomC } from './creative-c';
import { containsRect, posterInk, type Rect } from './layout';

// The hero render is 1254 x 1254. The game's creature pictures are about 0.62 times as tall as
// wide; flatter and taller ones are tried too (the compose page checks the real ones again).
const HERO = { width: 1254, height: 1254 };
const ASPECTS = [0.55, 0.62, 0.7];
/** Glyphs as wide as a slanted outlined Nunito Black. */
const measure = (line: string) => line.length * 0.8;

function layouts() {
  const out = [];
  for (const c of STORE_CREATIVES) {
    for (const variant of STORE_VARIANTS.filter((v) => variantMakes(v, c.id))) {
      for (const lang of STORE_LANGS) {
        for (const aspect of ASPECTS) {
          const plan = creativeCreatures(c, variant);
          const sizes = plan.map((p) => ({ width: p.width, height: p.width * aspect }));
          const box = creativeBox(c, variant);
          const text = creativeText(c, variant, lang, measure, HERO);
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

/** The hero as the text and the decor must keep off it: its drawn part where it is known. */
const heroOf = (x: (typeof ALL)[number]) => x.layout.poster.heroInk ?? x.layout.poster.hero;

describe('App Store pictures, every variant', () => {
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
      const { title, subtitle } = x.layout.poster;
      const hero = heroOf(x);
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
        for (const key of [heroOf(x), poster.title, poster.subtitle]) {
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

  it('give variants B and C a tower that goes on below the safe area to the bottom edge', () => {
    for (const x of ALL.filter((y) => y.variant !== 'a')) {
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

/** The same picture, language and creature shape in variant B. */
const inB = (x: (typeof ALL)[number]) => {
  const b = ALL.find(
    (y) => y.variant === 'b' && y.c.id === x.c.id && y.lang === x.lang && y.aspect === x.aspect,
  );
  if (!b) throw new Error(`no variant B for ${name(x)}`);
  return b;
};
const C_ALL = ALL.filter((x) => x.variant === 'c');

describe('App Store pictures, variant C', () => {
  it('is made for the header and the search picture only', () => {
    expect(STORE_CREATIVES.filter((c) => variantMakes('c', c.id)).map((c) => c.id)).toEqual([
      'header',
      'search',
    ]);
    expect(C_ALL.length).toBeGreaterThan(0);
  });

  it('fills the safe area from top to bottom with the hero and its shadow', () => {
    for (const x of C_ALL) {
      const ink = posterInk(
        { ...x.layout.poster, title: heroOf(x), subtitle: heroOf(x) },
        { ...x.text, title: { lines: [], size: 0 }, subtitle: { lines: [], size: 0 } },
        x.box.width,
        0,
        false,
      );
      expect(ink.height / x.c.safe.height, name(x)).toBeGreaterThan(0.97);
      expect(containsRect(x.c.safe, ink), name(x)).toBe(true);
    }
  });

  it('fills the room right of the hero with the text, to its width or to its height', () => {
    for (const x of C_ALL) {
      const room = textRoomC(x.c, HERO);
      const { title, subtitle } = x.text;
      const widest = Math.max(
        ...[...title.lines.map((l) => measure(l) * title.size)],
        ...subtitle.lines.map((l) => measure(l) * subtitle.size),
      );
      const ink = posterInk(
        x.layout.poster,
        x.text,
        x.box.width,
        STORE_CAPTION.outlineWidth,
        false,
      );
      const text = {
        top: x.layout.poster.title.y - STORE_CAPTION.outlineWidth * title.size,
        bottom: ink.y + ink.height,
      };
      const byWidth = widest / room.width;
      const byHeight = (text.bottom - text.top) / room.height;
      expect(Math.max(byWidth, byHeight), name(x)).toBeGreaterThan(0.97);
    }
  });

  it('draws the hero and the title much larger than variant B', () => {
    for (const x of C_ALL) {
      const b = inB(x);
      const heroB = b.layout.poster.hero.height * (STORE_CREATIVE.c.hero.ink.height / HERO.height);
      expect(heroOf(x).height / heroB, name(x)).toBeGreaterThan(1.5);
      expect(x.text.title.size / b.text.title.size, name(x)).toBeGreaterThan(1.25);
    }
  });

  it('draws the side creatures 1.5 to 2 times as wide as B, out of focus', () => {
    for (const x of C_ALL) {
      const sides = (y: (typeof ALL)[number]) =>
        y.layout.creatures.filter((p) => p.role === 'stack');
      const [c, b] = [sides(x), sides(inB(x))];
      expect(c.length, name(x)).toBe(b.length);
      c.forEach((p, i) => {
        const grow = p.rect.width / b[i]!.rect.width;
        expect(grow, name(x)).toBeGreaterThanOrEqual(1.5);
        expect(grow, name(x)).toBeLessThanOrEqual(2);
        expect(p.blur, name(x)).toBeGreaterThan(0);
      });
    }
  });

  it('keeps only a few large coins and berries, no sprinkles', () => {
    for (const x of C_ALL) {
      const few = STORE_CREATIVE.c.scatter.count;
      expect(
        x.layout.scatter.filter((s) => s.kind === 'sprinkle'),
        name(x),
      ).toEqual([]);
      expect(x.layout.scatter.length, name(x)).toBeLessThanOrEqual(few.coin + few.berry);
    }
  });

  it('has no flying layer and no near pictures in the corners', () => {
    for (const x of C_ALL) {
      const roles = x.layout.creatures.map((p) => p.role);
      expect(roles, name(x)).not.toContain('flyer');
      expect(roles, name(x)).not.toContain('near');
    }
  });
});
