import * as Phaser from 'phaser';
import type { TeamIds } from '../../../core/team';
import { CREATURE_IDS, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { CreatureCard } from './creature-card';
import { cellAt, layoutGrid, type GridCell } from './team-layout';

const cfg = MENU.team;
const card = MENU.card;

/** Owned creatures in the order of the game's creature list. */
export function ownedIds(owned: Partial<Record<CreatureId, unknown>>): CreatureId[] {
  return CREATURE_IDS.filter((id) => owned[id] !== undefined);
}

/** The grid of owned creatures: cards that are in the team are faded and carry a tick. */
export class TeamGrid {
  /** Outer containers carry position, scale and the entry cascade; the card inside carries the fade. */
  private slotsOf: Phaser.GameObjects.Container[] = [];
  private cards: CreatureCard[] = [];
  private ticks = new Map<CreatureId, Phaser.GameObjects.Graphics>();
  private cells: GridCell[] = [];
  private scale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ids: readonly CreatureId[],
    levelOf: (id: CreatureId) => number,
    bakerLevel: number,
  ) {
    this.cards = ids.map(
      (id) => new CreatureCard(scene, 0, 0, { id, level: levelOf(id), bakerLevel }),
    );
    this.slotsOf = this.cards.map((c, i) => {
      const outer = scene.add.container(0, 0);
      outer.add([c, this.createTick(ids[i] as CreatureId)]);
      return outer;
    });
  }

  get parts(): Phaser.GameObjects.Container[] {
    return this.slotsOf;
  }

  private createTick(id: CreatureId): Phaser.GameObjects.Graphics {
    const { x, y, radius, line, fill, check } = cfg.tick;
    const g = this.scene.add.graphics({ x, y });
    g.fillStyle(fill, 1).fillCircle(0, 0, radius);
    const [p0, p1, p2] = check.points;
    g.lineStyle(line, PALETTE.textLight, 1)
      .beginPath()
      .moveTo(radius * p0.x, radius * p0.y)
      .lineTo(radius * p1.x, radius * p1.y)
      .lineTo(radius * p2.x, radius * p2.y)
      .strokePath();
    g.setVisible(false);
    this.ticks.set(id, g);
    return g;
  }

  /** Places the cards below `top`, shrinking them to fit above the bottom of the screen. */
  layout(width: number, height: number, top: number): void {
    const layout = layoutGrid({
      count: this.cards.length,
      columns: cfg.columns,
      cardWidth: card.width,
      cardHeight: card.height,
      gapX: card.gapX,
      gapY: card.gapY,
      centerX: width / 2,
      top,
      maxWidth: width - cfg.gridSideMargin * 2,
      maxHeight: height - top - cfg.gridBottom,
      spareShare: cfg.gridSpareShare,
    });
    this.cells = layout.cells;
    this.scale = layout.scale;
    this.slotsOf.forEach((c, i) => {
      const cell = layout.cells[i];
      if (cell) c.setPosition(cell.x, cell.y).setScale(this.scale);
    });
  }

  /** The creature under the point, if any. */
  idAt(x: number, y: number): CreatureId | null {
    const i = cellAt(this.cells, card.width * this.scale, card.height * this.scale, x, y);
    return this.ids[i] ?? null;
  }

  /** Fades the cards of creatures that are in the team and shows their tick. */
  refresh(team: TeamIds, animate = true): void {
    this.cards.forEach((c, i) => {
      const id = this.ids[i];
      if (id === undefined) return;
      const inTeam = team.includes(id);
      this.ticks.get(id)?.setVisible(inTeam);
      const alpha = inTeam ? card.inTeamAlpha : 1;
      if (!animate) {
        c.setAlpha(alpha);
        return;
      }
      this.scene.tweens.killTweensOf(c);
      this.scene.tweens.add({ targets: c, alpha, duration: cfg.fadeMs });
    });
  }

  /** A short side-to-side shake: the tap changed nothing. */
  shake(id: CreatureId): void {
    const i = this.ids.indexOf(id);
    const c = this.slotsOf[i];
    if (!c) return;
    const rest = (): number => this.cells[i]?.x ?? c.x;
    const x = rest();
    this.scene.tweens.killTweensOf(c);
    c.setX(x);
    this.scene.tweens.add({
      targets: c,
      x: x + cfg.shakePx,
      duration: cfg.shakeMs,
      yoyo: true,
      repeat: cfg.shakeRepeat,
      onComplete: () => c.setX(rest()),
    });
  }

  tick(dtMs: number): void {
    for (const c of this.cards) c.tick(dtMs);
  }
}
