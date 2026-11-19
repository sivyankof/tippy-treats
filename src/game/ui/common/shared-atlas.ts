import * as Phaser from 'phaser';
import { SHARED_ATLAS } from '../../../data/common/shared-atlas';
import { bigPageFails } from '../../../util/gl-page-error';
import { ShelfPacker, type PackedBox } from '../../../util/shelf-packer';
import { devWarn } from '../../common/dev-warn';
import { asWebGLRenderer } from '../../app/webgl-renderer';
import { createCpuCanvas } from './cpu-canvas';
import { setSharedPicturePixels, setSharedPictureStore } from './bake-texture';

/**
 * Small baked pictures share a few big textures ("pages"). Each picture stays a texture of its
 * own under its usual key, but that texture holds no image: its only frame is cut from a page,
 * so code that shows `scene.add.image(x, y, key)` does not change, while the renderer sees one
 * texture for a whole layer. Removing the texture frees its cell for the next picture.
 *
 * The pixels of a page live only on the GPU. Its canvas stays blank and is never drawn into:
 * writing to a 4096 px wide canvas in the browser costs a long frame some time later. Every cell keeps
 * its picture instead, to read its pixels and to upload it again after a lost WebGL context.
 */

interface Cell {
  box: PackedBox;
  picture: CanvasImageSource;
  width: number;
  height: number;
  /** The page the cell is on (it moves when the pages are rebuilt smaller). */
  page: Page;
  /** The texture whose frame is cut from the cell. */
  texture: Phaser.Textures.Texture | null;
}

interface Page {
  key: string;
  source: Phaser.Textures.TextureSource;
  packer: ShelfPacker;
  /** The live cells by texture key. */
  cells: Map<string, Cell>;
}

const PAGE_PREFIX = 'shared_atlas_';
const pagesOf = new WeakMap<Phaser.Textures.TextureManager, Page[]>();
/** The texture managers whose context the atlas listens to. */
const watched = new WeakSet<Phaser.Textures.TextureManager>();
/** Numbers the page keys: a rebuilt page never takes the key of the one it replaces. */
let pageSerial = 0;

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

/** Height of the pages of this game; set by the first page (the fallback after a failed full page). */
let pageHeight: number | null = null;
/** When the big page was made (`performance.now()`); null when there is none. */
let bigPageMadeAt: number | null = null;

/** The full page height when the GPU can make a texture that tall, else the fallback. */
function firstPageHeight(renderer: Phaser.Game['renderer']): number {
  const webgl = asWebGLRenderer(renderer);
  const max = webgl ? webgl.getMaxTextureSize() : Infinity;
  return max >= SHARED_ATLAS.pageHeight && max >= SHARED_ATLAS.pageWidth
    ? SHARED_ATLAS.pageHeight
    : SHARED_ATLAS.fallbackPageHeight;
}

/** Reads and clears the pending WebGL errors (bounded: a lost context keeps answering CONTEXT_LOST_WEBGL). */
function drainGlErrors(gl: WebGLRenderingContext | null): number[] {
  const errors: number[] = [];
  if (!gl) return errors;
  for (let i = 0; i < 8; i++) {
    const error = gl.getError();
    if (error === gl.NO_ERROR) break;
    errors.push(error);
  }
  return errors;
}

/** Listens to the context of the game once: the cells go back on restore, a loss may shrink the pages. */
function watchContext(scene: Phaser.Scene, pages: Page[]): void {
  const renderer = scene.sys.game.renderer;
  const manager = scene.sys.textures;
  // A context lost just after the big page counts against it. The pages are rebuilt smaller while
  // the context is down, so the restore makes the small textures and never the big one again.
  renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => {
    const since = bigPageMadeAt === null ? null : performance.now() - bigPageMadeAt;
    const event = { kind: 'context_lost', msSinceBigPage: since } as const;
    if (!bigPageFails(event, SHARED_ATLAS.bigPageStrikeMs)) return;
    devWarn('WebGL context lost just after the big atlas page: the pages go to the fallback size');
    pageHeight = SHARED_ATLAS.fallbackPageHeight;
    bigPageMadeAt = null;
    rebuildPages(manager, pages);
  });
  // A restored context gets the blank pages back from their canvases; the cells go on top.
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
    for (const page of pages) {
      for (const cell of page.cells.values()) uploadCell(renderer, page, cell);
    }
  });
}

