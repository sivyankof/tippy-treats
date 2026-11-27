import * as Phaser from 'phaser';
import type { RunGoal } from '../../../core/run/result-goal';
import type { TowerState } from '../../../core/tower/tower-sim';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { GOAL_LINE } from '../../../data/run/goal-line';
import { BALANCE } from '../../../data/tower/balance';
import { formatNumber, t } from '../../../i18n';
import { mixColor } from '../../../util/color';
import { effectsMode } from '../../app/effects-mode';
import { DEPTH } from '../../common/depth';
import type { TowerView } from '../../objects/tower/tower-view';
import { bakePadded, bakeTexture } from '../../ui/common/bake-texture';
import { createOutlinedText } from '../../ui/common/outlined-text';
import { MENU } from '../../../data/common/menu-layout';
import { shade } from '../../../util/color';
import {
  bakeVolume,
  drawVolume,
  lookOf,
  shadowMargin,
  type VolumeArt,
} from '../../ui/style/volume';
import type { Particles } from '../common/particles';
import { starBurst } from '../common/sparkle-fx';
import { freeRoom, pennantSide } from './pennant-side';
import {
  appearView,
  passView,
  pennantOffset,
  pennantWaits,
  pennantX,
  swayView,
} from './goal-line-phase';
import { GoalSequence } from './goal-sequence';

const flag = CONTINUE_ANIM.flag;
const plate = GOAL_LINE.plate;
const LINE_TEXTURE = 'fx_goal_line';
const PLATE_LOOK = lookOf('button', plate.radius);
const S_OUTLINE_SHADE = MENU.style.outlineShade;

/** Picture height of the line: the dash and the room its shadow takes under it. */
const LINE_BODY_HEIGHT =
  flag.lineHeight + GOAL_LINE.lineLook.shadow.offset + GOAL_LINE.lineLook.shadow.spread;

/** Bakes the dashed line: volumetric dashes with a shadow, grey so the kind of goal tints them. */
export function bakeGoalLine(scene: Phaser.Scene): void {
  const { rim, face, gloss, shadow } = GOAL_LINE.lineLook;
  const h = flag.lineHeight;
  bakePadded(scene, LINE_TEXTURE, LOGICAL_SIZE.width, LINE_BODY_HEIGHT, GOAL_LINE.linePad, (g) => {
    for (
      let x = shadow.spread;
      x + flag.dashLength + shadow.spread <= LOGICAL_SIZE.width;
      x += flag.dashLength + flag.dashGap
    ) {
      g.fillStyle(0x000000, shadow.alpha / shadow.steps);
      for (let i = 0; i < shadow.steps; i++) {
        const grow = (shadow.spread * (shadow.steps - i)) / shadow.steps;
        g.fillRoundedRect(
          x - grow,
          shadow.offset - grow,
          flag.dashLength + grow * 2,
          h + grow * 2,
          h / 2 + grow,
        );
      }
      g.fillStyle(rim.color, 1);
      g.fillRoundedRect(x, 0, flag.dashLength, h, h / 2);
      const inner = h - rim.width * 2;
      g.fillStyle(face, 1);
      g.fillRoundedRect(
        x + rim.width,
        rim.width,
        flag.dashLength - rim.width * 2,
        inner,
        inner / 2,
      );
      g.fillStyle(gloss.color, 1);
      g.fillRoundedRect(
        x + gloss.inset,
        rim.width + 1,
        flag.dashLength - gloss.inset * 2,
        gloss.height,
        gloss.height / 2,
      );
    }
  });
}

/** A baked pennant and where the middle of its body lies in the picture. */
export interface PlateArt extends VolumeArt {
  /** Origin that puts the middle of the body at the image position. */
  originX: number;
  originY: number;
}

const tail = plate.tail;

