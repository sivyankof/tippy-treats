import type * as Phaser from 'phaser';
import { BACKDROP, BD_TEX } from '../../src/data/backdrop/backdrop';
import { BACKDROP_COLORS, ZONE_SKY } from '../../src/data/backdrop/backdrop-colors';
import { BACKDROP_LIFE } from '../../src/data/backdrop/backdrop-life';
import { STORE_CREATIVE, type StoreCreative } from '../../src/data/debug/store-shots';
import {
  createTreasureTextures,
  TREASURE_TEXTURES,
} from '../../src/game/fx/economy/treasure-textures';
import { showcaseArt } from '../../src/game/objects/backdrop/zones/showcase-zone';
import { cssColor } from '../../src/util/color';
import { canvas2d, drawOverlays, load } from './canvas-draw';
import type { CreativeLayout, PlacedCreature } from './creative-layout';
import { bakeJar, jarKey } from './jar-art';
import { bakeLarge, tinted } from './large-bake';

/**
 * The background and the decor of an App Store picture (compose page): the street behind the
 * shop window, the panes, the shelves of treats, the awning and the garland of the game's
 * Showcase zone, the jars, the creatures, the coins, berries and sprinkles, all where
 * `creativeLayout` put them. The game's pictures are baked by the game's own code at the size
 * they are shown (`large-bake.ts`).
 */

const CR = STORE_CREATIVE;
const S = BD_TEX.showcase;
const [STREET_ALPHA, PANES_ALPHA, TREATS_ALPHA, AWNING_ALPHA] = BACKDROP.layerAlpha.showcase;
const TILE = 512;
/** A bulb's cap goes this share of its height above the wire it hangs on. */
const BULB_HANG = 0.06;
/** A pixel of the jar's edge counts as drawn above this alpha. */
const CLIP_ALPHA = 8;

export interface SceneArt {
  tiles: Map<string, HTMLCanvasElement>;
  coin: HTMLCanvasElement;
  berry: HTMLCanvasElement;
  sprinkles: HTMLCanvasElement[];
  bulbs: HTMLCanvasElement[];
  jars: HTMLCanvasElement[];
}

const arts = new Map<number, Promise<SceneArt>>();

function need(map: Map<string, HTMLCanvasElement>, key: string): HTMLCanvasElement {
  const canvas = map.get(key);
  if (!canvas) throw new Error(`scene art: ${key} was not baked`);
  return canvas;
}

/** The game's pictures of the Showcase (clear weather), the coin, the berry and the jars, `scale` times larger. */
function sceneArt(scale: number): Promise<SceneArt> {
  let art = arts.get(scale);
  if (art) return art;
  art = (async () => {
    const look = { lap: 1, weather: 'clear', place: 'kitchen', planetSeed: 1 } as const;
    const tiles = await bakeLarge(scale, (scene) => showcaseArt.bake(scene, look as never));
    const treasure = await bakeLarge(scale, (scene: Phaser.Scene) => {
      // The coin and the berries come first; the cloud figure after them needs a whole scene of
      // the game and is not used here, so its failure ends the bake once those two are baked.
      try {
        createTreasureTextures(scene);
      } catch (error) {
        const done = [TREASURE_TEXTURES.coin, TREASURE_TEXTURES.berryFace];
        if (!done.every((key) => scene.textures.exists(key))) throw error;
      }
    });
    const jars = await bakeLarge(scale, (scene) => {
      CR.jars.lids.forEach((_, i) => bakeJar(scene, i));
    });
    CR.jars.lids.forEach((_, i) => clipCheck(jarKey(i), need(jars, jarKey(i))));
    const sprinkle = need(tiles, S.sprinkle);
    const bulb = need(tiles, S.bulb);
    return {
      tiles,
      coin: need(treasure, TREASURE_TEXTURES.coin),
      berry: need(treasure, TREASURE_TEXTURES.berryFace),
      sprinkles: BACKDROP_COLORS.showcase.sprinkles.map((c) => tinted(sprinkle, cssColor(c))),
      bulbs: BACKDROP_LIFE.showcase.garland.bulbs.tints.map((c) => tinted(bulb, cssColor(c))),
      jars: CR.jars.lids.map((_, i) => need(jars, jarKey(i))),
    };
  })();
  arts.set(scale, art);
  // A failed bake is not kept: the next picture tries again and shows its own error.
  art.catch(() => arts.delete(scale));
  return art;
}

