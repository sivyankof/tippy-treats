import * as Phaser from 'phaser';
import { MAX_IDLE_PERIOD_MS } from '../../data/idle-motion';
import { SCENES } from '../scene-keys';
import {
  LongestStill,
  StillTracker,
  effectiveStillMs,
  isOnScreen,
  toScreenRect,
  type ScreenRect,
} from './still-tracker';

/** Scenes of the run screen. */
const AUDITED_SCENES = [SCENES.game, SCENES.hud];
/** An object this long without a visible change is reported (the "no still object" limit). */
const STILL_LIMIT_MS = MAX_IDLE_PERIOD_MS;
const DEFAULT_SECONDS = 6;
/**
 * A change smaller than these does not count: it cannot be seen. Positions and sizes are logical
 * pixels on the screen; the scale only matters for containers and objects that cannot measure
 * themselves (the others are judged by their bounds, which already include the scale).
 */
const TOLERANCES = {
  position: 0.6,
  scale: 0.002,
  angleDeg: 0.25,
  alpha: 0.02,
  size: 0.6,
  tile: 0.6,
};
/** Order of the numbers handed to the tracker; see `sampleValues`. */
const TRACKER_TOLERANCES = [
  TOLERANCES.position,
  TOLERANCES.position,
  TOLERANCES.scale,
  TOLERANCES.scale,
  TOLERANCES.angleDeg,
  TOLERANCES.alpha,
  0,
  TOLERANCES.size,
  TOLERANCES.size,
  TOLERANCES.tile,
  TOLERANCES.tile,
];

/** One object that stood still. */
export interface IdleAuditEntry {
  scene: string;
  type: string;
  texture: string;
  frame: string;
  /** Depth of the top-level object it belongs to (what decides the draw order). */
  depth: number;
  /** Containers above it, nearest first. */
  parent: string;
  /** Centre of the object on the screen. */
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  /** The object cannot measure itself (a Graphics): the screen position is its origin and the size is 0. */
  boundsUnknown: boolean;
  /** The longest time it stayed unchanged, ms. */
  stillMs: number;
}

export interface IdleAuditReport {
  seconds: number;
  frames: number;
  /** Largest number of visible, on-screen objects seen in one frame. */
  objectsChecked: number;
  limitMs: number;
  still: IdleAuditEntry[];
  /** The same objects grouped by scene, type, texture and parent, with a count. */
  groups: Array<{ key: string; count: number; stillMs: number }>;
}

/** The fields of a display object the audit reads; anything may be missing on some types. */
interface Probe {
  type: string;
  visible?: boolean;
  alpha?: number;
  depth?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  tintTopLeft?: number;
  displayWidth?: number;
  displayHeight?: number;
  tilePositionX?: number;
  tilePositionY?: number;
  scrollFactorX?: number;
  scrollFactorY?: number;
  text?: string;
  texture?: { key?: string };
  frame?: { name?: string | number };
  list?: Phaser.GameObjects.GameObject[];
  parentContainer?: Phaser.GameObjects.Container | null;
  getBounds?: (output?: Phaser.Geom.Rectangle) => Phaser.Geom.Rectangle;
}

const probe = (object: Phaser.GameObjects.GameObject): Probe => object as unknown as Probe;

/**
 * The tracked numbers of an object, in the order of `TRACKER_TOLERANCES`. With `screen` (the
 * bounds as the camera shows them) the position and size are those of the picture on the screen,
 * so a scale change shows as the pixels it moves; without it (a container, a Graphics) the raw
 * position and scale are used.
 */
function sampleValues(p: Probe, screen: ScreenRect | null, out: number[]): number[] {
  out[0] = screen ? screen.x : (p.x ?? 0);
  out[1] = screen ? screen.y : (p.y ?? 0);
  out[2] = screen ? 0 : (p.scaleX ?? 1);
  out[3] = screen ? 0 : (p.scaleY ?? 1);
  out[4] = p.angle ?? 0;
  out[5] = p.alpha ?? 1;
  out[6] = p.tintTopLeft ?? 0;
  out[7] = screen ? screen.width : (p.displayWidth ?? 0);
  out[8] = screen ? screen.height : (p.displayHeight ?? 0);
  out[9] = p.tilePositionX ?? 0;
  out[10] = p.tilePositionY ?? 0;
  return out;
}

/** Frame name, texture and text: a change of any of them is a visible change. */
function sampleTag(p: Probe): string {
  return `${String(p.texture?.key ?? '')}|${String(p.frame?.name ?? '')}|${p.text ?? ''}`;
}

/** Walks the display lists of the run scenes every frame and reports what stays still. */
class IdleAudit {
  private readonly tracker = new StillTracker<Phaser.GameObjects.GameObject>(TRACKER_TOLERANCES);
  private readonly longest = new LongestStill<Phaser.GameObjects.GameObject, IdleAuditEntry>();
  private readonly values: number[] = [];
  private readonly bounds = new Phaser.Geom.Rectangle();
  private frames = 0;
  private maxChecked = 0;
  private checked = 0;

  constructor(private readonly game: Phaser.Game) {}

  /** One frame, called after the scenes have updated. */
  sample(nowMs: number): void {
    this.frames += 1;
    this.checked = 0;
    this.tracker.beginFrame();
    for (const key of AUDITED_SCENES) {
      const scene = this.game.scene.getScene(key);
      if (!scene || !scene.sys.isVisible()) continue;
      const camera = scene.cameras.main;
      for (const object of scene.sys.displayList.list) {
        this.visit(object, {
          scene: key,
          camera,
          nowMs,
          parentStillMs: Infinity,
          alpha: 1,
          depth: probe(object).depth ?? 0,
          scrollFactor: {
            x: probe(object).scrollFactorX ?? 1,
            y: probe(object).scrollFactorY ?? 1,
          },
          parent: '',
        });
      }
    }
    this.tracker.endFrame();
    this.maxChecked = Math.max(this.maxChecked, this.checked);
  }

