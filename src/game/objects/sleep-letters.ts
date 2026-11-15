import type * as Phaser from 'phaser';
import { CREATURE_SLEEP } from '../../data/creature-style';
import { createOutlinedText } from '../ui/outlined-text';
import { zPose, type ZPose } from './sleep-zs';

/** Where the floating letters start and how far they reach, in the parent's pixels. */
export interface LettersPlacement {
  x: number;
  y: number;
  /** Multiplies the horizontal and vertical reach of the loop. */
  reachX: number;
  reachY: number;
  /** Multiplies the size of every letter. */
  scale: number;
  /** Letters from this index on stay hidden (a still frame shows them all or none). */
  shown?: number;
}

/**
 * The floating "z" letters of a sleeper: one loop of `CREATURE_SLEEP.zs`, driven by `tick` (no
 * tween). Used by the sleeping silhouette and the sleeping oven. The letters go into `parent`.
 */
export class SleepLetters {
  private readonly letters: Phaser.GameObjects.Text[] = [];
  private readonly pose: ZPose = { x: 0, y: 0, alpha: 0, scale: 0 };
  private timeMs: number;

  /** `fonts` is the font size of each letter; `startMs` is where in the loop the letters begin. */
  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    fonts: readonly number[],
    color: number,
    startMs = 0,
  ) {
    this.timeMs = startMs;
    for (const font of fonts) {
      const letter = createOutlinedText(scene, 0, 0, CREATURE_SLEEP.zs.glyph, font, color);
      this.letters.push(letter);
      parent.add(letter);
    }
  }

  /** Moves the loop on; call `place` after it. */
  tick(dtMs: number): void {
    this.timeMs += dtMs;
  }

  /** Jumps to a point of the loop (a still frame). */
  setTime(timeMs: number): void {
    this.timeMs = timeMs;
  }

  place(at: LettersPlacement): void {
    const shown = at.shown ?? this.letters.length;
    this.letters.forEach((letter, i) => {
      const p = zPose(this.timeMs, i, this.pose);
      letter
        .setPosition(at.x + p.x * at.reachX, at.y + p.y * at.reachY)
        .setScale(p.scale * at.scale)
        .setAlpha(i < shown ? p.alpha : 0);
    });
  }
}
