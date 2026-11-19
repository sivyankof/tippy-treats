import { fxGuard } from './fx-guard';
import type * as Phaser from 'phaser';
import { ANIM } from '../data/common/anim';
import { frameLerp } from '../util/math';
import { targetScrollY, trayScrollY } from './camera-layout';
import type { CameraInfo, RunFx } from './fx/run/run-fx';
import type { RunIntro } from './fx/run/run-intro';
import type { Backdrop } from './objects/backdrop/backdrop';
import type { WorldEntry } from './ui/transition';

/** The camera of a run: follows the tower top, shakes with the effects and drops in at the start. */
export class RunCamera {
  /** Camera scroll before the landing kick is added. */
  private scrollBase = 0;
  /** The world drops in from above when the run starts. */
  private entry: WorldEntry = { offset: 0 };
  /** The rise along a pre-built tower at the start of a run; `null` once it is over. */
  private intro: RunIntro | null = null;
  private readonly info: CameraInfo = { scrollY: 0, trayScrollY: 0, width: 0, height: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: RunFx,
    private readonly background: Backdrop,
    /** World y of the tray surface. */
    private readonly trayTopY: number,
  ) {}

  setEntry(entry: WorldEntry): void {
    this.entry = entry;
  }

  /** The run waits while the camera rises along the pre-built tower. */
  get introActive(): boolean {
    return this.intro !== null;
  }

  /** Starts the rise: the camera shows the tray and the built tower above it, then rises to the top. */
  startIntro(intro: RunIntro): void {
    if (!intro.active) return;
    this.intro = intro;
    this.fx.setIntroView(true);
    this.snap();
  }

  /** The camera as the effects need it. One object is reused: it is refreshed on every call. */
  cameraInfo(): CameraInfo {
    const { width, height } = this.scene.scale.gameSize;
    const info = this.info;
    info.scrollY = this.scrollBase;
    info.trayScrollY = trayScrollY(this.trayTopY, height);
    info.width = width;
    info.height = height;
    return info;
  }

  /** Jumps to the target without easing. */
  snap(): void {
    this.scrollBase = this.introScroll() ?? this.targetScrollY();
    this.apply();
  }

  /** Follows the target, or the collapse scroll while the tower falls apart. */
  follow(delta: number): void {
    const collapseScroll = this.fx.collapseScroll;
    if (collapseScroll !== null) {
      this.scrollBase = collapseScroll;
    } else if (this.intro) {
      this.intro.tick(delta);
      this.scrollBase = this.introScroll() ?? this.targetScrollY();
      if (!this.intro.active) this.endIntro();
    } else {
      const k = frameLerp(ANIM.camera.followLerp, delta);
      this.scrollBase += (this.targetScrollY() - this.scrollBase) * k;
    }
    this.apply();
  }

  private introScroll(): number | null {
    if (!this.intro) return null;
    const { height } = this.scene.scale.gameSize;
    return this.intro.scroll(trayScrollY(this.trayTopY, height), this.targetScrollY());
  }

  private endIntro(): void {
    this.intro = null;
    this.fx.setIntroView(false);
  }

  /** The kick pushes the view down, which means the camera moves up; the entry lifts the world. */
  private apply(): void {
    const camera = this.scene.cameras.main;
    camera.scrollY = this.scrollBase - this.fx.cameraOffset + this.entry.offset;
    fxGuard.call('backdrop', this.background, this.background.update, camera.scrollY);
  }

  targetScrollY(): number {
    return targetScrollY(this.trayTopY, this.scene.scale.gameSize.height, this.fx.tower.topY());
  }
}
