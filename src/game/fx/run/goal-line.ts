import * as Phaser from 'phaser';
import type { RunGoal } from '../../../core/run/result-goal';
import type { TowerState } from '../../../core/tower/tower-sim';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { GOAL_LINE } from '../../../data/run/goal-line';
import { BALANCE } from '../../../data/tower/balance';
import { formatNumber, t } from '../../../i18n';
import { effectsMode } from '../../app/effects-mode';
import { DEPTH } from '../../common/depth';
import type { TowerView } from '../../objects/tower/tower-view';
import { bakePadded, bakeTexture } from '../../ui/common/bake-texture';
import { createOutlinedText } from '../../ui/common/outlined-text';
import { MENU } from '../../../data/common/menu-layout';
import { shade } from '../../../util/color';
import { drawVolume, lookOf, shadowMargin } from '../../ui/style/volume';
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
/** The keys stay out of the shared atlas prefixes (`fx_`): the pictures keep their own textures. */
const LINE_TEXTURE = 'goal_line';
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
export interface PlateArt {
  key: string;
  /** Origin that puts the middle of the body at the image position. */
  originX: number;
  originY: number;
}

/** A label drawn once onto a pennant: the canvas of a temporary text and the size it takes. */
export interface PlateLabel {
  text: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const tail = plate.tail;

/**
 * Bakes a pennant `width` wide in the colour `fill`, with a small pointer on its top edge when
 * `pointer` is set (the pennant waits under the HUD, away from its line), and `label` drawn on it
 * (one picture, so the pennant is a single image). Its own texture, not on the shared atlas.
 */
export function bakeGoalPlate(
  scene: Phaser.Scene,
  width: number,
  fill: number,
  pointer: boolean,
  label?: PlateLabel,
): PlateArt {
  const look = PLATE_LOOK;
  const m = shadowMargin(look);
  const top = m.top + (pointer ? tail.height : 0);
  const textureWidth = width + m.side * 2;
  const textureHeight = plate.height + top + m.bottom;
  const key = `goal_pennant_${pointer ? 'p' : 'n'}_${width}_${fill.toString(16)}${label ? `_${label.text}` : ''}`;
  const art: PlateArt = {
    key,
    originX: (m.side + width / 2) / textureWidth,
    originY: (top + plate.height / 2) / textureHeight,
  };
  bakeTexture(
    scene,
    key,
    textureWidth,
    textureHeight,
    (g) => {
      drawVolume(g, m.side, top, width, plate.height, look, { fill });
      if (!pointer) return;
      // The pointer: a dark triangle, then a lighter one inside it, its base sunk into the body so no seam shows.
      const cx = m.side + width / 2;
      const base = top + look.outline;
      const half = tail.width / 2;
      g.fillStyle(shade(fill, S_OUTLINE_SHADE), 1);
      g.fillTriangle(cx - half, base + 1, cx + half, base + 1, cx, top - tail.height);
      const inset = look.outline * 1.6;
      g.fillStyle(fill, 1);
      g.fillTriangle(
        cx - half + inset,
        base + 2,
        cx + half - inset,
        base + 2,
        cx,
        top - tail.height + inset * 1.6,
      );
    },
    label
      ? (context) => {
          const x = m.side + (width - label.width) / 2;
          const y = top + (plate.height - look.bevel - label.height) / 2;
          context.drawImage(label.canvas, x, y, label.width, label.height);
        }
      : undefined,
  );
  return art;
}

/**
 * The line of the player's own result inside a run (docs/04, section 6): one dashed line behind
 * the tower and one pennant over it, standing on the nearest goal above the tower. Everything is
 * made when the run loads; the animations are computed from time every frame.
 */
export class GoalLine {
  private readonly line: Phaser.GameObjects.Image;
  /** The pennant: one image, its picture swapped per goal and per pointer. */
  private readonly pennant: Phaser.GameObjects.Image;
  /** Pictures of each goal: with and without the pointer. */
  private readonly arts: Array<{ plain: PlateArt; pointer: PlateArt }>;
  private waiting = false;
  private shownArt: RunGoal | null = null;
  private flashing = false;
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
    // The labels are drawn once into the pennant pictures with a temporary text each.
    const texts = goals.map((goal) =>
      createOutlinedText(
        scene,
        0,
        0,
        t(`run.goal.${goal.kind}`, { n: formatNumber(goal.height) }),
        plate.font,
      ),
    );
    const widest = Math.max(...texts.map((text) => text.width));
    this.plateWidth = Math.ceil(widest + plate.padX * 2);
    this.arts = goals.map((goal, i) => {
      const text = texts[i] as Phaser.GameObjects.Text;
      const label = {
        text: text.text,
        canvas: text.canvas,
        width: text.width,
        height: text.height,
      };
      const fill = GOAL_LINE.colors[goal.kind].plate;
      return {
        plain: bakeGoalPlate(scene, this.plateWidth, fill, false, label),
        pointer: bakeGoalPlate(scene, this.plateWidth, fill, true, label),
      };
    });
    for (const text of texts) text.destroy();
    this.line = scene.add
      .image(-GOAL_LINE.linePad, 0, LINE_TEXTURE)
      .setOrigin(
        0,
        (GOAL_LINE.linePad + flag.lineHeight / 2) / (LINE_BODY_HEIGHT + GOAL_LINE.linePad * 2),
      )
      .setDepth(DEPTH.recordFlag)
      .setVisible(false);
    // The pennant is its own object: the line stays behind the tower, the pennant reads over it.
    const first = (this.arts[0] as { plain: PlateArt }).plain;
    this.pennant = scene.add
      .image(0, 0, first.key)
      .setOrigin(first.originX, first.originY)
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
    let alpha: number;
    let lineAlpha: number;
    let scale: number;
    let hopY = 0;
    let flash = 0;
    if (this.seq.passing) {
      const pass = passView(this.seq.ageMs, goal.kind, level);
      alpha = pass.alpha;
      lineAlpha = pass.alpha;
      scale = pass.scale;
      hopY = pass.hopY;
      flash = pass.tintMix;
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
    this.showFlash(flash);
    this.showPicture(goal, pennantWaits(y - scrollY, plate.height));
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

  /** The flash lightens the pennant: an additive tint of grey, the plain tint (nothing) otherwise. */
  private showFlash(mix: number): void {
    if (mix <= 0) {
      if (!this.flashing) return;
      this.flashing = false;
      this.pennant.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffffff);
      return;
    }
    this.flashing = true;
    const level = Math.round(plate.flashAdd * mix);
    this.pennant.setTintMode(Phaser.TintModes.ADD).setTint((level << 16) | (level << 8) | level);
  }

  /** Swaps the picture of the pennant between the plain one and the one with the pointer (no new objects). */
  private showPicture(goal: RunGoal, waiting: boolean): void {
    const index = this.goals.indexOf(goal);
    if (waiting === this.waiting && goal === this.shownArt) return;
    this.waiting = waiting;
    this.shownArt = goal;
    const arts = this.arts[index] as { plain: PlateArt; pointer: PlateArt };
    const art = waiting ? arts.pointer : arts.plain;
    this.pennant.setTexture(art.key).setOrigin(art.originX, art.originY);
  }

  /** Puts the colour of `goal` on the line. */
  private show(goal: RunGoal): void {
    this.shown = goal;
    this.line.setTint(GOAL_LINE.colors[goal.kind].line);
  }
}
