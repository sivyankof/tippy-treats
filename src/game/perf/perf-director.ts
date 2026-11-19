import * as Phaser from 'phaser';
import type { EffectLevel } from '../../data/app/effect-levels';
import { PERF, PERF_TRANSITION, type PerfSegmentDef } from '../../data/debug/perf';
import { services } from '../../services';
import { setFrameWorkListener } from '../frame-work';
import { capRenderDensity } from '../render-density';
import { densityCapForLevel } from '../../util/density-scale';
import { webglRendererOf, type WebGLRenderer } from '../webgl-renderer';
import { chooseRunLook } from '../run-look-choice';
import { CLASSIC_RUN } from '../run-request';
import type { GameScene } from '../scenes/game-scene';
import { launchRun, resultsShown, SCENES } from '../scene-keys';
import { countDrawCalls } from './draw-calls';
import { MissDriver } from './perf-drivers';
import { PerfOverlay } from './perf-overlay';
import { currentSegment, endPerfSession, perfSession } from './perf-session';
import { hidePartsWhileDrawing } from './perf-parts';
import {
  budgetVerdict,
  formatBudgetLine,
  formatHeader,
  formatAtlas,
  atlasOk,
  formatTable,
  isAutomatedBrowser,
  SegmentSamples,
  type BudgetVerdict,
  type SegmentStats,
} from './perf-stats';
import { runHooks } from './run-hooks';
import { atlasPeak } from '../ui/shared-atlas';
import { cutOverride } from '../fx/cuts/cut-override';

/** What the page reads from `window.__tippyPerf`. */
export interface PerfReport {
  /** The benchmark is over (or the still is frozen). */
  done: boolean;
  /** Name of the segment being played while it runs. */
  segment: string | null;
  /** `?still=`: the game is frozen at the moment of the still. */
  stillReady?: boolean;
  fx?: EffectLevel;
  /** Draw calls could be counted (WebGL context). */
  drawCallsCounted?: boolean;
  segments?: SegmentStats[];
  /** What the table was measured on: canvas and CSS size, density, texture units, hidden parts. */
  header?: string;
  table?: string;
  /** The frame budget verdict (`PERF.budget`): `over` lists the segments with a value over it. */
  budget?: BudgetVerdict;
}

type PerfWindow = Window & { __tippyPerf?: PerfReport };

/** Where a segment is: waiting for its run, warming up (and waiting for its window to open), measuring. */
type Phase = 'launch' | 'warmup' | 'measure';

/** A segment that never gets going is given up after this long (the note says so in the table). */
const TIMEOUT_NOTE = 'timeout';
/** A transition segment whose run never reached the zone boundary. */
const NO_FADE_NOTE = 'no zone change';
/** A transition segment whose window ran out during the cross-fade or its tail. */
const FADE_CUT_NOTE = 'window ended during the fade';

/**
 * Plays the segments of the benchmark one after another: starts the run of each (the setup comes
 * from `perf-session`), waits until it is ready, warms up, measures the frame work time of a
 * window and moves on; at the end it shows the table. The director only watches and pokes the
 * scene through `GameScene.perfProbe` and the run hooks: it adds nothing to the game rules.
 */
class PerfDirector {
  private readonly overlay: PerfOverlay | null;
  private readonly drawTotal: (() => number) | null;
  private readonly rows: SegmentStats[] = [];
  private samples = new SegmentSamples();
  private phase: Phase = 'launch';
  private phaseStartMs = 0;
  private readyMs = 0;
  /** When the driver of a miss is armed (the collapse and the results wait for it); `null`: not (any more). */
  private armAtMs: number | null = null;
  /** When the measured window opens; `null` while it waits for the miss or the results screen. */
  private opensAtMs: number | null = null;
  private windowStartMs = 0;
  private lastDrawTotal = 0;
  private nextPokeMs = 0;
  /** A still: when the arc has been seen grown, and so when to freeze. */
  private freezeAtMs = 0;
  /** The benchmark ended its last segment (or the still froze the game). */
  private finished = false;
  /** A transition segment: the window has seen the zone cross-fade, and when it ended (`null`: not yet). */
  private sawFade = false;
  private fadeEndMs: number | null = null;

  constructor(private readonly game: Phaser.Game) {
    const params = perfSession()?.params;
    this.overlay = params?.still ? null : new PerfOverlay();
    this.drawTotal = countDrawCalls(game);
    if (params) {
      if (params.densityCap !== undefined) capRenderDensity(game, params.densityCap);
      hidePartsWhileDrawing(game, params.hidden ?? []);
      const units = params.textureUnits;
      if (units !== undefined) {
        // The render nodes come with the renderer's boot, when the textures are ready.
        const setUnits = (): void => this.webgl?.renderNodes.setMaxParallelTextureUnits(units);
        if (this.webgl?.renderNodes) setUnits();
        else game.events.once(Phaser.Core.Events.READY, setUnits);
      }
    }
  }