/** Bakes the pennant `width` wide in light neutral tones (the tint gives it its colour). */
export function bakeGoalPlate(scene: Phaser.Scene, width: number): PlateArt {
  const art = bakeVolume(scene, `fx_goal_pennant_${width}`, width, plate.height, PLATE_LOOK, {
    fill: plate.face,
  });
  return {
    ...art,
    originX: (art.left + width / 2) / art.textureWidth,
    originY: (art.top + plate.height / 2) / art.textureHeight,
  };
}

/** The same pennant with a small pointer on its top edge, for the time it waits under the HUD away from its line. */
export function bakeGoalPlateTail(scene: Phaser.Scene, width: number): PlateArt {
  const look = PLATE_LOOK;
  const m = shadowMargin(look);
  const key = `fx_goal_pennant_tail_${width}`;
  const art: VolumeArt = {
    key,
    textureWidth: width + m.side * 2,
    textureHeight: plate.height + m.top + m.bottom + tail.height,
    left: m.side,
    top: m.top + tail.height,
  };
  bakeTexture(scene, key, art.textureWidth, art.textureHeight, (g) => {
    drawVolume(g, art.left, art.top, width, plate.height, look, { fill: plate.face });
    // The pointer: a dark triangle, then a lighter one inside it, its base sunk into the body so no seam shows.
    const cx = art.left + width / 2;
    const base = art.top + look.outline;
    const half = tail.width / 2;
    g.fillStyle(shade(plate.face, S_OUTLINE_SHADE), 1);
    g.fillTriangle(cx - half, base + 1, cx + half, base + 1, cx, art.top - tail.height);
    const inset = look.outline * 1.6;
    g.fillStyle(plate.face, 1);
    g.fillTriangle(
      cx - half + inset,
      base + 2,
      cx + half - inset,
      base + 2,
      cx,
      art.top - tail.height + inset * 1.6,
    );
  });
  return {
    ...art,
    originX: (art.left + width / 2) / art.textureWidth,
    originY: (art.top + plate.height / 2) / art.textureHeight,
  };
}

/**
 * The line of the player's own result inside a run (docs/04, section 6): one dashed line behind
 * the tower and one pennant over it, standing on the nearest goal above the tower. Everything is
 * made when the run loads; the animations are computed from time every frame.
 */
