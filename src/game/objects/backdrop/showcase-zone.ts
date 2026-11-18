import type * as Phaser from 'phaser';
import { BACKDROP, BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE, garlandWireY } from '../../../data/backdrop-life';
import { LOGICAL_SIZE } from '../../../data/screen';
import { bakePadded, bakeTexture } from '../../ui/bake-texture';
import { FIELD_PAD } from '../../../data/picture-fields';
import { glow, tiled } from './art-kit';
import { onLayer } from './layer-anchor';
import { Hover, Traveler, Twinkles } from './life';
import { bakeStopsSky, type ZoneArt } from './zone-scenery';
import {
  AWNING_WEATHER,
  STREET_LOOK,
  WINDOW_SKY,
  type StreetLook,
} from '../../../data/window-look';
import type { WeatherId } from '../../../data/weather';
import { BACKDROP_FAR } from '../../../data/backdrop-far';
import { channels, mixColor, shade } from '../../../util/color';
import { gradientColorAt } from './sky-gradient';
import { ZONE_SKY } from '../../../data/backdrop-colors';
import { bakeGlassItems, showcaseGlassLife } from './window-weather';
import { STREET_WEATHER } from '../../../data/street-weather';
import { bakeStreetWeather } from './weather-art';
import { StreetWeather } from './street-weather';

/** The street (layer 0) the passers-by walk on, and the layer of the shop front (treats) with the garland and the cake on its stand. */
const STREET_LAYER = 0;
const SHOW_LAYER = 2;

type Graphics = Phaser.GameObjects.Graphics;

const TILE = 512;
const S = BD_TEX.showcase;
const C = BACKDROP_COLORS.showcase;
/** Where on the wire texture the string hangs at its anchors. */
const WIRE_TOP = 6;
const WIRE_STEPS = 48;

/** Street and pane pictures are baked per weather (one weather per run), so a run never meets the pictures of another. */
interface StreetKeys {
  street: string;
  panes: string;
}

const streetKeys = (weather: WeatherId): StreetKeys => ({
  street: `${S.street}_${weather}`,
  panes: `${S.panes}_${weather}`,
});
/** The far plane is baked in the clear sky's tones; this tint takes it to the weather's (it can only darken). */
function farTint(weather: WeatherId): number | undefined {
  if (weather === 'clear') return undefined;
  const sky = WINDOW_SKY[weather];
  const mid = mixColor(sky.top, sky.bottom, BACKDROP_FAR.skyAt);
  const clear = gradientColorAt(ZONE_SKY.showcase, BACKDROP_FAR.skyAt);
  const [r, g, b] = channels(mid);
  const [cr, cg, cb] = channels(clear);
  const ratio = (a: number, c: number): number => Math.min(1, a / c);
  return (
    (Math.round(255 * ratio(r, cr)) << 16) |
    (Math.round(255 * ratio(g, cg)) << 8) |
    Math.round(255 * ratio(b, cb))
  );
}
/** The awning picture: its own (muted towards the sky) where `AWNING_WEATHER` has an entry, otherwise the usual one. */
const awningKey = (weather: WeatherId): string =>
  AWNING_WEATHER[weather] || weather === 'snow' ? `${S.awning}_${weather}` : S.awning;
/** An opaque awning layer where the weather asks for it (night), otherwise the zone's own alphas. */
function awningAlpha(weather: WeatherId): number[] | undefined {
  const alpha = AWNING_WEATHER[weather]?.alpha;
  if (alpha === undefined) return undefined;
  return BACKDROP.layerAlpha.showcase.map((own, i) => (i === 3 ? alpha : own));
}
const skyKey = (weather: WeatherId): string => `bd_sky_showcase_${weather}`;

/** In clear weather the street shows the zone's plain sky; every other weather gets its own picture. */
const ownSky = (weather: WeatherId): boolean => weather !== 'clear';

const BUILDINGS = [
  { x: 30, y: 60, w: 110, h: 200 },
  { x: 170, y: 200, w: 90, h: 250 },
  { x: 300, y: 20, w: 120, h: 160 },
  { x: 380, y: 300, w: 110, h: 190 },
  { x: 60, y: 330, w: 100, h: 150 },
  { x: 230, y: 440, w: 70, h: 60 },
];
const TREAT_X = [60, 150, 260, 350, 450];