  /** Headless or driven browser: the frame intervals are for reference only. */
  private readonly automated = isAutomatedBrowser(navigator);

  private get webgl(): WebGLRenderer | null {
    return webglRendererOf(this.game);
  }

  /** The line above the table; read at the end, after the last resize. */
  private header(fx: EffectLevel): string {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const params = perfSession()?.params;
    const webgl = this.webgl;
    return formatHeader({
      fx,
      canvas: { width: canvas.width, height: canvas.height },
      css: { width: rect.width, height: rect.height },
      devicePixelRatio: window.devicePixelRatio,
      // Without `&dpr=` the game caps the density by the pinned effects level.
      densityCap: params?.densityCap ?? densityCapForLevel(fx),
      textureUnits: webgl?.renderNodes?.maxParallelTextureUnits ?? 0,
      maxTextureUnits: webgl?.maxTextures ?? 0,
      hidden: params?.hidden ?? [],
      automated: this.automated,
      look: chooseRunLook({ seed: PERF.seed, perf: params ?? {} }),
    });
  }

  start(): void {
    this.phaseStartMs = performance.now();
    this.showLabel();
    setFrameWorkListener((workMs, nowMs) => this.onFrame(workMs, nowMs));
  }

  private get gameScene(): GameScene {
    return this.game.scene.getScene(SCENES.game) as GameScene;
  }

  private get resultsUp(): boolean {
    return resultsShown(this.game.scene);
  }

  private onFrame(workMs: number, nowMs: number): void {
    const def = currentSegment();
    const session = perfSession();
    if (this.finished || !def || !session) return;
    if (this.phase === 'launch') {
      if (session.runsStarted === session.index + 1 && this.runReady()) this.runIsReady(def, nowMs);
      else if (nowMs - this.phaseStartMs > PERF.readyTimeoutMs)
        this.endSegment(nowMs, TIMEOUT_NOTE);
      return;
    }
    this.poke(def, nowMs);
    if (this.phase === 'warmup') {
      if (session.params.still) this.watchStill(def, nowMs);
      else this.warmUp(def, nowMs);
      return;
    }
    const total = this.drawTotal?.() ?? null;
    const fading = this.gameScene.perfProbe()?.zoneFading ?? false;
    this.samples.add(workMs, total === null ? null : total - this.lastDrawTotal, nowMs, fading);
    if (total !== null) this.lastDrawTotal = total;
    if (def.endAfterFade && this.fadeOver(fading, nowMs)) this.endSegment(nowMs, '');
    else if (nowMs - this.windowStartMs >= def.measureMs) {
      this.endSegment(nowMs, !def.endAfterFade ? '' : this.sawFade ? FADE_CUT_NOTE : NO_FADE_NOTE);
    } else if (this.resultsUp && def.startOn !== 'results') {
      this.endSegment(nowMs, def.endOnResults ? '' : 'run ended early');
    }
  }

  /** A transition segment: the cross-fade has been seen, has ended and its tail is over. */
  private fadeOver(fading: boolean, nowMs: number): boolean {
    if (fading) {
      this.sawFade = true;
      this.fadeEndMs = null;
      return false;
    }
    if (!this.sawFade) return false;
    this.fadeEndMs ??= nowMs;
    return nowMs - this.fadeEndMs >= PERF_TRANSITION.tailMs;
  }

  /** The run of this segment exists, its camera is up and the layers are flying. */
  private runReady(): boolean {
    const probe = this.gameScene.perfProbe();
    return probe !== null && !probe.introActive && probe.state.phase === 'flying';
  }

  private runIsReady(def: PerfSegmentDef, nowMs: number): void {
    this.phase = 'warmup';
    this.phaseStartMs = nowMs;
    this.readyMs = nowMs;
    this.nextPokeMs = nowMs;
    this.freezeAtMs = 0;
    this.armAtMs = null;
    this.opensAtMs = null;
    cutOverride.setAlways(def.cutVariant ?? null);
    if (def.startOn === 'ready') this.opensAtMs = nowMs + def.warmupMs;
    // The collapse waits for the miss; the results screen needs the miss at once.
    else this.armAtMs = nowMs + (def.startOn === 'miss' ? def.warmupMs : 0);
  }

