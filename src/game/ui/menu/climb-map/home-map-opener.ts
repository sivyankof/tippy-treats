import type * as Phaser from 'phaser';
import { openMapFromHome } from './climb-map-window';
import { ScreenCover } from './screen-cover';

/**
 * The climb map of Home: one at a time (also while it is closing), and Home is not drawn under it
 * while the window stands fully open (`docs/07-ui-screens.md`, section 2.3).
 */
export class HomeMapOpener {
  private open = false;
  private readonly cover = new ScreenCover();

  /** `parts` are the screen's parts to hide; `scenery` its backdrop. */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parts: () => readonly unknown[],
    private readonly scenery: { setVisible(visible: boolean): unknown },
  ) {}

  /** A tap on the record plate (or the first-tower call). */
  readonly show = (): void => {
    if (this.open) return;
    this.open = true;
    openMapFromHome(
      this.scene,
      () => {
        this.open = false;
        this.coverScreen(false);
      },
      (covered) => this.coverScreen(covered),
    );
  };

  private coverScreen(covered: boolean): void {
    if (covered) this.cover.hide(this.parts());
    else this.cover.restore();
    this.scenery.setVisible(!covered);
  }
}