/**
 * The jar is a new picture of these store pictures only (the game has none): like the clip guard
 * of the game's pictures, its outermost rows and columns must stay empty, or the drawing is cut off.
 */
function clipCheck(key: string, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const { width, height } = canvas;
  const edges = [
    ctx.getImageData(0, 0, width, 1),
    ctx.getImageData(0, height - 1, width, 1),
    ctx.getImageData(0, 0, 1, height),
    ctx.getImageData(width - 1, 0, 1, height),
  ];
  for (const edge of edges) {
    for (let i = 3; i < edge.data.length; i += 4) {
      if ((edge.data[i] ?? 0) > CLIP_ALPHA)
        throw new Error(`${key}: the picture is cut off at its edge`);
    }
  }
}

/** A layer `width` x `height` of `tile` repeated every 512 game px, moved by `offset` of a tile. */
function tiledLayer(
  tile: HTMLCanvasElement,
  scale: number,
  width: number,
  height: number,
  offset: { x: number; y: number },
): HTMLCanvasElement {
  const step = TILE * scale;
  const ctx = canvas2d(width, height);
  const layer = ctx.canvas;
  const ox = -offset.x * step;
  const oy = -offset.y * step;
  for (let y = oy; y < height; y += step) {
    for (let x = ox; x < width; x += step) ctx.drawImage(tile, x, y);
  }
  return layer;
}

/** Rows `rows` (game px of a tile) of `tile`, repeated across the picture with their top at `top`. */
function band(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  scale: number,
  rows: readonly [number, number],
  top: number,
  alpha: number,
): void {
  const step = TILE * scale;
  const sy = rows[0] * scale;
  const sh = (rows[1] - rows[0]) * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let x = 0; x < ctx.canvas.width; x += step) {
    ctx.drawImage(tile, 0, sy, tile.width, sh, x, top, tile.width, sh);
  }
  ctx.restore();
}

/**
 * A tiled layer over the whole picture, out of focus by `blur` px. The blur thins a picture out at
 * its edges, so the layer is made larger than the picture by three times the blur on every side.
 */
function softLayer(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  scale: number,
  offset: { x: number; y: number },
  alpha: number,
  blur: number,
): void {
  const margin = Math.ceil(blur * 3);
  const { width, height } = ctx.canvas;
  const layer = tiledLayer(tile, scale, width + 2 * margin, height + 2 * margin, offset);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0) ctx.filter = `blur(${String(blur)}px)`;
  ctx.drawImage(layer, -margin, -margin);
  ctx.restore();
}

/** The y of the wire in its picture at column `x` (the first opaque pixel from the top). */
function wireRow(wire: HTMLCanvasElement, x: number): number {
  const ctx = wire.getContext('2d');
  if (!ctx) return 0;
  const column = ctx.getImageData(
    Math.min(wire.width - 1, Math.max(0, Math.round(x))),
    0,
    1,
    wire.height,
  ).data;
  for (let y = 0; y < wire.height; y++) if ((column[y * 4 + 3] ?? 0) > 128) return y;
  return 0;
}

