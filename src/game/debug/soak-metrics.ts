import type * as Phaser from 'phaser';
import { SOAK } from '../../data/soak';
import { uiRegionCount } from '../ui/ui-regions';

/** Counts of live things of one scene. */
export interface SceneSoak {
  key: string;
  status: number;
  /** Display objects of the display list, containers and layers included recursively. */
  objects: number;
  /** Objects Phaser updates every frame (`UpdateList`). */
  updating: number;
  /** Objects that take pointer input. */
  interactive: number;
  tweens: number;
  timers: number;
  /** Listeners on the scene's own emitters (events, input, cameras, loader, data). */
  listeners: number;
}

/** One reading of the whole game. The heap is added by the harness after a forced collection. */
export interface SoakSample {
  scenes: SceneSoak[];
  objects: number;
  updating: number;
  interactive: number;
  tweens: number;
  timers: number;
  /** Listeners on every emitter of the game and its scenes. */
  listeners: number;
  /** Listeners by emitter, only those with some. */
  listenersBy: Record<string, number>;
  textures: number;
  /** Texture keys grouped by name with digits folded: `{ 'fx_#': 12 }`. */
  textureGroups: Record<string, number>;
  sounds: number;
  /** WebGL objects the renderer keeps (textures, framebuffers, buffers); zeros on the canvas renderer. */
  gl: { textures: number; framebuffers: number; buffers: number };
  /** `<canvas>` elements in the page (the game's own and every 2D canvas a texture or a picture made). */
  canvases: number;
  /** Interface regions registered in `ui-regions` (a module-level set). */
  uiRegions: number;
}

interface EmitterLike {
  eventNames(): Array<string | symbol>;
  listenerCount(name: string | symbol): number;
}

function isEmitter(value: unknown): value is EmitterLike {
  const v = value as Partial<EmitterLike> | null;
  return !!v && typeof v.eventNames === 'function' && typeof v.listenerCount === 'function';
}

function listenersOf(emitter: unknown): number {
  if (!isEmitter(emitter)) return 0;
  return emitter.eventNames().reduce((sum, name) => sum + emitter.listenerCount(name), 0);
}

/** An array field of a Phaser internal that has no public getter; empty when it is not there. */
function hidden(target: unknown, name: string): unknown[] {
  const value = (target as Record<string, unknown> | null)?.[name];
  return Array.isArray(value) ? value : [];
}

/** Counts a display list recursively through the objects that hold others (containers, layers). */
export function countDisplayObjects(list: readonly unknown[]): number {
  let total = 0;
  for (const object of list) {
    total += 1;
    const inner = (object as { list?: unknown }).list;
    if (Array.isArray(inner)) total += countDisplayObjects(inner);
  }
  return total;
}

function sceneListeners(scene: Phaser.Scene): { total: number; by: Record<string, number> } {
  const by: Record<string, number> = {};
  const key = scene.sys.settings.key;
  const add = (label: string, emitter: unknown): void => {
    const n = listenersOf(emitter);
    if (n > 0) by[`${key}.${label}`] = n;
  };
  add('events', scene.sys.events);
  add('input', scene.input);
  add('keyboard', scene.input?.keyboard);
  add('load', scene.load);
  scene.cameras?.cameras.forEach((camera, i) => add(`camera${i}`, camera));
  return { total: Object.values(by).reduce((sum, n) => sum + n, 0), by };
}

function readScene(scene: Phaser.Scene): SceneSoak {
  const { sys } = scene;
  const clock: unknown = scene.time;
  return {
    key: sys.settings.key,
    status: sys.settings.status,
    objects: countDisplayObjects(scene.children?.list ?? []),
    updating: hidden(sys.updateList, '_active').length + hidden(sys.updateList, '_pending').length,
    interactive: hidden(scene.input, '_list').length,
    tweens: scene.tweens?.getTweens().length ?? 0,
    timers: hidden(clock, '_active').length + hidden(clock, '_pendingInsertion').length,
    listeners: sceneListeners(scene).total,
  };
}

function textureGroups(keys: string[]): Record<string, number> {
  const groups = new Map<string, number>();
  for (const key of keys) {
    const folded = key.replace(/\d+/g, SOAK.textureDigitMark);
    groups.set(folded, (groups.get(folded) ?? 0) + 1);
  }
  const biggest = [...groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SOAK.textureGroupLimit);
  return Object.fromEntries(biggest);
}

/** Reads every count the soak run watches. Cheap enough to call once a minute, not every frame. */
export function readSoakSample(game: Phaser.Game): SoakSample {
  const scenes = game.scene.scenes.map(readScene);
  const listenersBy: Record<string, number> = {};
  const addGlobal = (label: string, emitter: unknown): void => {
    const n = listenersOf(emitter);
    if (n > 0) listenersBy[label] = n;
  };
  addGlobal('game.events', game.events);
  addGlobal('game.scale', game.scale);
  addGlobal('game.registry', game.registry.events);
  addGlobal('game.textures', game.textures);
  addGlobal('game.anims', game.anims);
  addGlobal('game.input', game.input.events);
  addGlobal('game.sound', game.sound);
  for (const scene of game.scene.scenes) Object.assign(listenersBy, sceneListeners(scene).by);
  const textureKeys = game.textures.getTextureKeys();
  const sum = (pick: (s: SceneSoak) => number): number =>
    scenes.reduce((total, scene) => total + pick(scene), 0);
  return {
    scenes,
    objects: sum((s) => s.objects),
    updating: sum((s) => s.updating),
    interactive: sum((s) => s.interactive),
    tweens: sum((s) => s.tweens),
    timers: sum((s) => s.timers),
    listeners: Object.values(listenersBy).reduce((total, n) => total + n, 0),
    listenersBy,
    textures: textureKeys.length,
    textureGroups: textureGroups(textureKeys),
    sounds: hidden(game.sound, 'sounds').length,
    gl: {
      textures: hidden(game.renderer, 'glTextureWrappers').length,
      framebuffers: hidden(game.renderer, 'glFramebufferWrappers').length,
      buffers: hidden(game.renderer, 'glBufferWrappers').length,
    },
    canvases: document.querySelectorAll('canvas').length,
    uiRegions: uiRegionCount(),
  };
}