  /** Arms the miss when it is time, opens the window when its moment has come. */
  private warmUp(def: PerfSegmentDef, nowMs: number): void {
    if (this.armAtMs !== null && nowMs >= this.armAtMs) {
      this.armAtMs = null;
      const driver = perfSession()?.driver;
      if (driver instanceof MissDriver) driver.arm();
    }
    if (this.opensAtMs === null) {
      const driver = perfSession()?.driver;
      if (def.startOn === 'miss' && driver instanceof MissDriver && driver.fired) {
        this.opensAtMs = nowMs;
      } else if (def.startOn === 'results' && this.resultsUp) {
        // The results screen has its own warm-up: it slides in and fills first.
        this.opensAtMs = nowMs + def.warmupMs;
      }
    }
    if (this.opensAtMs !== null && nowMs >= this.opensAtMs) {
      this.samples = new SegmentSamples();
      this.lastDrawTotal = this.drawTotal?.() ?? 0;
      this.windowStartMs = nowMs;
      this.sawFade = false;
      this.fadeEndMs = null;
      this.phase = 'measure';
      // The count of forced cuts is of the measured window only.
      cutOverride.setAlways(def.cutVariant ?? null);
    } else if (nowMs - this.readyMs > PERF.readyTimeoutMs * 2) {
      this.endSegment(nowMs, TIMEOUT_NOTE);
    }
  }

  /** Does what the segment repeats: licks and the guest. */
  private poke(def: PerfSegmentDef, nowMs: number): void {
    const trigger = def.trigger;
    if (!trigger || nowMs < this.nextPokeMs) return;
    this.nextPokeMs = nowMs + trigger.everyMs;
    const hooks = runHooks();
    if (!hooks) return;
    if (trigger.kind === 'lick') hooks.lick(trigger.scene, trigger.drop);
    else hooks.guest();
  }

  /** A still: the game freezes at its moment (the screenshot is the harness's job). */
  private watchStill(def: PerfSegmentDef, nowMs: number): void {
    const hooks = runHooks();
    let settled: boolean;
    if (def.id === 'lick-big') settled = hooks?.lickStage() === 'hold';
    else if (def.id === 'rainbow') settled = this.arcSettled(hooks?.arcGrown() === true, nowMs);
    else settled = nowMs - this.readyMs >= PERF.towerStillMs;
    if (!settled) return;
    this.finished = true;
    this.game.loop.sleep();
    setFrameWorkListener(null);
    this.publish({ done: true, stillReady: true, segment: def.id });
  }

  /** The arc has been grown for a moment, so it hangs in the air. */
  private arcSettled(grown: boolean, nowMs: number): boolean {
    if (!grown) return false;
    if (this.freezeAtMs === 0) this.freezeAtMs = nowMs + PERF.stillSettleMs;
    return nowMs >= this.freezeAtMs;
  }

  private endSegment(nowMs: number, note: string): void {
    const def = currentSegment();
    const session = perfSession();
    if (!def || !session) return;
    const cuts = def.cutVariant ? `${cutOverride.forcedCuts} cuts` : '';
    this.rows.push(this.samples.summary(def.id, PERF.percentile, note || cuts));
    this.samples = new SegmentSamples();
    if (session.index + 1 >= session.ids.length) {
      this.finish();
      return;
    }
    session.index++;
    this.phase = 'launch';
    this.phaseStartMs = nowMs;
    this.showLabel();
    // The results screen of the last segment goes away with the run that made it.
    if (this.game.scene.isActive(SCENES.results)) this.game.scene.stop(SCENES.results);
    launchRun(this.gameScene, CLASSIC_RUN);
  }

  private finish(): void {
    this.finished = true;
    cutOverride.setAlways(null);
    setFrameWorkListener(null);
    // Read before the session ends: the runs after the benchmark are normal ones.
    const fx = perfSession()?.params.fx ?? 'full';
    const header = `${this.header(fx)} ${formatAtlas(atlasPeak())}`;
    endPerfSession();
    const atlas = atlasPeak();
    const verdict = budgetVerdict(this.rows, this.automated);
    const budget = atlasOk(atlas) ? verdict : { ok: false, over: [...verdict.over, 'atlas'] };
    const table = `${formatTable(this.rows, PERF.overlay.decimals, this.automated)}\n${formatBudgetLine(budget)}`;
    this.publish({
      done: true,
      segment: null,
      fx,
      drawCallsCounted: this.drawTotal !== null,
      segments: this.rows,
      header,
      table,
      budget,
    });
    console.log(`[perf] ${JSON.stringify((window as PerfWindow).__tippyPerf)}`);
    console.log(`${header}\n${table}`);
    this.overlay?.table(`perf done, ${this.rows.length} segments`, `${header}\n${table}`);
  }

  /** The progress line: changes only between segments, so it costs the frames nothing. */
  private showLabel(): void {
    const session = perfSession();
    const id = currentSegment()?.id ?? null;
    if (!session) return;
    this.overlay?.progress(`perf ${session.index + 1}/${session.ids.length} ${id ?? '-'}`);
    this.publish({ done: false, segment: id });
  }

  private publish(report: PerfReport): void {
    (window as PerfWindow).__tippyPerf = report;
  }
}

/** Starts the benchmark director for a game whose session has begun (`beginPerfSession`). */
export function startPerfDirector(game: Phaser.Game): void {
  // The audio runs during the benchmark, so the numbers include the cost of sound.
  services.audio.unlock();
  new PerfDirector(game).start();
}
