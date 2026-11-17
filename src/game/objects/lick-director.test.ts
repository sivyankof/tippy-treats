import { afterEach, describe, expect, it } from 'vitest';
import { LICK, type LickStyle } from '../../data/lick';
import { effectsMode } from '../effects-mode';
import { LayerMarkStore, type LayerMark } from './layer-mark-store';
import { LickDirector, type LickContext } from './lick-director';
import type { LayerView } from './layer-view';
import {
  lickDurationMs,
  lickedDripShare,
  lickFrame,
  lickStartMs,
  newLickFrame,
  type LickFrame,
  type LickKind,
  type LickScene,
} from './lick-plan';

const FRAME_MS = 16;
const RUN_MS = 180_000;
const SEED = 4242;
const LAYERS = 4;
/** A tongue lying across the whole layer: every drip it can reach is touched. */
const TONGUE = Array.from({ length: (LICK.tongue.segments + 1) * 2 }, (_, i) =>
  i % 2 === 0 ? -300 + (600 * i) / (LICK.tongue.segments * 2) : 0,
);

/** Just enough of a face to play a lick for its length. */
class FakeFace {
  x = 0;
  y = 0;
  faceScale = 1;
  private ms = -1;
  private scene: LickScene = 'big';
  private style: LickStyle = LICK.styles.plain;
  private readonly frame: LickFrame = newLickFrame();
  /** The tongue cannot be laid: the face refuses to start a lick. */
  noTongue = false;

  constructor(
    private readonly starts: number[],
    private readonly clock: { ms: number },
    private readonly scenes: LickScene[],
    private readonly kinds: LickKind[] = [],
  ) {}

  get canLick(): boolean {
    return this.ms < 0;
  }

  get licking(): boolean {
    return this.ms >= 0;
  }

  get lickFrameNow(): Readonly<LickFrame> {
    return lickFrame(this.scene, Math.max(0, this.ms), this.style, this.frame);
  }

  get tonguePoints(): readonly number[] | null {
    return this.ms >= 0 ? TONGUE : null;
  }

  startLick(scene: LickScene, kind: LickKind, _shape: unknown, style: LickStyle): boolean {
    if (this.noTongue) return false;
    this.ms = lickStartMs(scene, kind, style);
    this.kinds.push(kind);
    this.scene = scene;
    this.style = style;
    this.starts.push(this.clock.ms);
    this.scenes.push(scene);
    return true;
  }

  tick(dtMs: number): void {
    if (this.ms < 0) return;
    this.ms += dtMs;
    if (this.ms >= lickDurationMs(this.scene, this.style)) this.ms = -1;
  }

  cancelLick(): void {
    this.ms = -1;
  }

  glanceAt(): void {}
  lickLipsEnviously(): void {}
}

/** Drips that get licked and regrow (or a layer with none). */
class FakeDrips {
  ownGlaze = 0xffd7e8;
  /** Time since each drip was licked (`Infinity`: never, or grown back). */
  private readonly sinceLick: number[];
  licks = 0;
  regrown = 0;

  constructor(count: number) {
    this.sinceLick = Array.from({ length: count }, () => Infinity);
  }

  touch(): void {
    for (let i = 0; i < this.sinceLick.length; i++) {
      if (this.sinceLick[i] !== Infinity) continue;
      this.sinceLick[i] = 0;
      this.licks++;
    }
  }

  grow(dtMs: number): void {
    for (let i = 0; i < this.sinceLick.length; i++) {
      if (this.sinceLick[i] === Infinity) continue;
      this.sinceLick[i]! += dtMs;
      if (lickedDripShare(this.sinceLick[i]!) >= 1) {
        this.sinceLick[i] = Infinity;
        this.regrown++;
      }
    }
  }

  /** The drawing of the drop fails (a broken decoration). */
  broken = false;

  showLickDrip(): void {
    if (this.broken) throw new TypeError('broken drip');
  }
  showLickDrop(): void {
    if (this.broken) throw new TypeError('broken drop');
  }
  hideLick(): void {}
}

/** A still tower of faces and drips for the director to lick. */
function buildTower(
  dripsPerLayer: number,
  clock: { ms: number },
  starts: number[],
  scenes: LickScene[],
  kinds: LickKind[] = [],
): { faces: FakeFace[]; drips: FakeDrips[]; ctx: LickContext } {
  const faces: FakeFace[] = [];
  const drips: FakeDrips[] = [];
  const views = new Map<number, LayerView>();
  for (let i = 0; i < LAYERS; i++) {
    const face = new FakeFace(starts, clock, scenes, kinds);
    const glaze = new FakeDrips(dripsPerLayer);
    faces.push(face);
    drips.push(glaze);
    const view = {
      x: 0,
      y: 300 + i * 120,
      visible: true,
      drawnWidth: 720,
      cutSide: null,
      look: { kind: 'plain' },
      faceView: face,
      glanceAtWorld: (): void => {},
      glazeDrips: glaze,
    };
    views.set(i, view as unknown as LayerView);
  }
  const ctx: LickContext = {
    views,
    topIndex: LAYERS,
    calm: true,
    aiming: false,
    bandTop: 0,
    bandBottom: 2000,
    nowMs: 0,
  };
  return { faces, drips, ctx };
}

