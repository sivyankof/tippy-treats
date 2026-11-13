import type * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { BALANCE } from '../../../data/balance';
import { oscillate01 } from '../../../util/math';
import { DEPTH } from '../../depth';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import type { AbilityBursts } from './ability-bursts';
import { ABILITY_TEXTURES } from './ability-textures';
import {
  bubbleInputFor,
  nextBubblePhase,
  type BubbleInput,
  type BubblePhase,
} from './active-state';

const cfg = ABILITY_ANIM.active.shield;
const popIn = easeFn(cfg.popInEase);

/** Where the bubble sits: the top layer of the tower. */
export interface BubbleTarget {
  x: number;
  width: number;
  /** World y of the top surface. */
  surfaceY: number;
}

/** The brownie's chocolate bubble around the top of the tower: it pops on a shielded miss and melts when it runs out. */
export class ShieldBubble {
  /** The chocolate behind the tower and the rim in front of it: they move as one bubble. */
  private readonly fill: Phaser.GameObjects.Image;
  private readonly rim: Phaser.GameObjects.Image;
  private phase: BubblePhase = 'idle';
  private ageMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly bursts: AbilityBursts,
  ) {
    this.fill = scene.add
      .image(0, 0, ABILITY_TEXTURES.bubbleFill)
      .setDepth(DEPTH.bubbleBack)
      .setVisible(false);
    this.rim = scene.add
      .image(0, 0, ABILITY_TEXTURES.bubbleRim)
      .setDepth(DEPTH.bubble)
      .setVisible(false);
  }

  get shown(): boolean {
    return this.phase !== 'idle';
  }

  /** The shield caught a miss. */
  pop(target: BubbleTarget): void {
    if (this.phase !== 'on' && this.phase !== 'melting') return;
    this.step('pop');
    const y = target.surfaceY + BALANCE.layer.height * cfg.centerLayers;
    this.bursts.cone(
      target.x,
      y,
      0,
      cfg.popChips.count,
      cfg.popChips.style,
      FX_TEXTURES.crumb,
      cfg.chipColors,
    );
  }

  /** The shield ran out. */
  melt(target: BubbleTarget): void {
    if (this.phase !== 'on') return;
    this.step('melt');
    const y = target.surfaceY + BALANCE.layer.height * (cfg.centerLayers + cfg.heightLayers / 2);
    this.bursts.edges(
      target.x,
      y,
      target.width + cfg.padX,
      cfg.meltDrips.count,
      cfg.meltDrips.style,
      FX_TEXTURES.drop,
      cfg.chipColors,
    );
  }

  /**
   * Shows the bubble while there is a shield; plays the end of a pop or a melt. When the run
   * stops (`running` false) a shown bubble melts away instead of vanishing.
   */
  update(
    dtMs: number,
    timeMs: number,
    shield: boolean,
    running: boolean,
    target: BubbleTarget,
  ): void {
    const input = bubbleInputFor(shield, running);
    if (input === 'melt') this.melt(target);
    else this.step(input);
    if (this.phase === 'idle') {
      this.fill.setVisible(false);
      this.rim.setVisible(false);
      return;
    }
    this.ageMs += dtMs;

    const height = BALANCE.layer.height;
    const width = target.width + cfg.padX * 2;
    const tall = height * cfg.heightLayers;
    let scaleX = 1;
    let scaleY = 1;
    let alpha = cfg.alpha;
    let drop = 0;
    switch (this.phase) {
      case 'on': {
        const grow = popIn(Math.min(1, this.ageMs / cfg.popInMs));
        const breathe = 1 + cfg.pulse * (oscillate01(timeMs, cfg.pulsePeriodMs) * 2 - 1);
        scaleX = scaleY = grow * breathe;
        break;
      }
      case 'popping': {
        const t = Math.min(1, this.ageMs / cfg.popMs);
        scaleX = scaleY = 1 + (cfg.popScale - 1) * t;
        alpha *= 1 - t;
        if (t >= 1) this.step('done');
        break;
      }
      case 'melting': {
        const t = Math.min(1, this.ageMs / cfg.meltMs);
        scaleY = 1 - (1 - cfg.meltScaleY) * t;
        drop = ((1 - scaleY) * tall) / 2;
        alpha *= 1 - t;
        if (t >= 1) this.step('done');
        break;
      }
    }
    const y = target.surfaceY + height * cfg.centerLayers + drop;
    for (const image of [this.fill, this.rim]) {
      image
        .setVisible(true)
        .setPosition(target.x, y)
        .setDisplaySize(width * scaleX, tall * scaleY)
        .setAlpha(alpha);
    }
  }

  private step(input: BubbleInput): void {
    const before = this.phase;
    this.phase = nextBubblePhase(before, input);
    if (this.phase !== before) this.ageMs = 0;
  }
}
