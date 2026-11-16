import * as Phaser from 'phaser';
import { SHARED_ATLAS } from '../../data/shared-atlas';
import { ShelfPacker, type PackedBox } from '../../util/shelf-packer';
import { asWebGLRenderer } from '../webgl-renderer';
import { setSharedPictureStore } from './bake-texture';

/**
 * Small baked pictures share a few big textures ("pages"). Each picture stays a texture of its
 * own under its usual key, but that texture holds no image: its only frame is cut from a page,
 * so code that shows `scene.add.image(x, y, key)` does not change, while the renderer sees one
 * texture for a whole layer. Removing the texture frees its cell for the next picture.
 */

interface Page {
  key: string;
  canvas: HTMLCanvasElement;
  texture: Phaser.Textures.Texture;
  source: Phaser.Textures.TextureSource;
  packer: ShelfPacker;
}

const PAGE_PREFIX = 'shared_atlas_';
const pagesOf = new WeakMap<Phaser.Textures.TextureManager, Page[]>();

/** A texture whose one frame lives on an atlas page; destroying it frees the cell, not the page. */
class AtlasCellTexture extends Phaser.Textures.Texture {
  constructor(
    manager: Phaser.Textures.TextureManager,
    key: string,
    private readonly onRemove: () => void,
  ) {
    super(manager, key, [] as HTMLCanvasElement[]);
  }

  override destroy(): void {
    // The page source is shared: drop the reference so the base class does not destroy it.
    this.source = [];
    this.onRemove();
    super.destroy();
  }
}

/** Whether a picture baked under this key goes to the shared atlas. */
export function usesSharedAtlas(key: string, width: number, height: number): boolean {
  if (width > SHARED_ATLAS.maxSide || height > SHARED_ATLAS.maxSide) return false;
  if ((SHARED_ATLAS.ownTexture as readonly string[]).includes(key)) return false;
  return SHARED_ATLAS.keyPrefixes.some((prefix) => key.startsWith(prefix));
}

function openPage(manager: Phaser.Textures.TextureManager, pages: Page[]): Page {
  const canvas = document.createElement('canvas');
  canvas.width = SHARED_ATLAS.pageWidth;
  canvas.height = SHARED_ATLAS.pageHeight;
  const key = `${PAGE_PREFIX}${pages.length}`;
  const texture = manager.addCanvas(key, canvas);
  const source = texture?.source[0];
  if (!texture || !source) throw new Error(`Texture key ${key} is taken`);
  const page: Page = {
    key,
    canvas,
    texture,
    source,
    packer: new ShelfPacker(canvas.width, canvas.height, SHARED_ATLAS.shelfStep),
  };
  pages.push(page);
  return page;
}

/** The picture with its edge pixels repeated `e` pixels outwards on every side. */
function extruded(source: CanvasImageSource, w: number, h: number, e: number): HTMLCanvasElement {
  const cell = document.createElement('canvas');
  cell.width = w + e * 2;
  cell.height = h + e * 2;
  const ctx = cell.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, w, h, e, e, w, h);
  if (e > 0) {
    // Edges: the outer row / column stretched over the margin; corners: the corner pixel.
    ctx.drawImage(cell, e, e, w, 1, e, 0, w, e);
    ctx.drawImage(cell, e, e + h - 1, w, 1, e, e + h, w, e);
    ctx.drawImage(cell, e, 0, 1, h + e * 2, 0, 0, e, h + e * 2);
    ctx.drawImage(cell, e + w - 1, 0, 1, h + e * 2, e + w, 0, e, h + e * 2);
  }
  return cell;
}

/** Copies a finished cell to the page canvas and to the part of the GPU texture under it. */
function upload(
  renderer: Phaser.Game['renderer'],
  page: Page,
  cell: HTMLCanvasElement,
  box: PackedBox,
): void {
  const ctx = page.canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  // The page canvas keeps the pixels for a lost and restored WebGL context.
  ctx.clearRect(box.x, box.y, cell.width, cell.height);
  ctx.drawImage(cell, box.x, box.y);
  const source = page.source;
  const gl = source.glTexture;
  const webgl = asWebGLRenderer(renderer);
  if (!webgl || !gl) return;
  webgl.glTextureUnits.bind(gl, 0);
  webgl.glWrapper.updateTexturing({
    texturing: { flipY: source.flipY, premultiplyAlpha: gl.pma },
  });
  const y = source.flipY ? page.canvas.height - box.y - cell.height : box.y;
  const ctxGl = webgl.gl;
  ctxGl.texSubImage2D(ctxGl.TEXTURE_2D, 0, box.x, y, gl.format, ctxGl.UNSIGNED_BYTE, cell);
}

/**
 * Stores `source` (`width` x `height` pixels from its top-left corner) as the texture `key` on a
 * shared atlas page. Returns false when it does not fit a page; the caller then keeps a texture of its own.
 */
export function addSharedPicture(
  scene: Phaser.Scene,
  key: string,
  source: CanvasImageSource,
  width: number,
  height: number,
): boolean {
  const manager = scene.sys.textures;
  const e = SHARED_ATLAS.extrude;
  const cellW = width + e * 2;
  const cellH = height + e * 2;
  const pages = pagesOf.get(manager) ?? [];
  pagesOf.set(manager, pages);
  let page: Page | null = null;
  let box: PackedBox | null = null;
  for (const p of pages) {
    box = p.packer.alloc(cellW, cellH);
    if (box) {
      page = p;
      break;
    }
  }
  if (!page || !box) {
    page = openPage(manager, pages);
    box = page.packer.alloc(cellW, cellH);
    if (!box) return false;
  }
  const home = page;
  const at = box;
  upload(scene.sys.game.renderer, home, extruded(source, width, height, e), at);
  const texture = new AtlasCellTexture(manager, key, () => {
    home.packer.free(at, cellW);
    home.canvas.getContext('2d')?.clearRect(at.x, at.y, cellW, cellH);
  });
  texture.source.push(home.source);
  texture.add('__BASE', 0, at.x + e, at.y + e, width, height);
  (manager.list as Record<string, Phaser.Textures.Texture>)[key] = texture;
  manager.emit(Phaser.Textures.Events.ADD, key, texture);
  manager.emit(Phaser.Textures.Events.ADD_KEY + key, texture);
  return true;
}

/** Moves loaded pictures (e.g. the face SVGs) onto the shared atlas, keeping their keys. */
export function moveToSharedAtlas(scene: Phaser.Scene, keys: readonly string[]): void {
  const manager = scene.sys.textures;
  for (const key of keys) {
    if (!manager.exists(key)) continue;
    const source = manager.get(key).source[0];
    if (!source) continue;
    const { width, height } = source;
    if (!usesSharedAtlas(key, width, height)) continue;
    const image = source.image as CanvasImageSource;
    // The cell is drawn before the loaded texture goes, the key is then free for the atlas frame.
    const copy = extruded(image, width, height, 0);
    manager.remove(key);
    if (!addSharedPicture(scene, key, copy, width, height)) manager.addCanvas(key, copy);
  }
}

setSharedPictureStore(
  (scene, key, canvas) =>
    usesSharedAtlas(key, canvas.width, canvas.height) &&
    addSharedPicture(scene, key, canvas, canvas.width, canvas.height),
);
