import * as Phaser from 'phaser';
import { openSlots, slotOpensAt, type TeamIds } from '../../../core/team';
import { BALANCE } from '../../../data/balance';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { RARITY_COLORS } from '../../../data/rarity';
import { t } from '../../../i18n';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, lookOf, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';

const cfg = MENU.team;
const SLOTS = BALANCE.team.slots;

/** Strokes a rounded rectangle as dashes on the straight edges and solid corner arcs. */
function dashedRoundRect(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  radius: number,
): void {
  const halfW = width / 2;
  const halfH = height / 2;
  const innerW = halfW - radius;
  const innerH = halfH - radius;
  const arcs: Array<[number, number, number]> = [
    [-innerW, -innerH, Math.PI],
    [innerW, -innerH, Math.PI * 1.5],
    [innerW, innerH, 0],
    [-innerW, innerH, Math.PI * 0.5],
  ];
  for (const [cx, cy, start] of arcs) {
    g.beginPath()
      .arc(cx, cy, radius, start, start + Math.PI / 2)
      .strokePath();
  }
  const step = cfg.slotDash + cfg.slotDashGap;
  for (let p = -innerW; p < innerW; p += step) {
    const end = Math.min(p + cfg.slotDash, innerW);
    g.lineBetween(p, -halfH, end, -halfH).lineBetween(p, halfH, end, halfH);
  }
  for (let p = -innerH; p < innerH; p += step) {
    const end = Math.min(p + cfg.slotDash, innerH);
    g.lineBetween(-halfW, p, -halfW, end).lineBetween(halfW, p, halfW, end);
  }
}

/** A plus sign drawn in code, centred on (0, y). */
function drawPlus(g: Phaser.GameObjects.Graphics): void {
  const { arm, line, y } = cfg.plus;
  g.lineStyle(line, cfg.slotEmptyColor, 1)
    .lineBetween(-arm, y, arm, y)
    .lineBetween(0, y - arm, 0, y + arm);
}

/** A padlock drawn in code, centred on (0, 0). */
function drawLock(g: Phaser.GameObjects.Graphics): void {
  const { width, height, radius, shackleRadius, line, y } = cfg.lockBody;
  g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(-width / 2, y, width, height, radius);
  g.lineStyle(line, PALETTE.textDark, 1)
    .beginPath()
    .arc(0, y, shackleRadius, Math.PI, 0)
    .strokePath();
}

/** The identity of what a slot shows, so it only rebuilds (and pops) when that changes. */
type SlotView = { kind: 'locked' } | { kind: 'empty' } | { kind: 'filled'; id: CreatureId };

/** One slot: a frame, and a creature, an empty hint or a padlock inside. */
class TeamSlot extends Phaser.GameObjects.Container {
  portrait: CreaturePortrait | null = null;
  private shown: string | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly index: number,
  ) {
    super(scene);
    scene.add.existing(this);
  }

  show(view: SlotView, level: number, animate: boolean): void {
    const key = view.kind === 'filled' ? `f_${view.id}_${level}` : view.kind;
    if (key === this.shown) return;
    const first = this.shown === null;
    this.shown = key;
    this.removeAll(true);
    this.portrait = null;
    const { slotWidth: w, slotHeight: h } = cfg;
    const face = faceOffsetY('card');
    const colors =
      view.kind === 'filled'
        ? { rim: RARITY_COLORS[CREATURES[view.id].rarity] }
        : { fill: view.kind === 'empty' ? cfg.slotEmptyFill : cfg.slotLockedFill };
    this.add(new VolumePlate(this.scene, 'card', h, colors).setBodyWidth(w));
    if (view.kind === 'filled') {
      this.portrait = new CreaturePortrait(
        this.scene,
        0,
        cfg.slotLayerY,
        view.id,
        level,
        cfg.slotLayerWidth,
        cfg.slotLayerScale,
      );
      this.add(this.portrait);
      this.add(
        fitText(
          createOutlinedText(
            this.scene,
            0,
            h / 2 - cfg.slotNameLift,
            t(CREATURES[view.id].nameKey),
            cfg.slotNameFont,
          ),
          w - cfg.slotTextPad,
        ),
      );
    } else if (view.kind === 'empty') {
      const frame = this.scene.add.graphics();
      frame.lineStyle(cfg.slotBorder, cfg.slotEmptyColor, 1);
      dashedRoundRect(
        frame,
        w - cfg.slotDashInset * 2,
        h - cfg.slotDashInset * 2 - lookOf('card').bevel,
        lookOf('card').radius - cfg.slotDashInset / 2,
      );
      frame.setY(face);
      drawPlus(frame);
      this.add(frame);
      this.add(
        fitText(
          createOutlinedText(
            this.scene,
            0,
            h / 2 - cfg.lockTextLift,
            t('team.empty'),
            cfg.lockFont,
          ),
          w - cfg.slotTextPad,
        ),
      );
    } else {
      const lock = this.scene.add.graphics({ y: face });
      drawLock(lock);
      this.add(lock);
      this.add(
        fitText(
          createOutlinedText(
            this.scene,
            0,
            h / 2 - cfg.lockTextLift,
            t('team.slotLocked', { n: slotOpensAt(this.index) }),
            cfg.lockFont,
          ),
          w - cfg.slotTextPad,
        ),
      );
    }
    if (animate && !first) {
      this.setScale(cfg.popFrom);
      this.scene.tweens.add({
        targets: this,
        scale: 1,
        duration: cfg.popMs,
        ease: cfg.popEase,
      });
    }
  }
}

/** The row of team slots at the top of the screen. */
export class TeamSlots {
  private readonly slots: TeamSlot[];
  private dimmed = -1;

  constructor(scene: Phaser.Scene) {
    this.slots = Array.from({ length: SLOTS }, (_, i) => new TeamSlot(scene, i));
  }

  get parts(): Phaser.GameObjects.Container[] {
    return this.slots;
  }

  layout(width: number, y: number): void {
    const step = cfg.slotWidth + cfg.slotGap;
    this.slots.forEach((slot, i) => {
      slot.setPosition(width / 2 + (i - (SLOTS - 1) / 2) * step, y);
    });
  }

  /** Shows the team; slots whose content changed pop in. */
  refresh(
    team: TeamIds,
    levelOf: (id: CreatureId) => number,
    bakerLevel: number,
    animate = true,
  ): void {
    const open = openSlots(bakerLevel);
    this.slots.forEach((slot, i) => {
      const id = team[i] ?? null;
      const view: SlotView =
        i >= open ? { kind: 'locked' } : id === null ? { kind: 'empty' } : { kind: 'filled', id };
      slot.show(view, id === null ? 1 : levelOf(id), animate);
    });
  }

  /** The slot index under the point, or -1. */
  slotAt(x: number, y: number): number {
    const halfW = cfg.slotWidth / 2;
    const halfH = cfg.slotHeight / 2;
    return this.slots.findIndex(
      (s) => Math.abs(x - s.x) <= halfW && Math.abs(y - s.y) <= halfH + cfg.slotGap / 2,
    );
  }

  /** The slot fades while its creature is dragged away. */
  dim(index: number): void {
    this.dimmed = index;
    this.slots.forEach((s, i) => s.setAlpha(i === index ? cfg.slotDimAlpha : 1));
  }

  undim(): void {
    if (this.dimmed >= 0) this.slots[this.dimmed]?.setAlpha(1);
    this.dimmed = -1;
  }

  tick(dtMs: number): void {
    for (const slot of this.slots) slot.portrait?.tick(dtMs);
  }
}
