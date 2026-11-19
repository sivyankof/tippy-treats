import type * as Phaser from 'phaser';
import {
  PILE_LOOK,
  PILE_PIECES,
  type PileCurrency,
  type PilePieceKind,
  type PileSize,
} from '../../../data/economy/treasure-piles';
import { bakeTexture } from '../../ui/common/bake-texture';
import { idleBob } from '../common/idle-bob';
import {
  drawGlossMark,
  drawTwoToneBody,
  glossFromShares,
  outlineColor,
  roundShape,
  type BodyShape,
} from '../common/plain-style';
import { TREASURE_TEXTURES } from './treasure-textures';

const look = PILE_LOOK;

/** Texture key of a drawn piece of a pile. */
const pieceKey = (kind: PilePieceKind): string => {
  switch (kind) {
    case 'coin':
      return TREASURE_TEXTURES.coin;
    case 'berry':
      return TREASURE_TEXTURES.berry;
    case 'berryFace':
      return TREASURE_TEXTURES.berryFace;
    default:
      return `pile_${kind}`;
  }
};

/** A bowl: a flat top edge and a half ellipse below it. Bounds are cy +- ry. */
const bowlShape: BodyShape = (cx, cy, rx, ry) => {
  const steps = 18;
  const points = [{ x: cx - rx, y: cy - ry }];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (Math.PI * i) / steps;
    points.push({ x: cx + Math.cos(a) * rx, y: cy - ry + Math.sin(a) * ry * 2 });
  }
  return points;
};

function bakeStack(scene: Phaser.Scene, count: number): void {
  const s = look.stack;
  const step = s.coinHeight * s.step;
  const height = s.coinHeight + (count - 1) * step + s.outline * 2;
  bakeTexture(scene, pieceKey(`stack${count}`), s.width, height, (g) => {
    for (let i = 0; i < count; i++) {
      const cy = height - s.outline - s.coinHeight / 2 - i * step;
      drawTwoToneBody(
        g,
        roundShape(1),
        s.width / 2,
        cy,
        s.width / 2 - s.outline,
        s.coinHeight / 2 - s.outline * 0.3,
        { base: s.base, shadow: s.shadow, grow: s.outline, band: s.band },
      );
    }
    const topY = height - s.outline - s.coinHeight / 2 - (count - 1) * step;
    drawGlossMark(
      g,
      glossFromShares(look.gloss, s.width / 2, topY, s.width, s.gloss, 0.9, {
        x: s.width,
        y: s.coinHeight,
      }),
    );
  });
}

interface VesselLook {
  width: number;
  height: number;
  pad: number;
  outline: number;
  base: number;
  shadow: number;
  rim: number;
  rimShadow: number;
  rimHeightShare: number;
  rimOverhang: number;
  band: number;
  gloss: number;
}

/** A vessel (bowl or basket): the rim bar on top of a body, drawn in the manner. */
function drawVessel(
  g: Phaser.GameObjects.Graphics,
  v: VesselLook,
  shape: BodyShape,
  decorate?: (top: number, bottom: number) => void,
): void {
  const cx = v.width / 2;
  const grow = v.outline;
  const rimH = v.height * v.rimHeightShare;
  const rimCy = v.pad + grow + rimH / 2;
  const bottom = v.height - v.pad - grow;
  const bodyRx = (v.width / 2) * (1 - v.rimOverhang * 2) - grow - v.pad;
  const bodyCy = (rimCy + bottom) / 2;
  drawTwoToneBody(g, shape, cx, bodyCy, bodyRx, (bottom - rimCy) / 2, {
    base: v.base,
    shadow: v.shadow,
    grow,
    band: v.band,
  });
  decorate?.(rimCy, bottom);
  drawTwoToneBody(g, roundShape(1), cx, rimCy, v.width / 2 - v.pad - grow, rimH / 2, {
    base: v.rim,
    shadow: v.rimShadow,
    grow,
    band: v.band,
  });
  drawGlossMark(
    g,
    glossFromShares(look.gloss, cx, bottom - (bottom - rimCy) * 0.45, v.width, v.gloss, 0.9),
  );
}

function bakeBowl(scene: Phaser.Scene): void {
  const v = look.bowl;
  bakeTexture(scene, pieceKey('bowl'), v.width, v.height, (g) => drawVessel(g, v, bowlShape));
}

function bakeBasket(scene: Phaser.Scene): void {
  const v = look.basket;
  bakeTexture(scene, pieceKey('basket'), v.width, v.height, (g) =>
    drawVessel(g, v, roundShape(0.4), (top, bottom) => {
      const half = v.width / 2 - v.pad - v.outline * 2;
      const rowH = (bottom - top) / (v.weaveRows + 1);
      g.lineStyle(v.weaveThick, outlineColor(v.base), 0.55);
      for (let r = 1; r <= v.weaveRows; r++) {
        const y = top + rowH * r;
        g.lineBetween(v.width / 2 - half * 0.9, y, v.width / 2 + half * 0.9, y);
      }
      for (let r = 0; r <= v.weaveRows; r++) {
        const y = top + rowH * (r + 0.5);
        for (let c = 0; c < v.weaveColumns; c++) {
          const x = v.width / 2 + ((c + 0.5 * (r % 2)) / v.weaveColumns - 0.45) * half * 2;
          g.lineBetween(x, y - rowH * 0.3, x, y + rowH * 0.3);
        }
      }
    }),
  );
}

/** Bakes the drawn pieces of the piles (coin stacks, bowl, basket). Safe to call again. */
export function createPileTextures(scene: Phaser.Scene): void {
  for (const n of look.stackCounts) bakeStack(scene, n);
  bakeBowl(scene);
  bakeBasket(scene);
}

/**
 * A picture of a pile of coins or berries, `box` pixels across and centred on (0, 0). The pieces
 * are the berry and coin pictures of the game plus the drawn stacks, bowl and basket. `idle`
 * adds a slow bob (there is none in the reduced effects mode).
 */
export function createTreasurePile(
  scene: Phaser.Scene,
  currency: PileCurrency,
  size: PileSize,
  box: number,
  idle = true,
): Phaser.GameObjects.Container {
  const inner = scene.add.container(0, 0);
  for (const p of PILE_PIECES[currency][size]) {
    const image = scene.add.image(p.x * box, p.y * box, pieceKey(p.kind));
    image.setScale((p.w * box) / image.width).setAngle(p.tiltDeg ?? 0);
    inner.add(image);
  }
  const holder = scene.add.container(0, 0, [inner]).setSize(box, box);
  if (idle) idleBob(scene, inner, look.idle);
  return holder;
}
