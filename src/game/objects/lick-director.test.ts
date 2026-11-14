import { afterEach, describe, expect, it } from 'vitest';
import { LICK, type LickStyle } from '../../data/lick';
import { effectsMode } from '../effects-mode';
import { LickDirector, type LickContext } from './lick-director';
import type { LayerView } from './layer-view';
import {
  lickDurationMs,
  lickedDripShare,
  lickFrame,
  newLickFrame,
  type LickFrame,
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

  constructor(
    private readonly starts: number[],
    private readonly clock: { ms: number },
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

  startLick(scene: LickScene, _kind: unknown, _shape: unknown, style: LickStyle): void {
    this.ms = 0;
    this.scene = scene;
    this.style = style;
    this.starts.push(this.clock.ms);
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

  showLickDrip(): void {}
  showLickDrop(): void {}
  hideLick(): void {}
}

/** Plays a run of the director over a still tower; returns when each lick started. */
function playRun(dripsPerLayer: number): { starts: number[]; licks: number; regrown: number } {
  const clock = { ms: 0 };
  const starts: number[] = [];
  const faces: FakeFace[] = [];
  const drips: FakeDrips[] = [];
  const views = new Map<number, LayerView>();
  for (let i = 0; i < LAYERS; i++) {
    const face = new FakeFace(starts, clock);
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
  };
  const director = new LickDirector(SEED);
  for (; clock.ms < RUN_MS; clock.ms += FRAME_MS) {
    for (const face of faces) face.tick(FRAME_MS);
    for (const glaze of drips) glaze.grow(FRAME_MS);
    director.update(FRAME_MS, ctx);
  }
  const sum = (f: (d: FakeDrips) => number): number => drips.reduce((n, d) => n + f(d), 0);
  return { starts, licks: sum((d) => d.licks), regrown: sum((d) => d.regrown) };
}

describe('LickDirector', () => {
  afterEach(() => effectsMode.setChoice('auto'));

  it('starts a lick only when the common timer says so, never because a drip has grown back', () => {
    effectsMode.setChoice('off');
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
});