/** Plays a run of the director over a still tower; returns when each lick started and which scene it played. */
function playRun(dripsPerLayer: number): {
  starts: number[];
  scenes: LickScene[];
  licks: number;
  regrown: number;
} {
  const clock = { ms: 0 };
  const starts: number[] = [];
  const scenes: LickScene[] = [];
  const { faces, drips, ctx } = buildTower(dripsPerLayer, clock, starts, scenes);
  const director = new LickDirector(SEED);
  for (; clock.ms < RUN_MS; clock.ms += FRAME_MS) {
    for (const face of faces) face.tick(FRAME_MS);
    for (const glaze of drips) glaze.grow(FRAME_MS);
    director.update(FRAME_MS, ctx);
  }
  const sum = (f: (d: FakeDrips) => number): number => drips.reduce((n, d) => n + f(d), 0);
  return { starts, scenes, licks: sum((d) => d.licks), regrown: sum((d) => d.regrown) };
}

describe('LickDirector', () => {
  afterEach(() => effectsMode.pinLevel(null));

  it('starts a lick only when the common timer says so, never because a drip has grown back', () => {
    effectsMode.pinLevel('full');
    const dry = playRun(0);
    const dripping = playRun(5);
    // The tongue licked drips and they grew back many times over.
    expect(dripping.licks).toBeGreaterThan(10);
    expect(dripping.regrown).toBeGreaterThan(10);
    // Yet the licks start at the very same moments as on a tower with no drips at all.
    expect(dripping.starts).toEqual(dry.starts);
    expect(dry.starts[0]).toBeGreaterThanOrEqual(LICK.firstDelayMs[0]);
    expect(dry.starts[0]).toBeLessThanOrEqual(LICK.firstDelayMs[1] + FRAME_MS);
    for (let i = 1; i < dry.starts.length; i++) {
      const gap = dry.starts[i]! - dry.starts[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(LICK.intervalMs[0]);
      expect(gap).toBeLessThanOrEqual(LICK.intervalMs[1] + lickDurationMs('big') * 1.2);
    }
  });

  it('plays the short scene in place of the big one on lite, at the same moments', () => {
    effectsMode.pinLevel('full');
    const full = playRun(0);
    expect(full.scenes).toContain('big');
    effectsMode.pinLevel('lite');
    const lite = playRun(0);
    expect(lite.scenes.length).toBeGreaterThan(5);
    expect(lite.scenes.every((scene) => scene === 'short')).toBe(true);
    // The dice are thrown as before, so the ticks of the timer match up to the length of the scene played.
    expect(lite.starts[0]).toBe(full.starts[0]);
  });

  it('plays no lick at all on minimal', () => {
    effectsMode.pinLevel('minimal');
    expect(playRun(0).starts).toEqual([]);
  });

  it('leaves the scheduler alone for a forced scene, and asks it for a natural one', () => {
    effectsMode.pinLevel('full');
    const clock = { ms: 0 };
    const scenes: LickScene[] = [];
    const { ctx } = buildTower(0, clock, [], scenes);
    const director = new LickDirector(SEED);
    let asked = 0;
    const scheduler = (director as unknown as { scheduler: { nextScene(): LickScene } }).scheduler;
    const nextScene = scheduler.nextScene.bind(scheduler);
    scheduler.nextScene = () => {
      asked++;
      return nextScene();
    };
    expect(director.lickNow(ctx, 'short', 'fall')).toBe(true);
    expect(asked).toBe(0);
    expect(scenes).toEqual(['short']);
    director.stop();
    expect(director.lickNow(ctx)).toBe(true);
    expect(asked).toBe(1);
  });

  it('skips a lick when the face has no tongue to lay, and licks once it has one again', () => {
    effectsMode.pinLevel('full');
    const { faces, ctx } = buildTower(0, { ms: 0 }, [], []);
    for (const face of faces) face.noTongue = true;
    const director = new LickDirector(SEED);
    expect(director.lickNow(ctx, 'big', 'fall')).toBe(false);
    expect(director.stage).toBeNull();
    for (const face of faces) face.noTongue = false;
    expect(director.lickNow(ctx, 'big', 'fall')).toBe(true);
  });

  it('drops a lick whose drawing fails instead of throwing into the run', () => {
    effectsMode.pinLevel('full');
    const clock = { ms: 0 };
    const { faces, drips, ctx } = buildTower(0, clock, [], []);
    const director = new LickDirector(SEED);
    expect(director.lickNow(ctx, 'short', 'fall')).toBe(true);
    for (const glaze of drips) glaze.broken = true;
    const warn = console.warn;
    console.warn = (): void => {};
    try {
      for (let ms = 0; ms < lickDurationMs('short'); ms += FRAME_MS) {
        for (const face of faces) face.tick(FRAME_MS);
        expect(() => director.update(FRAME_MS, ctx)).not.toThrow();
      }
    } finally {
      console.warn = warn;
    }
    expect(director.stage).toBeNull();
    expect(faces.every((face) => !face.licking)).toBe(true);
  });
});

/** A juice stain, as the squash leaves it. */
function stainMark(): LayerMark {
  return {
    texture: 'fx_stain',
    dx: 100,
    dy: 40,
    originX: 0.5,
    originY: 0.15,
    width: 62,
    height: 34,
    bornMs: 0,
    growMs: 520,
  };
}

/** Plays the director over a still tower with stains on the given layers (0-based, queued at 0 ms). */
function playJuice(
  layers: number[],
  options: { ms?: number; aiming?: boolean; level?: 'full' | 'lite'; gone?: number[] } = {},
): { starts: Array<{ ms: number; kind: LickKind }>; marks: LayerMarkStore } {
  effectsMode.pinLevel(options.level ?? 'full');
  const clock = { ms: 0 };
  const starts: Array<{ ms: number; kind: LickKind }> = [];
  const kinds: LickKind[] = [];
  const { faces, ctx } = buildTower(0, clock, [], [], kinds);
  const marks = new LayerMarkStore();
  for (const index of layers) marks.addPress(index + 1, [stainMark()]);
  for (const index of options.gone ?? []) (ctx.views as Map<number, LayerView>).delete(index);
  ctx.aiming = options.aiming ?? false;
  ctx.topIndex = LAYERS - 1;
  const director = new LickDirector(SEED, marks);
  for (const index of layers) director.queueJuice(index);
  let seen = 0;
  for (; clock.ms < (options.ms ?? 6000); clock.ms += FRAME_MS) {
    ctx.nowMs = clock.ms;
    for (const face of faces) face.tick(FRAME_MS);
    director.update(FRAME_MS, ctx);
    while (seen < kinds.length) starts.push({ ms: clock.ms, kind: kinds[seen++]! });
  }
  return { starts, marks };
}

describe('LickDirector, juice stains', () => {
  afterEach(() => effectsMode.pinLevel(null));

  it('licks a stain about a second after it was made and leaves no stain behind', () => {
    const { starts, marks } = playJuice([1]);
    const stains = starts.filter((s) => s.kind === 'stain');
    expect(stains).toHaveLength(1);
    expect(stains[0]!.ms).toBeGreaterThanOrEqual(LICK.juice.delayMs - FRAME_MS);
    expect(stains[0]!.ms).toBeLessThanOrEqual(LICK.juice.delayMs + 2 * FRAME_MS);
    expect(marks.hasPress(2)).toBe(false);
  });

  it('takes several stains one after another with a pause between', () => {
    const { starts, marks } = playJuice([0, 1], { ms: 5000 });
    const stains = starts.filter((s) => s.kind === 'stain');
    expect(stains).toHaveLength(2);
    const length = lickDurationMs('short') - lickStartMs('short', 'stain');
    expect(stains[1]!.ms - stains[0]!.ms).toBeGreaterThanOrEqual(length + LICK.juice.betweenMs);
    expect(marks.hasPress(1)).toBe(false);
    expect(marks.hasPress(2)).toBe(false);
  });

  it('keeps the idle timer off for a while after a juice lick', () => {
    const { starts } = playJuice([1], { ms: LICK.firstDelayMs[1] + 1000 });
    const stain = starts.find((s) => s.kind === 'stain')!;
    for (const s of starts.filter((s) => s.kind !== 'stain')) {
      expect(s.ms - stain.ms).toBeGreaterThanOrEqual(LICK.juice.idleAfterMs);
    }
  });

  it('makes the stain of a layer that is gone melt without a lick', () => {
    const { starts, marks } = playJuice([1], { gone: [1], ms: 2000 });
    expect(starts).toEqual([]);
    expect(marks.hasPress(2)).toBe(false);
  });

  it('lets the top layer wait while a layer is in the air, and melts the stain when it waits too long', () => {
    const waiting = playJuice([LAYERS - 1], { aiming: true, ms: LICK.juice.delayMs + 2000 });
    expect(waiting.starts).toEqual([]);
    expect(waiting.marks.hasPress(LAYERS)).toBe(true);
    const melted = playJuice([LAYERS - 1], {
      aiming: true,
      ms: LICK.juice.delayMs + LICK.juice.timeoutMs + 1000,
    });
    expect(melted.starts).toEqual([]);
    expect(melted.marks.hasPress(LAYERS)).toBe(false);
  });

  it('melts the stain on lite with no tongue', () => {
    const lite = playJuice([1], { level: 'lite', ms: 3000 });
    expect(lite.starts.filter((s) => s.kind === 'stain')).toEqual([]);
    expect(lite.marks.hasPress(2)).toBe(false);
  });
});
