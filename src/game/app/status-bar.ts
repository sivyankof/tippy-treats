import * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService, BarIcons } from '../../services/app-shell/types';
import { contrastRatio } from '../../util/color';

const cfg = APP_SHELL.statusBar;
const WHITE = 0xffffff;
const BLACK = 0x000000;

/** The dark veils that dim the screen under a window (`createDimOverlay`), while they exist. */
const veils = new Set<Phaser.GameObjects.Rectangle>();
/** The colour at the top of the run sky, per run scene that shows one. */
const skies = new Map<Phaser.Scene, () => number>();

/** Counts a dark veil while it exists; it stops counting when it is destroyed. */
export function watchVeil<T extends Phaser.GameObjects.Rectangle>(veil: T): T {
  veils.add(veil);
  veil.once(Phaser.GameObjects.Events.DESTROY, () => veils.delete(veil));
  return veil;
}

/** A run scene tells what colour stands at the top of its sky, until the scene shuts down. */
export function watchRunSky(scene: Phaser.Scene, topColor: () => number): void {
  skies.set(scene, topColor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => skies.delete(scene));
}

/** Icons that read best over `color`: the one of white and black with more contrast. */
export function barIconsOver(color: number): BarIcons {
  return contrastRatio(color, WHITE) >= contrastRatio(color, BLACK) ? 'light' : 'dark';
}

/** On screen: running or paused under a window, and not hidden or asleep. */
function onShow(scene: Phaser.Scene): boolean {
  const sys = scene.sys;
  return sys.isVisible() && (sys.isActive() || sys.isPaused());
}

function veilDims(veil: Phaser.GameObjects.Rectangle): boolean {
  return (
    veil.visible &&
    veil.alpha * veil.fillAlpha >= cfg.veilDarkness &&
    veil.scene !== undefined &&
    onShow(veil.scene)
  );
}

/**
 * What the top of the screen is now: a dimmed screen (pause, a window, the results) and a dark
 * run sky (Stars, Space, a night or a storm) want light icons; the menus (the bright kitchen) and
 * a light sky want dark ones.
 */
export function currentBarIcons(): BarIcons {
  for (const veil of veils) if (veilDims(veil)) return 'light';
  for (const [scene, topColor] of skies) if (onShow(scene)) return barIconsOver(topColor());
  return 'dark';
}

/**
 * Lets a new colour through only after `holdChecks` looks in a row agree on it (the first look
 * goes through at once): a window that opens and closes in a moment does not blink the bar.
 */
export class BarIconsHold {
  private shown: BarIcons | null = null;
  private pending: BarIcons | null = null;
  private count = 0;

  constructor(private readonly holdChecks: number) {}

  /** The icons to set now, `null` while nothing changes. */
  next(seen: BarIcons): BarIcons | null {
    if (this.shown === null || seen === this.shown) {
      const first = this.shown === null;
      this.shown = seen;
      this.pending = null;
      this.count = 0;
      return first ? seen : null;
    }
    if (seen !== this.pending) {
      this.pending = seen;
      this.count = 0;
    }
    this.count++;
    if (this.count < this.holdChecks) return null;
    this.shown = seen;
    this.pending = null;
    this.count = 0;
    return seen;
  }
}

/** Keeps the colour of the status bar icons in step with the screen (the app only; the browser keeps its own). */
export function followStatusBar(shell: AppShellService, read = currentBarIcons): () => void {
  if (!shell.native) return () => undefined;
  const hold = new BarIconsHold(cfg.holdChecks);
  const check = (): void => {
    const icons = hold.next(read());
    if (icons) shell.setBarIcons(icons);
  };
  check();
  const timer = setInterval(check, cfg.checkMs);
  return () => clearInterval(timer);
}
