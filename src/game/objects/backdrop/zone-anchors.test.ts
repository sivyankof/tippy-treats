import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { Stub } = vi.hoisted(() => {
  /** A stand-in for every Phaser game object: it keeps what the lives set and takes any other call. */
  class StubObject {
    x = 0;
    y = 0;
    width = 64;
    height = 64;
    visible = true;
    alpha = 1;
    constructor() {
      return new Proxy(this, {
        get(target, key, receiver) {
          if (key in target || typeof key === 'symbol') return Reflect.get(target, key, receiver);
          return () => receiver;
        },
      });
    }
    setPosition(x: number, y: number): this {
      this.x = x;
      this.y = y;
      return this;
    }
    setVisible(visible: boolean): this {
      this.visible = visible;
      return this;
    }
    setAlpha(alpha: number): this {
      this.alpha = alpha;
      return this;
    }
  }
  return { Stub: StubObject };
});

vi.mock('phaser', () => ({
  GameObjects: { Image: Stub, TileSprite: Stub, Container: Stub, Events: { DESTROY: 'destroy' } },
  Scenes: { Events: {} },
  BlendModes: { ADD: 1, NORMAL: 0 },
}));

import type * as Phaser from 'phaser';

// The debug parameters read the page address; a test has no page.
vi.stubGlobal('window', { location: { search: '' } });
import { BACKDROP } from '../../../data/backdrop';
import { WEATHER_IDS, type WeatherId } from '../../../data/weather';
import type { ZoneId } from '../../../data/zones';
import { travellerClearBand } from '../../camera-layout';
import { cloudsArt } from './clouds-zone';
import { onLayer, type Anchor, type SkyKind } from './layer-anchor';
import { kitchenArt } from './kitchen-zone';
import { Mountains } from './mountains';
import { newFrameCtx, Traveler, Twinkles, Hover, type Life } from './life';
import { PlanetLife } from './planet-life';
import { roofArt } from './roof-zone';
import { shopArt } from './shop-zone';
import { showcaseArt } from './showcase-zone';
import { SpaceVisitor } from './space-visitor';
import { spaceArt } from './space-zone';
import { starsArt } from './stars-zone';
import { StreetWeather } from './street-weather';
import { WeatherBank, WeatherNight } from './weather-sky';
import { GlassWeatherLife } from './window-weather';
import type { ZoneArt } from './zone-scenery';

interface Case {
  name: string;
  zone: ZoneId;
  art: ZoneArt;
  place: 'kitchen' | 'shop';
}

const CASES: Case[] = [
  { name: 'kitchen', zone: 'kitchen', art: kitchenArt, place: 'kitchen' },
  { name: 'shop', zone: 'kitchen', art: shopArt, place: 'shop' },
  { name: 'showcase', zone: 'showcase', art: showcaseArt, place: 'kitchen' },
  { name: 'roof', zone: 'roof', art: roofArt, place: 'kitchen' },
  { name: 'clouds', zone: 'clouds', art: cloudsArt, place: 'kitchen' },
  { name: 'stars', zone: 'stars', art: starsArt, place: 'kitchen' },
  { name: 'space', zone: 'space', art: spaceArt, place: 'kitchen' },
];

/** Which life classes may stand in the sky for which reason, and in which zones. Nothing else may: a thing on a wall or a roof scrolls with its layer. */
const SKY_ALLOWED: Record<
  SkyKind,
  { classes: readonly unknown[]; zones: readonly ZoneId[] | 'any' }
> = {
  traveler: { classes: [Traveler], zones: 'any' },
  twinkles: { classes: [Twinkles], zones: ['stars'] },
  moon: { classes: [Hover], zones: ['stars'] },
  planet: { classes: [PlanetLife], zones: ['space'] },
  visitor: { classes: [SpaceVisitor], zones: ['space'] },
  mountains: { classes: [Mountains], zones: ['roof', 'clouds'] },
  weather: {
    classes: [WeatherBank, WeatherNight, GlassWeatherLife, StreetWeather],
    zones: 'any',
  },
};

interface Built {
  label: string;
  zone: ZoneId;
  life: Life;
}

function buildAll(): Built[] {
  const scene = {} as unknown as Phaser.Scene;
  const out: Built[] = [];
  for (const c of CASES) {
    for (const weather of WEATHER_IDS as readonly WeatherId[]) {
      const def = c.art.build(scene, { lap: 1, weather, place: c.place, planetSeed: 0 });
      const lives = [...def.lives.map((entry) => entry.life), ...(def.weatherSky ?? [])];
      for (const life of lives)
        out.push({ label: `${c.name}/${weather}/${life.constructor.name}`, zone: c.zone, life });
    }
  }
  return out;
}