function openPage(scene: Phaser.Scene, pages: Page[]): Page {
  const renderer = scene.sys.game.renderer;
  const manager = scene.sys.textures;
  if (!watched.has(manager)) {
    watched.add(manager);
    watchContext(scene, pages);
  }
  const height = (pageHeight ??= firstPageHeight(renderer));
  if (height > SHARED_ATLAS.fallbackPageHeight) {
    const gl = asWebGLRenderer(renderer)?.gl ?? null;
    // Errors left by other code are not the page's: take them out first (and show them in dev).
    const earlier = drainGlErrors(gl);
    if (earlier.length > 0) devWarn(`GL errors before the first atlas page: ${earlier.join(', ')}`);
    let page: Page | null = null;
    try {
      page = makePage(manager, pages, height);
      const errors = drainGlErrors(gl);
      const event = { kind: 'made', errors, contextLost: gl?.isContextLost() ?? false } as const;
      if (!bigPageFails(event, SHARED_ATLAS.bigPageStrikeMs)) {
        bigPageMadeAt = performance.now();
        return page;
      }
      devWarn(`The big atlas page failed (GL errors: ${errors.join(', ') || 'context lost'})`);
    } catch {
      // Same: the smaller page below.
    }
    // The GPU did not take the page: it goes, and every page of this game is the smaller one.
    if (page) {
      pages.splice(pages.indexOf(page), 1);
      manager.remove(page.key);
    }
    pageHeight = SHARED_ATLAS.fallbackPageHeight;
  }
  return makePage(manager, pages, pageHeight);
}

function makePage(manager: Phaser.Textures.TextureManager, pages: Page[], height: number): Page {
  const canvas = document.createElement('canvas');
  canvas.width = SHARED_ATLAS.pageWidth;
  canvas.height = height;
  const key = `${PAGE_PREFIX}${pageSerial++}`;
  const texture = manager.addCanvas(key, canvas);
  const source = texture?.source[0];
  if (!texture || !source) throw new Error(`Texture key ${key} is taken`);
  const page: Page = {
    key,
    source,
    packer: new ShelfPacker(canvas.width, canvas.height, SHARED_ATLAS.shelfStep),
    cells: new Map(),
  };
  pages.push(page);
  return page;
}

/** A free spot for a `w` x `h` cell on one of the pages, or null when none has room. */
function findSpot(
  pages: readonly Page[],
  w: number,
  h: number,
): { page: Page; box: PackedBox } | null {
  for (const page of pages) {
    const box = page.packer.alloc(w, h);
    if (box) return { page, box };
  }
  return null;
}

/**
 * Moves every cell to new pages of the current `pageHeight` and drops the old pages. Run while the
 * context is lost: the cells' pixels go up again on restore. The frames keep their objects, so
 * the pictures on screen follow their cells.
 */
function rebuildPages(manager: Phaser.Textures.TextureManager, pages: Page[]): void {
  const height = pageHeight ?? SHARED_ATLAS.fallbackPageHeight;
  if (pages.every((page) => page.source.height <= height)) return;
  const old = pages.splice(0);
  const e = SHARED_ATLAS.extrude;
  for (const from of old) {
    for (const [key, cell] of from.cells) {
      const w = cell.width + e * 2;
      const h = cell.height + e * 2;
      const spot = findSpot(pages, w, h) ?? findSpot([makePage(manager, pages, height)], w, h);
      const texture = cell.texture;
      if (!spot || !texture) {
        devWarn(`Atlas picture ${key} did not fit the smaller pages`);
        continue;
      }
      cell.page = spot.page;
      cell.box = spot.box;
      spot.page.cells.set(key, cell);
      texture.source[0] = spot.page.source;
      const frame = texture.get('__BASE');
      frame.source = spot.page.source;
      frame.setSize(cell.width, cell.height, spot.box.x + e, spot.box.y + e);
    }
    from.cells.clear();
    manager.remove(from.key);
  }
}

// One canvas for every extruded cell: a new canvas per picture costs more than resizing this one.
let scratch: HTMLCanvasElement | null = null;

