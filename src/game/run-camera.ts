import type * as Phaser from 'phaser';
import { ANIM } from '../data/anim';
import { frameLerp } from '../util/math';
import { targetScrollY, trayScrollY } from './camera-layout';
import type { CameraInfo, RunFx } from './fx/run-fx';
import type { Backdrop } from './objects/backdrop/backdrop';
import type { WorldEntry } from './ui/transition';

/** The camera of a run: follows the tower top, shakes with the effects and drops in at the start. */
export class RunCamera {
  /** Camera scroll before the landing kick is added. */
  private scrollBase = 0;
  /** The world drops in from above when the run starts. */
  private entry: WorldEntry = { offset: 0 };
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
    this.scrollBase = this.targetScrollY();
    this.apply();
  }

  /** Follows the target, or the collapse scroll while the tower falls apart. */
  follow(delta: number): void {
    const collapseScroll = this.fx.collapseScroll;
    if (collapseScroll !== null) {
      this.scrollBase = collapseScroll;
    } else {
      const k = frameLerp(ANIM.camera.followLerp, delta);
      this.scrollBase += (this.targetScrollY() - this.scrollBase) * k;
    }
    this.apply();
  }

  /** The kick pushes the view down, which means the camera moves up; the entry lifts the world. */
  private apply(): void {
    const camera = this.scene.cameras.main;
    camera.scrollY = this.scrollBase - this.fx.cameraOffset + this.entry.offset;
    this.background.update(camera.scrollY);
  }

  targetScrollY(): number {
    return targetScrollY(this.trayTopY, this.scene.scale.gameSize.height, this.fx.tower.topY());
  }
}