/** The background: sky, the street behind the glass, the panes, the shelves, the awning, the garland, the jars. */
function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  c: StoreCreative,
  layout: CreativeLayout,
  art: SceneArt,
): void {
  const { width, height } = c;
  const k = layout.backdrop.scale;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  for (const stop of ZONE_SKY.showcase) sky.addColorStop(stop.at, cssColor(stop.color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const bd = CR.backdrop;
  const street = need(art.tiles, `${S.street}_clear`);
  softLayer(ctx, street, k, bd.streetOffset, STREET_ALPHA, CR.blur.street * width);
  const panes = need(art.tiles, `${S.panes}_clear`);
  softLayer(ctx, panes, k, bd.panesOffset, PANES_ALPHA, CR.blur.panes * width);
  const treats = need(art.tiles, S.treats);
  // Back shelves first, the lowest (nearest) last.
  for (const shelf of [...layout.backdrop.shelves].reverse()) {
    band(ctx, treats, k, bd.treatsRows, shelf.top, TREATS_ALPHA);
  }
  for (const jar of layout.jars) {
    const picture = art.jars[jar.jar % art.jars.length];
    if (picture) ctx.drawImage(picture, jar.rect.x, jar.rect.y, jar.rect.width, jar.rect.height);
  }
  // The wire spans the game's screen; it is drawn across the picture at an even scale (its sag and
  // thickness grow with it), and the bulbs hang on it where the game hangs them.
  const wire = need(art.tiles, S.wire);
  const top = layout.backdrop.garlandTop;
  const stretch = width / wire.width;
  ctx.drawImage(wire, 0, top, width, wire.height * stretch);
  BACKDROP_LIFE.showcase.garland.bulbs.points.forEach((p, i) => {
    const bulb = art.bulbs[i % art.bulbs.length];
    if (!bulb) return;
    const y = top + wireRow(wire, p.x * wire.width) * stretch - BULB_HANG * bulb.height;
    ctx.drawImage(bulb, p.x * width - bulb.width / 2, y);
  });
  // The awning goes over the garland, so where the garland rises behind it, its ends tuck under.
  band(ctx, need(art.tiles, S.awning), k, bd.awningRows, 0, AWNING_ALPHA);
}

/** One creature picture, turned about its centre, with the poster's shadow or out of focus. */
async function drawCreature(
  ctx: CanvasRenderingContext2D,
  placed: PlacedCreature,
  image: string,
  shadowUnit: number,
): Promise<void> {
  const r = placed.rect;
  if (placed.blur > 0) {
    const picture = await load(image);
    ctx.save();
    ctx.filter = `blur(${String(placed.blur)}px)`;
    ctx.translate(r.x + r.width / 2, r.y + r.height / 2);
    ctx.rotate((placed.angle * Math.PI) / 180);
    ctx.drawImage(picture, -r.width / 2, -r.height / 2, r.width, r.height);
    ctx.restore();
    return;
  }
  await drawOverlays(
    ctx,
    [{ image, x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, angle: placed.angle }],
    shadowUnit,
  );
}

/** Coins, berries and sprinkles. */
function drawScatter(ctx: CanvasRenderingContext2D, layout: CreativeLayout, art: SceneArt): void {
  for (const item of layout.scatter) {
    const picture =
      item.kind === 'coin'
        ? art.coin
        : item.kind === 'berry'
          ? art.berry
          : art.sprinkles[item.tone % art.sprinkles.length];
    if (!picture) continue;
    const r = item.rect;
    ctx.save();
    ctx.translate(r.x + r.width / 2, r.y + r.height / 2);
    ctx.rotate((item.angle * Math.PI) / 180);
    ctx.drawImage(picture, -r.width / 2, -r.height / 2, r.width, r.height);
    ctx.restore();
  }
}

/**
 * The whole picture but the poster's text: the background, the side towers, the poster's tower
 * and the hero, the flyer, the scatter and the near pictures. `creatures` are the game's pictures
 * of `creativeCreatures`, in its order; `drawText` puts the text on between the hero and the flyer.
 */
export async function drawScene(
  ctx: CanvasRenderingContext2D,
  c: StoreCreative,
  layout: CreativeLayout,
  pictures: { creatures: readonly string[]; hero: string; shadowUnit: number },
  drawText: () => void,
): Promise<void> {
  const art = await sceneArt(layout.backdrop.scale);
  drawBackdrop(ctx, c, layout, art);
  const draw = async (role: PlacedCreature['role']) => {
    for (const placed of layout.creatures.filter((p) => p.role === role)) {
      await drawCreature(ctx, placed, pictures.creatures[placed.art] ?? '', pictures.shadowUnit);
    }
  };
  await draw('stack');
  await draw('poster');
  const h = layout.poster.hero;
  await drawOverlays(
    ctx,
    [
      {
        image: pictures.hero,
        x: h.x + h.width / 2,
        y: h.y + h.height / 2,
        width: h.width,
        angle: 0,
      },
    ],
    pictures.shadowUnit,
  );
  drawText();
  await draw('flyer');
  drawScatter(ctx, layout, art);
  await draw('near');
}