/** The picture with its edge pixels repeated `e` pixels outwards on every side, on a shared canvas. */
function extruded(source: CanvasImageSource, w: number, h: number, e: number): HTMLCanvasElement {
  const cell = (scratch ??= document.createElement('canvas'));
  const ctx = cell.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  if (cell.width === w + e * 2 && cell.height === h + e * 2) {
    ctx.clearRect(0, 0, cell.width, cell.height);
  } else {
    cell.width = w + e * 2;
    cell.height = h + e * 2;
  }
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

/** Copies a cell's extruded picture to the part of the page's GPU texture under it. */
function uploadCell(renderer: Phaser.Game['renderer'], page: Page, cell: Cell): void {
  const source = page.source;
  const gl = source.glTexture;
  const webgl = asWebGLRenderer(renderer);
  if (!webgl || !gl) return;
  const image = extruded(cell.picture, cell.width, cell.height, SHARED_ATLAS.extrude);
  webgl.glTextureUnits.bind(gl, 0);
  webgl.glWrapper.updateTexturing({
    texturing: { flipY: source.flipY, premultiplyAlpha: gl.pma },
  });
  const { x, y: top } = cell.box;
  const y = source.flipY ? source.height - top - image.height : top;
  const ctxGl = webgl.gl;
  ctxGl.texSubImage2D(ctxGl.TEXTURE_2D, 0, x, y, gl.format, ctxGl.UNSIGNED_BYTE, image);
}

/**
 * Stores `source` (`width` x `height` pixels from its top-left corner) as the texture `key` on a
 * shared atlas page. The atlas keeps `source` while the texture lives, so it must not be drawn
 * into afterwards. Returns false when it does not fit a page; the caller then keeps a texture of its own.
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
  const spot = findSpot(pages, cellW, cellH) ?? findSpot([openPage(scene, pages)], cellW, cellH);
  if (!spot) return false;
  notePeak(pages);
  const { box } = spot;
  const cell: Cell = { box, picture: source, width, height, page: spot.page, texture: null };
  uploadCell(scene.sys.game.renderer, cell.page, cell);
  cell.page.cells.set(key, cell);
  const texture = new AtlasCellTexture(manager, key, () => {
    // The cell is not cleared: the next picture in it overwrites the whole cell.
    cell.page.packer.free(cell.box, cellW);
    cell.page.cells.delete(key);
  });
  cell.texture = texture;
  texture.source.push(cell.page.source);
  texture.add('__BASE', 0, box.x + e, box.y + e, width, height);
  (manager.list as Record<string, Phaser.Textures.Texture>)[key] = texture;
  manager.emit(Phaser.Textures.Events.ADD, key, texture);
  manager.emit(Phaser.Textures.Events.ADD_KEY + key, texture);
  return true;
}

/** The most pages and the most shelf height one page has had since the page was loaded (the benchmark reads it). */
const peak = { pages: 0, usedHeight: 0, pageHeight: 0 };

function notePeak(pages: readonly Page[]): void {
  peak.pages = Math.max(peak.pages, pages.length);
  for (const page of pages) {
    peak.pageHeight = page.packer.height;
    peak.usedHeight = Math.max(peak.usedHeight, page.packer.usedHeight);
  }
}

/** The peak of the atlas: pages opened and the share of the page height the shelves reached. */
export function atlasPeak(): { pages: number; usedShare: number } {
  return {
    pages: peak.pages,
    usedShare: peak.pageHeight > 0 ? peak.usedHeight / peak.pageHeight : 0,
  };
}

/** How many pages the shared atlas has now (the debug pages report it; the aim is one). */
export function atlasPageCount(textures: Phaser.Textures.TextureManager): number {
  return (pagesOf.get(textures) ?? []).length;
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
    // The copy is drawn before the loaded texture goes, the key is then free for the atlas frame.
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    copy.getContext('2d')?.drawImage(source.image as CanvasImageSource, 0, 0);
    manager.remove(key);
    if (!addSharedPicture(scene, key, copy, width, height)) manager.addCanvas(key, copy);
  }
}

/** The colour (0xRRGGBB) of a pixel of an atlas picture, read from the picture the cell keeps; null for other keys. */
function sharedPicturePixel(
  textures: Phaser.Textures.TextureManager,
  x: number,
  y: number,
  key: string,
): number | null {
  for (const page of pagesOf.get(textures) ?? []) {
    const cell = page.cells.get(key);
    if (!cell) continue;
    if (x < 0 || y < 0 || x >= cell.width || y >= cell.height) return 0;
    const ctx = pixelContext();
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(cell.picture, x, y, 1, 1, 0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
    return Phaser.Display.Color.GetColor(r, g, b);
  }
  return null;
}

let pixelCtx: CanvasRenderingContext2D | null = null;

function pixelContext(): CanvasRenderingContext2D {
  if (pixelCtx) return pixelCtx;
  const ctx = createCpuCanvas(1, 1).context;
  if (!ctx) throw new Error('No 2d context');
  return (pixelCtx = ctx);
}

setSharedPictureStore(
  (scene, key, canvas) =>
    usesSharedAtlas(key, canvas.width, canvas.height) &&
    addSharedPicture(scene, key, canvas, canvas.width, canvas.height),
);
setSharedPicturePixels(sharedPicturePixel);
