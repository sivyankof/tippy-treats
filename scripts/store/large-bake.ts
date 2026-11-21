import * as Phaser from 'phaser';
import { canvas2d } from './canvas-draw';

/**
 * The game's own picture bakers, drawn larger, for the App Store pictures (compose page only).
 *
 * Every baker of the game draws with a hidden `Graphics` and hands it to `bakeTexture`
 * (`src/game/ui/common/bake-texture.ts`), which calls `generateTexture` and stores the canvas in
 * the scene's textures. Here a small Phaser game on a canvas gives the real `Graphics`, and the
 * baker gets a stand-in scene: its `Graphics` draws `scale` times larger (Phaser's canvas
 * renderer applies the object's scale), and the larger canvas is kept under the texture's key.
 * The pictures are the game's own, vector-drawn at the size they are shown, with no change to
 * the game's code.
 */

/** The part of a scene the bakers use. */
interface BakeScene {
  textures: {
    exists(key: string): boolean;
    addCanvas(key: string, canvas: HTMLCanvasElement): unknown;
  };
  add: { graphics(): Phaser.GameObjects.Graphics };
}

let booted: Promise<Phaser.Scene> | null = null;

/** A tiny canvas game whose only scene makes the `Graphics` objects. */
function bootScene(): Promise<Phaser.Scene> {
  booted ??= new Promise((resolve) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    new Phaser.Game({
      type: Phaser.CANVAS,
      width: 8,
      height: 8,
      parent,
      banner: false,
      audio: { noAudio: true },
      scene: {
        create(this: Phaser.Scene) {
          resolve(this);
        },
      },
    });
  });
  return booted;
}

/**
 * Runs `bake` (a baker of the game, given the stand-in scene) with every picture drawn `scale`
 * times larger; returns the canvases by texture key.
 */
export async function bakeLarge(
  scale: number,
  bake: (scene: Phaser.Scene) => void,
): Promise<Map<string, HTMLCanvasElement>> {
  const scene = await bootScene();
  const baked = new Map<string, HTMLCanvasElement>();
  const larger = new Map<HTMLCanvasElement, HTMLCanvasElement>();
  const stand: BakeScene = {
    textures: {
      exists: (key) => baked.has(key),
      addCanvas: (key, canvas) => {
        const big = larger.get(canvas);
        if (!big) throw new Error(`bakeLarge: ${key} was not drawn through generateTexture`);
        baked.set(key, big);
        return null;
      },
    },
    add: {
      graphics: () => {
        const g = scene.add.graphics();
        const draw = g.generateTexture.bind(g);
        g.generateTexture = (target, width, height) => {
          if (!(target instanceof HTMLCanvasElement)) throw new Error('bakeLarge: not a canvas');
          const big = document.createElement('canvas');
          big.width = Math.ceil((width ?? target.width) * scale);
          big.height = Math.ceil((height ?? target.height) * scale);
          g.setScale(scale);
          draw(big, big.width, big.height);
          larger.set(target, big);
          return g;
        };
        return g;
      },
    },
  };
  bake(stand as unknown as Phaser.Scene);
  return baked;
}

/** A picture of `canvas` in one colour where it is drawn (a white picture tinted, as the game tints it). */
export function tinted(canvas: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const ctx = canvas2d(canvas.width, canvas.height);
  const out = ctx.canvas;
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(canvas, 0, 0);
  return out;
}
