import * as Phaser from 'phaser';
import { TimingBot } from '../../core/bot';
import { Rng } from '../../core/rng';
import { TowerSim, type FlyingLayer, type SimEvent, type SimPhase } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { readDebugParams } from '../../util/debug-params';
import { randomSeed } from '../../util/math';
import { FallingPieces } from '../fx/falling-piece';
import { Background } from '../objects/background';
import { FlyingLayerView } from '../objects/flying-layer-view';
import { TowerView } from '../objects/tower-view';
import { SCENES, type ResultsData } from '../scene-keys';
import { isOverUi } from '../ui/ui-regions';

/** World y of the tray surface; the tower grows towards negative y. */
const TRAY_TOP_Y = 0;

/** Read-only snapshot of the run for the HUD and the debug panel. */
export interface RunInfo {
  height: number;
  score: number;
  wobble: number;
  seed: number;
  phase: SimPhase;
  flyingSpeed: number | null;
  paused: boolean;
}

type FlyingMemo = Pick<FlyingLayer, 'x' | 'width' | 'index'>;

export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  private bot: TimingBot | null = null;
  private seed = 0;
  private tower!: TowerView;
  private flyingView!: FlyingLayerView;
  private pieces!: FallingPieces;
  private background!: Background;
  private lastFlying: FlyingMemo | null = null;
  private resultsQueued = false;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    const debug = readDebugParams();
    this.seed = debug.seed ?? randomSeed();
    this.sim = new TowerSim({
      seed: this.seed,
      mode: 'classic',
      team: [null, null, null],
      tutorial: false,
      startHeight: debug.start ?? 0,
    });
    this.bot = debug.bot ? new TimingBot(debug.bot, new Rng(this.seed).fork('bot')) : null;
    this.lastFlying = null;
    this.resultsQueued = false;

    const { width, height } = this.scale.gameSize;
    this.background = new Background(this, TRAY_TOP_Y, width, height);
    this.tower = new TowerView(this, TRAY_TOP_Y);
    this.flyingView = new FlyingLayerView(this, this.tower);
    this.pieces = new FallingPieces(this);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-SPACE', this.onDropKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    // Sync once so the tower height is known, then jump the camera to its target.
    this.render(0, 0);
    this.cameras.main.setScroll(0, this.targetScrollY());
    this.background.update(this.cameras.main.scrollY);
  }

  override update(time: number, delta: number): void {
    const flying = this.sim.state.flying;
    this.lastFlying = flying ? { x: flying.x, width: flying.width, index: flying.index } : null;

    const events = this.sim.update(delta);
    this.bot?.observe(events);
    if (this.bot?.shouldDrop(this.sim)) events.push(...this.sim.drop());
    // The continue offer arrives in a later stage: for now the run simply ends.
    if (this.sim.state.phase === 'await_continue') events.push(...this.sim.decline());

    this.handleEvents(events);
    this.pieces.update(delta);
    this.render(time, delta);
  }

  getRunInfo(): RunInfo | null {
    if (!this.sim) return null;
    const s = this.sim.state;
    return {
      height: s.height,
      score: s.score,
      wobble: s.wobble,
      seed: this.seed,
      phase: s.phase,
      flyingSpeed: s.flying?.speed ?? null,
      paused: this.sys.isPaused(),
    };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (isOverUi(pointer.x, pointer.y)) return;
    this.sim.drop();
  }

  private onDropKey(event: KeyboardEvent): void {
    // Holding the key must not drop every new layer the moment it appears.
    if (event.repeat) return;
    this.sim.drop();
  }

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
  }

  private handleEvents(events: readonly SimEvent[]): void {
    const memo = this.lastFlying;
    let landed = false;
    for (const event of events) {
      switch (event.type) {
        case 'land':
          landed = true;
          if (memo && event.cutSide && event.cutWidth > 0) {
            const side = event.cutSide === 'right' ? 1 : -1;
            const x = memo.x + side * (memo.width / 2 - event.cutWidth / 2);
            this.pieces.spawn(
              memo.index,
              x,
              this.tower.layerCenterY(memo.index - 1),
              event.cutWidth,
              side,
              ANIM.bite,
            );
          }
          break;
        case 'miss':
          // A sneeze that leaves too little cake follows a landing: nothing falls past the tower.
          if (memo && !landed) {
            const side = memo.x >= this.tower.topViewX() ? 1 : -1;
            this.pieces.spawn(
              memo.index,
              memo.x,
              this.tower.layerCenterY(memo.index - 1),
              memo.width,
              side,
              ANIM.miss,
            );
          }
          break;
        case 'wobble_sneeze':
          this.tower.sync(this.sim.state, this.cameraBottomY());
          this.tower.squashTop();
          break;
        case 'run_over':
          this.queueResults(event.result);
          break;
        default:
          break;
      }
    }
  }

  private queueResults(result: ResultsData['result']): void {
    if (this.resultsQueued) return;
    this.resultsQueued = true;
    this.time.delayedCall(ANIM.results.delayMs, () => {
      const data: ResultsData = { result };
      this.scene.launch(SCENES.results, data);
    });
  }

  private render(timeMs: number, deltaMs: number): void {
    this.tower.sync(this.sim.state, this.cameraBottomY());
    this.flyingView.sync(this.sim.state, timeMs);
    const camera = this.cameras.main;
    // Frame-rate independent smoothing towards the target.
    const k = 1 - Math.pow(1 - ANIM.camera.followLerp, deltaMs / ANIM.camera.referenceFrameMs);
    camera.scrollY += (this.targetScrollY() - camera.scrollY) * k;
    this.background.update(camera.scrollY);
  }

  /** World y of the bottom edge of the screen. */
  private cameraBottomY(): number {
    return this.cameras.main.scrollY + this.scale.gameSize.height;
  }

  /**
   * Scroll that keeps the tray low at the start and later shows as many layers as fit
   * while the whole flying layer (with its bob) stays below the HUD.
   */
  private targetScrollY(): number {
    const screenH = this.scale.gameSize.height;
    const start = TRAY_TOP_Y - (screenH - ANIM.camera.trayBottomOffset);
    const flyingReach =
      BALANCE.layer.gapAboveTower + BALANCE.layer.height + ANIM.flying.bobAmplitude;
    const surfaceScreenY = Math.max(
      screenH - ANIM.camera.visibleLayers * BALANCE.layer.height,
      HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance + flyingReach,
    );
    return Math.min(start, this.tower.topY() - surfaceScreenY);
  }
}