export class GoalLine {
  private readonly line: Phaser.GameObjects.Image;
  private readonly pennant: Phaser.GameObjects.Container;
  private readonly plateImage: Phaser.GameObjects.Image;
  private readonly plainArt: PlateArt;
  private readonly tailArt: PlateArt;
  private waiting = false;
  private readonly labels: Phaser.GameObjects.Text[];
  private readonly plateWidth: number;
  private readonly seq: GoalSequence;
  private shown: RunGoal | null = null;
  /** Side of the screen the pennant stands at: 1 right, -1 left. */
  private side: 1 | -1 = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly particles: Particles,
    private readonly goals: readonly RunGoal[],
    startHeight: number,
  ) {
    bakeGoalLine(scene);
    this.labels = goals.map((goal) =>
      createOutlinedText(
        scene,
        0,
        -PLATE_LOOK.bevel / 2,
        t(`run.goal.${goal.kind}`, { n: formatNumber(goal.height) }),
        plate.font,
      ).setVisible(false),
    );
    const widest = Math.max(...this.labels.map((label) => label.width));
    this.plateWidth = Math.ceil(widest + plate.padX * 2);
    this.plainArt = bakeGoalPlate(scene, this.plateWidth);
    this.tailArt = bakeGoalPlateTail(scene, this.plateWidth);
    this.plateImage = new Phaser.GameObjects.Image(scene, 0, 0, this.plainArt.key).setOrigin(
      this.plainArt.originX,
      this.plainArt.originY,
    );
    this.line = scene.add
      .image(-GOAL_LINE.linePad, 0, LINE_TEXTURE)
      .setOrigin(
        0,
        (GOAL_LINE.linePad + flag.lineHeight / 2) / (LINE_BODY_HEIGHT + GOAL_LINE.linePad * 2),
      )
      .setDepth(DEPTH.recordFlag)
      .setVisible(false);
    // The pennant is its own object: the line stays behind the tower, the pennant reads over it.
    this.pennant = scene.add
      .container(0, 0, [this.plateImage, ...this.labels])
      .setDepth(DEPTH.recordPennant)
      .setVisible(false);
    this.seq = new GoalSequence(goals, startHeight);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.line.destroy();
      this.pennant.destroy();
    });
  }

  /** `dtMs` is visual time; `timeMs` drives the waves. */
  update(dtMs: number, timeMs: number, state: Readonly<TowerState>, scrollY: number): void {
    const level = effectsMode.level;
    const passedNow = this.seq.update(dtMs, state.height, level);
    const goal = this.seq.goal;
    if (!goal) {
      this.line.setVisible(false);
      this.pennant.setVisible(false);
      return;
    }
    if (goal !== this.shown) this.show(goal);
    const y = this.tower.trayTopY - (goal.height - state.bonusHeight) * BALANCE.layer.height;
    this.side = pennantSide(this.side, freeRoom(state, goal.height));
    const sway = swayView(timeMs, level);
    const colors = GOAL_LINE.colors[goal.kind];
    let alpha: number;
    let lineAlpha: number;
    let scale: number;
    let hopY = 0;
    let tint: number = colors.plate;
    if (this.seq.passing) {
      const pass = passView(this.seq.ageMs, goal.kind, level);
      alpha = pass.alpha;
      lineAlpha = pass.alpha;
      scale = pass.scale;
      hopY = pass.hopY;
      tint = mixColor(colors.plate, plate.flashTint, pass.tintMix);
    } else {
      const appear = appearView(this.seq.ageMs, level);
      alpha = appear.plateAlpha;
      lineAlpha = appear.lineAlpha;
      scale = appear.plateScale;
    }
    const [low, high] = flag.lineAlpha;
    this.line
      .setPosition(-GOAL_LINE.linePad, y)
      .setAlpha((low + (high - low) * sway.pulse) * lineAlpha)
      .setVisible(true);
    const pennantY = y + pennantOffset(y - scrollY, plate.height) + sway.bob * flag.bobDistance;
    // A swollen pennant grows towards the middle of the screen, so it never leaves the screen edge.
    const x =
      pennantX(this.side, this.plateWidth) - (this.side * this.plateWidth * (scale - 1)) / 2;
    this.plateImage.setTint(tint);
    this.showTail(pennantWaits(y - scrollY, plate.height));
    this.pennant
      .setPosition(x, pennantY + hopY)
      .setAngle(sway.wave * flag.waveDeg * this.side)
      .setScale(scale, scale * (1 + flag.waveStretch * sway.wave))
      .setAlpha(alpha)
      .setVisible(true);
    if (passedNow && level === 'full' && goal.kind !== 'record') {
      starBurst(
        this.particles,
        x,
        pennantY - GOAL_LINE.joy.lift,
        GOAL_LINE.joy.sparkles,
        -90,
        GOAL_LINE.joy.style,
        GOAL_LINE.joy.tints,
      );
    }
  }

  /** Swaps the picture of the pennant between the plain one and the one with the pointer (no new objects). */
  private showTail(waiting: boolean): void {
    if (waiting === this.waiting) return;
    this.waiting = waiting;
    const art = waiting ? this.tailArt : this.plainArt;
    this.plateImage.setTexture(art.key).setOrigin(art.originX, art.originY);
  }

  /** Puts the label and the colours of `goal` on the line. */
  private show(goal: RunGoal): void {
    this.shown = goal;
    const index = this.goals.indexOf(goal);
    this.labels.forEach((label, i) => label.setVisible(i === index));
    this.line.setTint(GOAL_LINE.colors[goal.kind].line);
  }
}
