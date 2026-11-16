import type * as Phaser from 'phaser';
import { BACKDROP, BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';
import { glow, scatterPoints, sparkle, tiled } from './art-kit';
import { ditherNoise } from './sky-gradient';
import { Traveler } from './life';
import { SpaceVisitor } from './space-visitor';
import { bakeSpaceVisitors } from './space-visitor-art';
import { bakePlanet } from './dessert-planets';
import { PlanetLife } from './planet-life';
import { planetOfLap } from '../../../core/space-planet';
import type { ZoneArt } from './zone-scenery';

const TILE = 512;
const P = BD_TEX.space;
const C = BACKDROP_COLORS.space;
const WHITE = BACKDROP_COLORS.shared.white;

/** A smooth white blob: a radial gradient with light alpha noise, so no rings of stacked discs show. */
function smoothBlob(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function bakeNebula(scene: Phaser.Scene, key: string, count: number, radius: number): void {
  // White blobs: the layer is tinted, and the tint slowly shifts (docs/06, section 5).
  const { blobAlpha, alphaNoise } = BACKDROP.nebula;
  bakeTexture(
    scene,
    key,
    TILE,
    TILE,
    () => undefined,
    (context) => {
      for (const { x, y } of scatterPoints(count, TILE)) {
        const r = radius * (0.7 + Math.random() * 0.5);
        tiled(TILE, x, y, r, (px, py) => smoothBlob(context, px, py, r, blobAlpha));
      }
      // Noise on the alpha breaks up the 8-bit steps of the soft edge.
      const image = context.getImageData(0, 0, TILE, TILE);
      for (let i = 3; i < image.data.length; i += 4) {
        const a = image.data[i] ?? 0;
        const pixel = i >> 2;
        if (a > 0)
          image.data[i] = a + ditherNoise(pixel % TILE, Math.floor(pixel / TILE)) * alphaNoise;
      }
      context.putImageData(image, 0, 0);
    },
  );
}

function bakeLayers(scene: Phaser.Scene): void {
  bakeTexture(scene, P.dust, TILE, TILE, (g) => {
    scatterPoints(110, TILE).forEach(({ x, y }, i) => {
      const r = 1 + Math.random() * 1.2;
      g.fillStyle(i % 3 === 0 ? C.dust : C.star, 0.6);
      tiled(TILE, x, y, r, (px, py) => g.fillCircle(px, py, r));
    });
  });
  bakeNebula(scene, P.nebula, 5, 170);
  bakeNebula(scene, P.nebulaTwo, 4, 200);
  bakeTexture(scene, P.sparkles, TILE, TILE, (g) => {
    scatterPoints(10, TILE).forEach(({ x, y }, i) => {
      const r = 8 + (i % 3) * 5;
      tiled(TILE, x, y, r, (px, py) => sparkle(g, px, py, r, C.star, 0.9));
    });
    g.fillStyle(C.rock, 0.8);
    for (const { x, y } of scatterPoints(14, TILE)) {
      const r = 3 + Math.random() * 3;
      tiled(TILE, x, y, r, (px, py) => g.fillCircle(px, py, r));
    }
  });
}

function bakeTravelers(scene: Phaser.Scene): void {
  bakeTexture(scene, P.satellite, 140, 70, (g) => {
    g.lineStyle(3, C.satellite, 1);
    g.lineBetween(70, 20, 70, 4);
    g.fillStyle(C.light, 1);
    g.fillCircle(70, 5, 4);
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(4, 24, 44, 26, 4);
    g.fillRoundedRect(92, 24, 44, 26, 4);
    g.fillStyle(WHITE, 0.35);
    for (const x of [18, 33, 106, 121]) g.fillRect(x, 24, 2, 26);
    g.fillStyle(C.satellite, 1);
    g.fillRoundedRect(50, 20, 40, 34, 8);
    g.fillRect(46, 35, 8, 4);
    g.fillRect(86, 35, 8, 4);
    g.fillStyle(C.panel, 0.7);
    g.fillCircle(70, 37, 8);
  });
  bakeTexture(scene, P.comet, 240, 44, (g) => {
    g.fillStyle(C.cometTail, 0.2);
    for (const [length, half] of [
      [216, 9],
      [160, 12],
      [110, 15],
      [60, 17],
    ] as const) {
      g.fillTriangle(216 - length, 22, 216, 22 - half, 216, 22 + half);
    }
    glow(g, 216, 22, 22, C.cometHead, 0.8);
    g.fillStyle(C.cometHead, 1);
    g.fillCircle(216, 22, 12);
  });
}

/** Space: dust, two nebulae that slowly change colour, the dessert planet of the lap, a satellite and a comet. */
export const spaceArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakeTravelers(scene);
    bakeSpaceVisitors(scene);
  },
  bakeLap(scene, lap) {
    bakePlanet(scene, planetOfLap(lap));
  },
  build(scene, lap = 1) {
    const life = BACKDROP_LIFE.space;
    const planet = new PlanetLife(scene, lap);
    const satellite = new Traveler(scene, life.satellite);
    const comet = new Traveler(scene, life.comet);
    return {
      lapLife: planet,
      layers: [P.dust, P.nebula, P.nebulaTwo, P.sparkles],
      lives: [
        { slot: 2, life: planet },
        { slot: 2, life: satellite },
        { slot: 3, life: comet },
        { slot: 3, life: new SpaceVisitor(scene, [satellite, comet]) },
      ],
    };
  },
};
