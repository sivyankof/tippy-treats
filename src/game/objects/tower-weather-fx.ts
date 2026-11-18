import { Rng } from '../../core/rng';
import type { EffectLevel } from '../../data/effect-levels';
import { TOWER_WEATHER } from '../../data/tower-weather';
import type { FlashKind } from './backdrop/lightning-flash';
import type { LayerView } from './layer-view';
import { towerWeather } from './tower-weather-state';

const STARTLE = TOWER_WEATHER.startle;
const SLEEPY = TOWER_WEATHER.sleepy;
/** Next try for a yawn when no layer was free for it. */
const RETRY_MS = 1000;

/** What the weather pieces need to know of the tower this frame. */
export interface TowerWeatherContext {
  views: ReadonlyMap<number, LayerView>;
  /** 0-based index of the top layer. */
  topIndex: number;
  /** A layer is in the air or about to spawn (the top layer watches it). */
  flying: boolean;
  /** A lick plays out a scene (the top layer is in it). */
  lickScene: boolean;
  /** The part of the world on screen (world y). */
  bandTop: number;
  bandBottom: number;
  level: EffectLevel;
}

interface Scheduled {
  view: LayerView;
  atMs: number;
  /** The reaction to start (`startleEyes` behind the glass of the Showcase). */
  reaction: 'startle' | 'startleEyes';
  hop: boolean;
}

/**
 * The layers' reactions to the weather that are not about one layer: the startle at a flash of lightning (a wave from the
 * top layer down, the top one hops), the sleepy faces of the night and the odd yawn of one of them. Faces and the hop
 * of the top layer are all it touches: no pictures of its own, so it adds no draw call (docs/06, "Живая погода на башне").
 */
export class TowerWeatherFx {
  private readonly rng: Rng;
  private clockMs = 0;
  private readonly pending: Scheduled[] = [];
  private nextYawnAt = -1;

  constructor(cosmeticSeed: number) {
    this.rng = new Rng(cosmeticSeed).fork('tower_weather');
  }

  /**
   * A flash of lightning: every layer on screen starts a scared face at once (a wave down the tower, `STARTLE.stepMs` a
   * layer), the top layer hops. `kind` `street` is the weaker one behind the glass: the eyes only, no hop. Lite level: the top
   * layers only, minimal: nobody. Faces busy with a reaction of their own are left alone.
   */
  startle(kind: FlashKind, ctx: TowerWeatherContext): void {
    if (ctx.level === 'minimal') return;
    const layers = ctx.level === 'lite' ? STARTLE.liteLayers : Infinity;
    const onScreen: Array<[number, LayerView]> = [];
    for (const [index, view] of ctx.views) {
      const shown = view.visible && view.y >= ctx.bandTop && view.y <= ctx.bandBottom;
      // A face that shows more than its plain idle is skipped (`startleAllowed`).
      if (shown && view.faceView.canStartle) onScreen.push([index, view]);
    }
    onScreen.sort((a, b) => b[0] - a[0]);
    onScreen.slice(0, layers).forEach(([index, view], rank) => {
      this.pending.push({
        view,
        atMs: this.clockMs + Math.min(STARTLE.maxDelayMs, rank * STARTLE.stepMs),
        reaction: kind === 'street' ? 'startleEyes' : 'startle',
        hop: kind === 'sky' && index === ctx.topIndex && !ctx.flying && !ctx.lickScene,
      });
    });
  }

  /** Makes the first layer from the top that is free yawn now, whatever the weather (the debug button). */
  yawnNow(ctx: TowerWeatherContext): boolean {
    return this.yawnOne(ctx, true);
  }

  tick(dtMs: number, ctx: TowerWeatherContext): void {
    this.clockMs += dtMs;
    this.runStartle();
    const sleepy = towerWeather.sleepy;
    for (const view of ctx.views.values()) view.faceView.setSleepy(sleepy);
    this.runYawns(ctx, sleepy);
  }

  private runStartle(): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const item = this.pending[i]!;
      if (item.atMs > this.clockMs) continue;
      this.pending.splice(i, 1);
      if (!item.view.visible || !item.view.faceView.canStartle) continue;
      item.view.faceView.react(item.reaction, STARTLE.holdMs);
      if (item.hop) item.view.rig.hop(STARTLE.hop.px, STARTLE.hop.ms);
    }
  }

  private runYawns(ctx: TowerWeatherContext, sleepy: boolean): void {
    if (!sleepy || ctx.level !== 'full') {
      this.nextYawnAt = -1;
      return;
    }
    if (this.nextYawnAt < 0) this.nextYawnAt = this.clockMs + this.rng.range(...SLEEPY.yawnEveryMs);
    if (this.clockMs < this.nextYawnAt) return;
    const yawned = this.yawnOne(ctx, false);
    this.nextYawnAt = this.clockMs + (yawned ? this.rng.range(...SLEEPY.yawnEveryMs) : RETRY_MS);
  }

  /** One free layer on screen yawns: the top one is left out while a layer is in the air. */
  private yawnOne(ctx: TowerWeatherContext, force: boolean): boolean {
    const free: Array<[number, LayerView]> = [];
    for (const [index, view] of ctx.views) {
      if (!view.visible || view.y < ctx.bandTop || view.y > ctx.bandBottom) continue;
      if (index === ctx.topIndex && (ctx.flying || ctx.lickScene)) continue;
      if (view.faceView.canYawn(force)) free.push([index, view]);
    }
    if (free.length === 0) return false;
    if (force) free.sort((a, b) => b[0] - a[0]);
    const [, view] = force ? free[0]! : free[this.rng.int(0, free.length - 1)]!;
    return view.faceView.yawn(force);
  }
}
