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
import { bakePadded } from '../../ui/common/bake-texture';
import { createOutlinedText } from '../../ui/common/outlined-text';
import { bakeVolume, lookOf, type VolumeArt } from '../../ui/style/volume';
import type { Particles } from '../common/particles';
import { starBurst } from '../common/sparkle-fx';
import { freeRoom, pennantSide } from './pennant-side';
import { appearView, passView, pennantSpot, pennantX, swayView } from './goal-line-phase';
import { GoalSequence } from './goal-sequence';

const flag = CONTINUE_ANIM.flag;
const plate = GOAL_LINE.plate;
const LINE_TEXTURE = 'fx_goal_line';
const PLATE_LOOK = lookOf('button', plate.radius);

/** Bakes the dashed line, white so the kind of goal tints it. */
export function bakeGoalLine(scene: Phaser.Scene): void {
  bakePadded(scene, LINE_TEXTURE, LOGICAL_SIZE.width, flag.lineHeight, GOAL_LINE.linePad, (g) => {
    const { width, color } = GOAL_LINE.lineRim;
    for (
      let x = 0;
      x + flag.dashLength <= LOGICAL_SIZE.width;
      x += flag.dashLength + flag.dashGap
    ) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, 0, flag.dashLength, flag.lineHeight, flag.lineHeight / 2);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(
        x + width,
        width,
        flag.dashLength - width * 2,
        flag.lineHeight - width * 2,
        (flag.lineHeight - width * 2) / 2,
      );
    }
  });
}

/** Bakes the pennant `width` wide in light neutral tones (the tint gives it its colour). */
export function bakeGoalPlate(scene: Phaser.Scene, width: number): VolumeArt {
  return bakeVolume(scene, `fx_goal_pennant_${width}`, width, plate.height, PLATE_LOOK, {
    fill: plate.face,
  });
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
    const art = bakeGoalPlate(scene, this.plateWidth);
    this.plateImage = new Phaser.GameObjects.Image(scene, 0, 0, art.key).setOrigin(
      (art.left + this.plateWidth / 2) / art.textureWidth,
      (art.top + plate.height / 2) / art.textureHeight,
    );
    this.line = scene.add
      .image(-GOAL_LINE.linePad, 0, LINE_TEXTURE)
      .setOrigin(0, 0.5)
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
    const spot = pennantSpot(y - scrollY, plate.height);
    const pennantY = y + spot.offsetY + sway.bob * flag.bobDistance;
    // A swollen pennant grows towards the middle of the screen, so it never leaves the screen edge.
    const x =
      pennantX(this.side, this.plateWidth) - (this.side * this.plateWidth * (scale - 1)) / 2;
    this.plateImage.setTint(tint);
    this.pennant
      .setPosition(x, pennantY + hopY)
      .setAngle(sway.wave * flag.waveDeg * this.side)
      .setScale(scale, scale * (1 + flag.waveStretch * sway.wave))
      .setAlpha(alpha * spot.alpha)
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

  /** Puts the label and the colours of `goal` on the line. */
  private show(goal: RunGoal): void {
    this.shown = goal;
    const index = this.goals.indexOf(goal);
    this.labels.forEach((label, i) => label.setVisible(i === index));
    this.line.setTint(GOAL_LINE.colors[goal.kind].line);
  }
}
