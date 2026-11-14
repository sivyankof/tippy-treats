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
import { fitText } from './fit-text';

const cfg = MENU.team;
const SLOTS = BALANCE.team.slots;

/** Strokes a rounded rectangle as dashes on the straight edges and solid corner arcs. */
function dashedRoundRect(g: Phaser.GameObjects.Graphics, size: number, radius: number): void {
  const half = size / 2;
  const inner = half - radius;
  const arcs: Array<[number, number, number]> = [
    [-inner, -inner, Math.PI],
    [inner, -inner, Math.PI * 1.5],
    [inner, inner, 0],
    [-inner, inner, Math.PI * 0.5],
  ];
  for (const [cx, cy, start] of arcs) {
    g.beginPath()
      .arc(cx, cy, radius, start, start + Math.PI / 2)
      .strokePath();
  }
  const step = cfg.slotDash + cfg.slotDashGap;
  for (let p = -inner; p < inner; p += step) {
    const end = Math.min(p + cfg.slotDash, inner);
    g.lineBetween(p, -half, end, -half).lineBetween(p, half, end, half);
    g.lineBetween(-half, p, -half, end).lineBetween(half, p, half, end);
  }
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
    const size = cfg.slotSize;
    const frame = this.scene.add.graphics();
    this.add(frame);
    if (view.kind === 'filled') {
      const color = RARITY_COLORS[CREATURES[view.id].rarity];
      frame.fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2, size, size, cfg.slotRadius);
      frame
        .fillStyle(PALETTE.panel, 1)
        .fillRoundedRect(
          -size / 2 + cfg.slotBorder,
          -size / 2 + cfg.slotBorder,
          size - cfg.slotBorder * 2,
          size - cfg.slotBorder * 2,
          cfg.slotRadius - cfg.slotBorder,
        );
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
    } else if (view.kind === 'empty') {
      frame.lineStyle(cfg.slotBorder, cfg.slotEmptyColor, 1);
      dashedRoundRect(frame, size - cfg.slotBorder, cfg.slotRadius);
      this.add(
        fitText(
          createOutlinedText(this.scene, 0, 0, t('team.empty'), cfg.lockFont),
          size - cfg.slotTextPad,
        ),
      );
    } else {
      frame
        .fillStyle(PALETTE.panelShadow, cfg.slotLockedAlpha)
        .fillRoundedRect(-size / 2, -size / 2, size, size, cfg.slotRadius);
      drawLock(frame);
      this.add(
        fitText(
          createOutlinedText(
            this.scene,
            0,
            size / 2 - cfg.lockTextLift,
            t('team.slotLocked', { n: slotOpensAt(this.index) }),
            cfg.lockFont,
          ),
          size - cfg.slotTextPad,
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

  layout(width: number): void {
    const step = cfg.slotSize + cfg.slotGap;
    this.slots.forEach((slot, i) => {
      slot.setPosition(width / 2 + (i - (SLOTS - 1) / 2) * step, cfg.slotsY);
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
    const half = cfg.slotSize / 2;
    return this.slots.findIndex(
      (s) => Math.abs(x - s.x) <= half && Math.abs(y - s.y) <= half + cfg.slotGap / 2,
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
