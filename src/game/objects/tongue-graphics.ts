import * as Phaser from 'phaser';
import { LICK } from '../../data/glaze/lick';
import { drawTongueBody, drawTongueTip } from './tongue-draw';
import type { Ribbon } from './tongue-ribbon';

/** The parts a tongue is drawn with: the body under the saliva drop that hangs from the tip, and the tip over it. */
export interface TongueParts {
  /** Samples per piece of the body the ribbon is cut into for these parts. */
  readonly sub: number;
  readonly under: readonly Phaser.GameObjects.GameObject[];
  readonly over: readonly Phaser.GameObjects.GameObject[];
  /** Shows the tongue along the ribbon `r`. */
  lay(r: Ribbon): void;
  /** The tongue is in. */
  hide(): void;
  /** None of the parts has been destroyed. */
  readonly alive: boolean;
}

/** The tongue redrawn by two `Graphics` every frame: the fallback where the renderer has no strips (Canvas). */
export class GraphicsTongue implements TongueParts {
  private readonly trunk: Phaser.GameObjects.Graphics;
  private readonly tip: Phaser.GameObjects.Graphics;
  readonly under: readonly Phaser.GameObjects.GameObject[];
  readonly over: readonly Phaser.GameObjects.GameObject[];
  readonly sub = LICK.tongue.draw.sub;

  constructor(scene: Phaser.Scene) {
    this.trunk = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.tip = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.under = [this.trunk];
    this.over = [this.tip];
  }

  lay(r: Ribbon): void {
    this.trunk.setVisible(true);
    this.tip.setVisible(true);
    drawTongueBody(this.trunk, r);
    drawTongueTip(this.tip, r);
  }

  hide(): void {
    this.trunk.setVisible(false);
    this.tip.setVisible(false);
  }

  get alive(): boolean {
    return !this.trunk.isDestroyed && !this.tip.isDestroyed;
  }
}
