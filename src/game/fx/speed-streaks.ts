import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import { scatter } from '../objects/creature-art/primitives';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { burstBoost, streakEnvelope } from './streak-math';
import { createTreasureTextures, TREASURE_TEXTURES } from './treasure-textures';

const cfg = RULE_ANIM.streaks;
const NEVER = -Infinity;

/**
 * Thin streaks that run off the back edge of a fast layer: all of them in a rush dash, more
 * and brighter the faster the roof wind blows. A fixed set of pictures, each on its own cycle.
 */
export class SpeedStreaks {
  private readonly streaks: Phaser.GameObjects.Image[] = [];
  private burstAtMs = NEVER;

  constructor(scene: Phaser.Scene) {
    createTreasureTextures(scene);
    for (let i = 0; i < cfg.count; i++) {
      this.streaks.push(
        scene.add
          .image(0, 0, TREASURE_TEXTURES.streak)
          .setDepth(FLYING_FX_DEPTH.behind)
          .setVisible(false),
      );
    }
  }

  /** A rush lets go: the streaks fly out longer and farther for a moment. */
  burst(timeMs: number): void {
    this.burstAtMs = timeMs;
  }

  /** `strength` is 0 for none up to 1; (x, y) is the layer centre and `dir` the way it flies. */
  update(
    strength: number,
    kind: 'rush' | 'wind',
    x: number,
    y: number,
    width: number,
    dir: 1 | -1,
    timeMs: number,
  ): void {
    const shown = strength > 0 ? Math.ceil(strength * cfg.count) : 0;
    const tint = kind === 'rush' ? RULE_ANIM.colors.rushStreak : RULE_ANIM.colors.windStreak;
    const peak = (kind === 'rush' ? cfg.rushAlpha : cfg.windAlpha) * strength;
    const envelope = kind === 'rush' ? cfg.rushEnvelope : cfg.windEnvelope;
    const boost = kind === 'rush' ? burstBoost(timeMs - this.burstAtMs) : 0;
    const [shortest, longest] = cfg.lengthShare;
    const backX = x - (dir * width) / 2;
    for (let i = 0; i < this.streaks.length; i++) {
      const streak = this.streaks[i];
      if (!streak) continue;
      const visible = i < shown;
      streak.setVisible(visible);
      if (!visible) continue;
      const run = (timeMs / cfg.cyclePeriodMs + i / cfg.count) % 1;
      const lane = scatter(i) - 0.5;
      streak
        .setTint(tint)
        .setFlipX(dir === -1)
        .setOrigin(dir === 1 ? 1 : 0, 0.5)
        .setPosition(
          backX - dir * run * cfg.travelPx * (1 + boost * cfg.burst.travelBoost),
          y + lane * cfg.spreadShare * BALANCE.layer.height,
        )
        .setScale((shortest + (longest - shortest) * run) * (1 + boost * cfg.burst.lengthBoost), 1)
        .setAlpha(peak * streakEnvelope(run, envelope));
    }
  }
}