/** A white cap of snow on the flat roof of a house at (`x`, `y`), `w` wide: a white heap with round drips over a cold shade that outlines it. */
function roofCap(g: Graphics, x: number, y: number, w: number): void {
  const c = STREET_WEATHER.cap;
  const left = x - c.overhang;
  const width = w + 2 * c.overhang;
  const top = y - c.height / 2;
  const heap = (color: number, grow: number, dy: number): void => {
    g.fillStyle(color, c.alpha);
    g.fillRoundedRect(
      left - grow,
      top - grow + dy,
      width + 2 * grow,
      c.height + 2 * grow,
      c.height / 2,
    );
    for (const u of c.drips)
      g.fillCircle(left + u * width, top + c.height + dy, c.dripRadius + grow);
  };
  heap(c.shade, 1.5, c.shadeHeight / 2);
  heap(c.snow, 0, 0);
}

/** A slanted band of light on the glass: top edge at (`x`, `y`) `width` wide, `height` tall, leaning by `lean`. */
function glint(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  lean: number,
): void {
  g.fillTriangle(x, y, x + width, y, x + lean, y + height);
  g.fillTriangle(x + width, y, x + lean + width, y + height, x + lean, y + height);
}

/** Snow on the top of the awning: the tile repeats, so a heap along the bottom of the tile lies on the awning of the tile below. */
function awningCap(g: Graphics): void {
  const c = STREET_WEATHER.cap;
  const top = TILE - c.awningHeight;
  const heap = (color: number, grow: number): void => {
    g.fillStyle(color, c.alpha);
    g.fillRect(0, top - grow, TILE, c.awningHeight + grow);
    for (const u of c.awningBumps) g.fillCircle(u * TILE, top - grow, c.awningBumpRadius + grow);
  };
  heap(c.shade, 2);
  heap(c.snow, 0);
}

function bakeLayers(
  scene: Phaser.Scene,
  street: StreetLook,
  keys: StreetKeys,
  weather: WeatherId,
): void {
  bakeTexture(scene, keys.street, TILE, TILE, (g) => {
    for (const b of BUILDINGS) {
      tiled(TILE, b.x, b.y, Math.max(b.w, b.h), (x, y) => {
        g.fillStyle(street.building, 0.7);
        g.fillRoundedRect(x, y, b.w, b.h, 12);
        g.fillStyle(street.buildingWindow, 0.8);
        for (let wy = y + 16; wy < y + b.h - 24; wy += 34) {
          for (let wx = x + 14; wx < x + b.w - 22; wx += 30) g.fillRoundedRect(wx, wy, 16, 20, 4);
        }
        // Snow lies on the roofs: baked into the street, it costs nothing in a frame.
        if (weather === 'snow') roofCap(g, x, y, b.w);
      });
    }
  });

  bakeTexture(scene, keys.panes, TILE, TILE, (g) => {
    g.fillStyle(street.frame, 0.9);
    g.fillRect(0, 0, TILE, 14);
    g.fillRect(0, 0, 14, TILE);
    g.fillRect(TILE / 2, 0, 14, TILE);
    g.fillStyle(C.glint, 0.22);
    glint(g, 100, 40, 50, 260, -80);
    glint(g, 340, 120, 30, 210, -60);
  });

  bakeTexture(scene, S.treats, TILE, TILE, (g) => {
    g.fillStyle(shade(C.shelf, -0.25), 1);
    g.fillRoundedRect(0, 386, TILE, 26, 10);
    g.fillStyle(C.shelf, 1);
    g.fillRoundedRect(0, 386, TILE, 18, 10);
    TREAT_X.forEach((x, i) => {
      const color = C.treat[i % C.treat.length] ?? C.glaze;
      g.fillStyle(shade(color, -0.25), 1);
      g.fillRoundedRect(x - 26, 352, 52, 34, 8);
      g.fillStyle(color, 1);
      g.fillCircle(x, 344, 30);
      g.fillStyle(BACKDROP_COLORS.shared.white, 0.45);
      g.fillCircle(x - 10, 334, 8);
    });
  });

  const mute = AWNING_WEATHER[weather];
  const toSky = (color: number): number =>
    mute ? mixColor(color, WINDOW_SKY[weather].top, mute.mute) : color;
  bakeTexture(scene, awningKey(weather), TILE, TILE, (g) => {
    const stripe = 64;
    for (let x = 0; x < TILE; x += stripe) {
      g.fillStyle(toSky((x / stripe) % 2 === 0 ? C.awningA : C.awningB), mute?.alpha ? 1 : 0.9);
      g.fillRect(x, 0, stripe, 64);
      g.fillCircle(x + stripe / 2, 64, stripe / 2);
    }
    if (weather === 'snow') awningCap(g);
  });
}