describe('zone lives declare where they stand', () => {
  const random = vi.spyOn(Math, 'random');
  beforeAll(() => {
    random.mockReturnValue(0);
  });
  afterAll(() => random.mockRestore());

  const built = buildAll();

  it('builds lives in every zone', () => {
    expect(built.length).toBeGreaterThan(40);
  });

  it('only flying, far or night-sky things stand in the sky; nothing is fixed on the screen', () => {
    for (const { label, zone, life } of built) {
      const anchor: Anchor = life.anchor;
      expect(anchor, label).toBeDefined();
      expect(anchor.kind, label).not.toBe('fixed');
      if (anchor.kind !== 'sky') continue;
      const rule = SKY_ALLOWED[anchor.why];
      expect(
        rule.classes.some((c) => life instanceof (c as new () => object)),
        label,
      ).toBe(true);
      if (rule.zones !== 'any') expect(rule.zones, label).toContain(zone);
    }
  });

  it('a layer that carries something fixed to it sways; only walkers that cross the layer on their own may stand on a drifting one', () => {
    for (const { label, zone, life } of built) {
      const anchor = life.anchor;
      if (anchor.kind !== 'layer') continue;
      expect(anchor.layer, label).toBeGreaterThanOrEqual(0);
      expect(anchor.layer, label).toBeLessThan(4);
      if (life instanceof Traveler) continue;
      expect(BACKDROP.sway[zone][anchor.layer], label).not.toBeNull();
    }
  });

  it('a layer life moves exactly with its layer: down by its scroll, sideways against its sway, each layer on its own', () => {
    const height = 2340;
    const downOf = (layer: number): number => 11 + layer * 17;
    const swayOf = (layer: number): number => 2 + layer * 3;
    const groups = new Map<string, Built[]>();
    for (const item of built) {
      const key = item.label.split('/').slice(0, 2).join('/');
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    let compared = 0;
    for (const [key, lives] of groups) {
      // The lives of one build are updated together, in order: the glass of a window follows the window.
      const ctx = newFrameCtx(1080, height, travellerClearBand(height), 1234);
      for (const { life } of lives) life.update(ctx);
      type Snap = { x: number; y: number; shown: boolean };
      // What is hidden or fully transparent (a window off the screen) stands where it was last drawn.
      const snap = (life: Life): Snap[] =>
        (
          life.objects as unknown as { x: number; y: number; visible: boolean; alpha: number }[]
        ).map((image) => ({ x: image.x, y: image.y, shown: image.visible && image.alpha > 0 }));
      const before = lives.map(({ life }) => snap(life));
      for (let layer = 0; layer < 4; layer++) {
        ctx.layerDown[layer] = downOf(layer);
        ctx.layerSwayX[layer] = swayOf(layer);
      }
      for (const { life } of lives) life.update(ctx);
      let seen = 0;
      lives.forEach(({ label, life }, n) => {
        const anchor = life.anchor;
        if (anchor.kind !== 'layer') return;
        const after = snap(life);
        after.forEach((now, i) => {
          const was = before[n]?.[i];
          if (!was?.shown || !now.shown) return;
          seen++;
          expect(now.x - was.x, `${label} #${i} x`).toBeCloseTo(-swayOf(anchor.layer), 6);
          expect(now.y - was.y, `${label} #${i} y`).toBeCloseTo(downOf(anchor.layer), 6);
        });
      });
      if (lives.some(({ life }) => life.anchor.kind === 'layer'))
        expect(seen, key).toBeGreaterThan(0);
      compared += seen;
    }
    expect(compared).toBeGreaterThan(30);
  });

  it('nothing standing on a layer is drawn under a drifting layer of the kitchen and the shop, so no layer slides across it', () => {
    for (const c of CASES.filter((item) => item.zone === 'kitchen')) {
      for (const weather of WEATHER_IDS as readonly WeatherId[]) {
        const def = c.art.build({} as unknown as Phaser.Scene, {
          lap: 1,
          weather,
          place: c.place,
          planetSeed: 0,
        });
        for (const { slot, life } of def.lives) {
          if (life.anchor.kind !== 'layer' || life instanceof Traveler) continue;
          BACKDROP.sway[c.zone].forEach((sway, layer) => {
            if (layer > slot) expect(sway, `${c.name}/${weather} slot ${slot}`).not.toBeNull();
          });
        }
      }
    }
  });

  it('a layer life is hidden exactly when its picture has left the screen: the zone uses HALF the picture height', () => {
    const height = 2340;
    const ctx = newFrameCtx(1080, height, travellerClearBand(height), 0);
    // The stand-in image is 64 px tall, so its centre must stay 32 px above the top before it is gone.
    const at = (y: number): boolean => {
      const hover = new Hover(
        {} as unknown as Phaser.Scene,
        [{ texture: 't', at: { x: 0.5, y: 0 }, offset: { x: 0, y } }],
        onLayer(2),
      );
      hover.update(ctx);
      return (hover.objects[0] as unknown as { visible: boolean }).visible;
    };
    expect(at(-31)).toBe(true);
    expect(at(-33)).toBe(false);
    expect(at(height + 31)).toBe(true);
    expect(at(height + 33)).toBe(false);
  });
});
