import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { attachPressFeedback, type PressFeedback } from '../../ui/button';
import { CreatureCard, type CardState } from './creature-card';

/**
 * A creature card of the collection that can be tapped: press and release on the same card
 * (the pointer moved less than the tolerance) fires `onTap`. Pressing shrinks it like a button.
 */
export class CollectionTile extends CreatureCard {
  private baseScale = 1;
  private readonly hit: Phaser.Geom.Rectangle;
  private readonly press: PressFeedback;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    card: CardState,
    onTap: (tile: CollectionTile) => void,
  ) {
    super(scene, x, y, card);
    this.hit = new Phaser.Geom.Rectangle(0, 0, this.width, this.height);
    this.setInteractive(this.hit, Phaser.Geom.Rectangle.Contains);
    this.press = attachPressFeedback(this, {
      baseScale: () => this.baseScale,
      tolerancePx: MENU.collection.tapTolerancePx,
      onTap: () => onTap(this),
    });
  }

  /** The resting scale of the card (the grid may shrink it). */
  setBaseScale(scale: number): this {
    this.baseScale = scale;
    this.setScale(scale);
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (enabled) this.setInteractive(this.hit, Phaser.Geom.Rectangle.Contains);
    else {
      this.press.cancel();
      this.disableInteractive();
    }
    return this;
  }
}
