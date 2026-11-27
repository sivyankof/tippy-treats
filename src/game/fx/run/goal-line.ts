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
import { bakeTexture } from '../../ui/common/bake-texture';
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
  lineHudAlpha,
  pennantOffset,
  pennantWaits,
  pennantX,
  swayView,
} from './goal-line-phase';
import { GoalSequence } from './goal-sequence';

const flag = CONTINUE_ANIM.flag;
const plate = GOAL_LINE.plate;
const PLATE_LOOK = lookOf('button', plate.radius);
const S_OUTLINE_SHADE = MENU.style.outlineShade;

/** Room between two frames of the picture, px. */
const FRAME_GAP = 4;
const tail = plate.tail;
const LINE_FRAME_WIDTH = LOGICAL_SIZE.width + GOAL_LINE.linePad * 2;
/** Picture height of the line: the dash and the room its shadow takes under it. */
const LINE_BODY_HEIGHT =
  flag.lineHeight + GOAL_LINE.lineLook.shadow.offset + GOAL_LINE.lineLook.shadow.spread;
const LINE_FRAME_HEIGHT = LINE_BODY_HEIGHT + GOAL_LINE.linePad * 2;

/** A frame of the run's one goal picture: its name and the origin that puts the middle of the body at the image position. */
export interface FrameArt {
  name: string;
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

/** What a goal's pennant looks like: its colour and its label (none on the art sheet). */
export interface PlateSpec {
  fill: number;
  label?: PlateLabel;
}

/** The one picture of a run's goal line: the dashed line and the pennants, as named frames. */
export interface GoalArt {
  key: string;
  line: FrameArt;
  plates: Array<{ plain: FrameArt; pointer: FrameArt }>;
}

/** Draws the dashed line into the field at (`ox`, `oy`): volumetric dashes with a shadow, grey so the kind of goal tints them. */
function drawLine(g: Phaser.GameObjects.Graphics, ox: number, oy: number): void {
  const { rim, face, gloss, shadow } = GOAL_LINE.lineLook;
  const h = flag.lineHeight;
  for (
    let x = shadow.spread;
    x + flag.dashLength + shadow.spread <= LOGICAL_SIZE.width;
    x += flag.dashLength + flag.dashGap
  ) {
    const left = ox + x;
    g.fillStyle(0x000000, shadow.alpha / shadow.steps);
    for (let i = 0; i < shadow.steps; i++) {
      const grow = (shadow.spread * (shadow.steps - i)) / shadow.steps;
      g.fillRoundedRect(
        left - grow,
        oy + shadow.offset - grow,
        flag.dashLength + grow * 2,
        h + grow * 2,
        h / 2 + grow,
      );
    }
    g.fillStyle(rim.color, 1);
    g.fillRoundedRect(left, oy, flag.dashLength, h, h / 2);
    const inner = h - rim.width * 2;
    g.fillStyle(face, 1);
    g.fillRoundedRect(
      left + rim.width,
      oy + rim.width,
      flag.dashLength - rim.width * 2,
      inner,
      inner / 2,
    );
    g.fillStyle(gloss.color, 1);
    g.fillRoundedRect(
      left + gloss.inset,
      oy + rim.width + 1,
      flag.dashLength - gloss.inset * 2,
      gloss.height,
      gloss.height / 2,
    );
  }
}

/** Where a pennant body lies inside its frame of `width` x `plate.height` plus the margins. */
function plateField(pointer: boolean, width: number) {
  const m = shadowMargin(PLATE_LOOK);
  const top = m.top + (pointer ? tail.height : 0);
  return {
    left: m.side,
    top,
    width: width + m.side * 2,
    height: plate.height + top + m.bottom,
  };
}

/** Draws a pennant body (and the pointer on its top edge when asked) with its frame's corner at (`ox`, `oy`). */
function drawPlate(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  width: number,
  fill: number,
  pointer: boolean,
): void {
  const look = PLATE_LOOK;
  const f = plateField(pointer, width);
  drawVolume(g, ox + f.left, oy + f.top, width, plate.height, look, { fill });
  if (!pointer) return;
  // The pointer: a dark triangle, then a lighter one inside it, its base sunk into the body so no seam shows.
  const cx = ox + f.left + width / 2;
  const top = oy + f.top;
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
}

/**
 * Bakes the dashed line and every pennant of the run (each spec plain and with the pointer, its
 * label drawn in) into ONE texture of its own (not on the shared atlas) with a named frame for
 * each, so the line and the pennant draw as one batch. `width` is the width of every pennant body.
 */
export function bakeGoalArt(scene: Phaser.Scene, width: number, specs: PlateSpec[]): GoalArt {
  const key = `goal_art_${width}_${specs.map((spec) => `${spec.fill.toString(16)}${spec.label ? `-${spec.label.text}` : ''}`).join('+')}`;
  const plain = plateField(false, width);
  const pointer = plateField(true, width);
  const frames: Array<{ name: string; x: number; y: number; width: number; height: number }> = [
    { name: 'line', x: 0, y: 0, width: LINE_FRAME_WIDTH, height: LINE_FRAME_HEIGHT },
  ];
  let y = LINE_FRAME_HEIGHT + FRAME_GAP;
  const plates = specs.map((_, i) => {
    const frame = (name: string, field: typeof plain): FrameArt => {
      frames.push({ name, x: 0, y, width: field.width, height: field.height });
      const art = {
        name,
        originX: (field.left + width / 2) / field.width,
        originY: (field.top + plate.height / 2) / field.height,
      };
      y += field.height + FRAME_GAP;
      return art;
    };
    return { plain: frame(`${i}_n`, plain), pointer: frame(`${i}_p`, pointer) };
  });
  const textureWidth = Math.max(LINE_FRAME_WIDTH, pointer.width);
  bakeTexture(
    scene,
    key,
    textureWidth,
    y,
    (g) => {
      drawLine(g, GOAL_LINE.linePad, GOAL_LINE.linePad);
      specs.forEach((spec, i) => {
        const [n, p] = [frames[1 + i * 2], frames[2 + i * 2]];
        if (n) drawPlate(g, n.x, n.y, width, spec.fill, false);
        if (p) drawPlate(g, p.x, p.y, width, spec.fill, true);
      });
    },
    (context) => {
      specs.forEach((spec, i) => {
        const label = spec.label;
        if (!label) return;
        for (const frame of [frames[1 + i * 2], frames[2 + i * 2]]) {
          if (!frame) continue;
          const field = plateField(frame.name.endsWith('_p'), width);
          const x = frame.x + field.left + (width - label.width) / 2;
          const labelY = frame.y + field.top + (plate.height - PLATE_LOOK.bevel - label.height) / 2;
          context.drawImage(label.canvas, x, labelY, label.width, label.height);
        }
      });
    },
  );
  const texture = scene.textures.get(key);
  for (const f of frames)
    if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.width, f.height);
  return {
    key,
    line: {
      name: 'line',
      originX: 0,
      originY: (GOAL_LINE.linePad + flag.lineHeight / 2) / LINE_FRAME_HEIGHT,
    },
    plates,
  };
}