function bakeGarland(scene: Phaser.Scene): void {
  const width = LOGICAL_SIZE.width;
  bakeTexture(scene, S.wire, width, BACKDROP_LIFE.showcase.garland.wireHeight, (g) => {
    g.lineStyle(4, C.wire, 1);
    for (let i = 0; i < WIRE_STEPS; i++) {
      const x0 = i / WIRE_STEPS;
      const x1 = (i + 1) / WIRE_STEPS;
      g.lineBetween(
        x0 * width,
        WIRE_TOP + garlandWireY(x0),
        x1 * width,
        WIRE_TOP + garlandWireY(x1),
      );
    }
  });
  bakeTexture(scene, S.bulb, 30, 40, (g) => {
    glow(g, 15, 24, 15, BACKDROP_COLORS.shared.white, 0.6);
    g.fillStyle(C.wire, 1);
    g.fillRoundedRect(10, 0, 10, 10, 3);
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillEllipse(15, 24, 20, 26);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.6);
    g.fillEllipse(10, 18, 5, 8);
  });
}

function bakeWindowLife(scene: Phaser.Scene): void {
  bakeTexture(scene, S.walker, 70, 190, (g) => {
    g.fillStyle(C.walker, 1);
    g.fillCircle(35, 26, 20);
    g.fillRoundedRect(12, 50, 46, 92, 20);
    g.fillRoundedRect(18, 128, 14, 60, 6);
    g.fillRoundedRect(38, 128, 14, 60, 6);
  });
  bakePadded(scene, S.stand, 220, 50, FIELD_PAD.showcaseStand, (g) => {
    g.fillStyle(shade(C.standBase, -0.12), 1);
    g.fillEllipse(110, 44, 130, 14);
    g.fillRoundedRect(98, 12, 24, 32, 6);
    g.fillStyle(C.standBase, 1);
    g.fillEllipse(110, 22, 210, 28);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.4);
    g.fillEllipse(110, 18, 180, 12);
  });
  bakeTexture(scene, S.cake, 180, 130, (g) => {
    g.fillStyle(shade(C.cake, -0.2), 1);
    g.fillRoundedRect(8, 38, 164, 84, 26);
    g.fillStyle(C.cake, 1);
    g.fillRoundedRect(10, 38, 160, 78, 24);
    g.fillStyle(C.glaze, 1);
    g.fillRoundedRect(6, 26, 168, 44, 22);
    for (const x of [30, 78, 140]) g.fillRoundedRect(x, 56, 18, 34, 9);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.4);
    g.fillRoundedRect(20, 32, 60, 8, 4);
    g.fillStyle(C.cherry, 1);
    g.fillCircle(90, 20, 14);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.6);
    g.fillCircle(85, 15, 4);
  });
  bakeTexture(scene, S.sprinkle, 24, 10, (g) => {
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillRoundedRect(0, 0, 24, 10, 5);
  });
}

/** Shop window: street behind glass, a blinking garland, passers-by and a turning cake. */
export const showcaseArt: ZoneArt = {
  ownSky,
  bake(scene, look) {
    if (ownSky(look.weather)) {
      const sky = WINDOW_SKY[look.weather];
      bakeStopsSky(scene, skyKey(look.weather), [
        { at: 0, color: sky.top },
        { at: 1, color: sky.bottom },
      ]);
    }
    bakeGlassItems(scene, look.weather);
    bakeStreetWeather(scene, look.weather);
    bakeLayers(scene, STREET_LOOK[look.weather], streetKeys(look.weather), look.weather);
    bakeGarland(scene);
    bakeWindowLife(scene);
  },
  build(scene, look) {
    const life = BACKDROP_LIFE.showcase;
    const keys = streetKeys(look.weather);
    const glass = showcaseGlassLife(scene, look.weather);
    const street = StreetWeather.of(scene, look.weather);
    return {
      sky: ownSky(look.weather) ? skyKey(look.weather) : undefined,
      farTint: farTint(look.weather),
      layers: [keys.street, keys.panes, S.treats, awningKey(look.weather)],
      layerAlpha: awningAlpha(look.weather),
      lives: [
        ...life.walkers.map((spec) => ({
          slot: 0,
          life: new Traveler(scene, spec, onLayer(STREET_LAYER)),
        })),
        // The weather falls on the street, in front of the houses and the passers-by, behind the glass.
        ...(street ? [{ slot: STREET_LAYER, life: street }] : []),
        { slot: 2, life: new Hover(scene, [life.garland.wire], onLayer(SHOW_LAYER)) },
        { slot: 2, life: new Twinkles(scene, life.garland.bulbs, onLayer(SHOW_LAYER)) },
        {
          slot: 2,
          life: new Hover(
            scene,
            [life.cakeStand, life.cake, ...life.sprinkles],
            onLayer(SHOW_LAYER),
          ),
        },
        ...(glass ? [{ slot: 3, life: glass }] : []),
      ],
    };
  },
};