  report(seconds: number): IdleAuditReport {
    const still = this.longest
      .over(STILL_LIMIT_MS)
      .map(({ ms, note }) => ({ ...note, stillMs: ms }));
    const groups = new Map<string, { key: string; count: number; stillMs: number }>();
    for (const entry of still) {
      const key = `${entry.scene} ${entry.type} ${entry.texture} < ${entry.parent}`;
      const group = groups.get(key) ?? { key, count: 0, stillMs: 0 };
      group.count += 1;
      group.stillMs = Math.max(group.stillMs, entry.stillMs);
      groups.set(key, group);
    }
    return {
      seconds,
      frames: this.frames,
      objectsChecked: this.maxChecked,
      limitMs: STILL_LIMIT_MS,
      still,
      groups: [...groups.values()].sort((a, b) => b.stillMs - a.stillMs),
    };
  }

  private visit(object: Phaser.GameObjects.GameObject, context: VisitContext): void {
    const p = probe(object);
    const alpha = context.alpha * (p.alpha ?? 1);
    if (p.visible === false || alpha <= 0 || p.type === 'Zone') return;

    const isContainer = Array.isArray(p.list);
    // Some objects (Graphics) have no bounds: they are not tested for being on screen, so
    // a full-screen Graphics at (0, 0) is still audited; the report marks them as unmeasured.
    const bounds = !isContainer && p.getBounds ? p.getBounds(this.bounds) : null;
    const screen = bounds
      ? toScreenRect(
          bounds,
          { x: context.camera.scrollX, y: context.camera.scrollY },
          context.scrollFactor,
        )
      : null;
    const ownMs = this.tracker.observe(
      object,
      sampleValues(p, screen, this.values),
      sampleTag(p),
      context.nowMs,
    );
    const stillMs = effectiveStillMs(ownMs, context.parentStillMs);

    if (isContainer && p.list) {
      const name = `${p.type}:${object.constructor.name}`;
      const parent = context.parent ? `${name} > ${context.parent}` : name;
      for (const child of p.list) {
        this.visit(child, { ...context, parentStillMs: stillMs, alpha, parent });
      }
      return;
    }
    this.checkLeaf(object, p, bounds, stillMs, context);
  }

  private checkLeaf(
    object: Phaser.GameObjects.GameObject,
    p: Probe,
    bounds: ScreenRect | null,
    stillMs: number,
    context: VisitContext,
  ): void {
    const camera = context.camera;
    const onScreen = isOnScreen(
      bounds,
      { x: camera.scrollX, y: camera.scrollY },
      context.scrollFactor,
      camera.width,
      camera.height,
    );
    if (!onScreen) {
      // Off screen counts as hidden: it starts over when it comes back.
      this.tracker.forget(object);
      return;
    }
    this.checked += 1;
    if (stillMs <= STILL_LIMIT_MS) return;
    this.longest.record(object, stillMs, {
      scene: context.scene,
      type: p.type,
      texture: String(p.texture?.key ?? ''),
      frame: String(p.frame?.name ?? ''),
      depth: context.depth,
      parent: context.parent,
      screenX: round(
        (bounds ? bounds.x + bounds.width / 2 : (p.x ?? 0)) -
          camera.scrollX * context.scrollFactor.x,
      ),
      screenY: round(
        (bounds ? bounds.y + bounds.height / 2 : (p.y ?? 0)) -
          camera.scrollY * context.scrollFactor.y,
      ),
      width: bounds ? round(bounds.width) : 0,
      height: bounds ? round(bounds.height) : 0,
      boundsUnknown: !bounds,
      stillMs: round(stillMs),
    });
  }
}

interface VisitContext {
  scene: string;
  camera: Phaser.Cameras.Scene2D.Camera;
  nowMs: number;
  /** How long the containers above have been unchanged (the shortest of the chain). */
  parentStillMs: number;
  alpha: number;
  depth: number;
  scrollFactor: { x: number; y: number };
  parent: string;
}

const round = (value: number): number => Math.round(value * 10) / 10;

let running = false;

/**
 * Watches the run for `seconds` and resolves with the objects that stayed visibly unchanged for
 * more than 2 seconds (see `IdleAuditReport`). Also prints the groups as a table.
 */
function runAudit(game: Phaser.Game, seconds: number): Promise<IdleAuditReport> {
  if (running) return Promise.reject(new Error('An idle audit is already running'));
  running = true;
  const audit = new IdleAudit(game);
  return new Promise((resolve) => {
    const onStep = (time: number): void => audit.sample(time);
    game.events.on(Phaser.Core.Events.POST_STEP, onStep);
    window.setTimeout(() => {
      game.events.off(Phaser.Core.Events.POST_STEP, onStep);
      running = false;
      const report = audit.report(seconds);
      console.info(
        `Idle audit: ${report.still.length} object(s) unchanged for more than ${report.limitMs} ms ` +
          `in ${report.seconds} s (${report.objectsChecked} checked)`,
      );
      if (report.groups.length > 0) console.table(report.groups);
      resolve(report);
    }, seconds * 1000);
  });
}

type AuditWindow = Window & { tippyIdleAudit?: (seconds?: number) => Promise<IdleAuditReport> };

/** Dev only: exposes `window.tippyIdleAudit(seconds = 6)`. */
export function registerIdleAudit(game: Phaser.Game): void {
  (window as AuditWindow).tippyIdleAudit = (seconds = DEFAULT_SECONDS) => runAudit(game, seconds);
}