/**
 * The line of the player's own result inside a run (docs/04, section 6): one dashed line and one
 * pennant behind the tower (one batch: the same picture, drawn in turn), standing on the nearest goal above the tower. Everything is
 * made when the run loads; the animations are computed from time every frame.
 */
export class GoalLine {
  private readonly root: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.Image;
  /** The pennant: one image, its picture swapped per goal and per pointer. */
  private readonly pennant: Phaser.GameObjects.Image;
  /** Pictures of each goal: with and without the pointer. */
  private readonly art: GoalArt;
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
    // The labels are drawn once into the picture with a temporary text each.
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
    this.art = bakeGoalArt(
      scene,
      this.plateWidth,
      goals.map((goal, i) => {
        const text = texts[i] as Phaser.GameObjects.Text;
        const label = {
          text: text.text,
          canvas: text.canvas,
          width: text.width,
          height: text.height,
        };
        return { fill: GOAL_LINE.colors[goal.kind].plate, label };
      }),
    );
    for (const text of texts) text.destroy();
    const art = this.art;
    this.line = new Phaser.GameObjects.Image(scene, -GOAL_LINE.linePad, 0, art.key, art.line.name)
      .setOrigin(art.line.originX, art.line.originY)
      .setVisible(false);
    const first = (art.plates[0] as { plain: FrameArt }).plain;
    this.pennant = new Phaser.GameObjects.Image(scene, 0, 0, art.key, first.name)
      .setOrigin(first.originX, first.originY)
      .setVisible(false);
    // The line and the pennant are drawn in turn at one depth with the same picture: one batch.
    // They lie behind the tower; the pennant is almost always above its top.
    this.root = scene.add.container(0, 0, [this.line, this.pennant]).setDepth(DEPTH.recordFlag);
    this.seq = new GoalSequence(goals, startHeight);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.root.destroy();
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
      .setAlpha((low + (high - low) * sway.pulse) * lineAlpha * lineHudAlpha(y - scrollY))
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
    const arts = this.art.plates[index] as { plain: FrameArt; pointer: FrameArt };
    const art = waiting ? arts.pointer : arts.plain;
    this.pennant.setFrame(art.name).setOrigin(art.originX, art.originY);
  }

  /** Puts the colour of `goal` on the line. */
  private show(goal: RunGoal): void {
    this.shown = goal;
    this.line.setTint(GOAL_LINE.colors[goal.kind].line);
  }
}
