import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { t } from '../../../../i18n';
import type { Movable } from '../../common/transition';
import { SectionFrame } from '../../style/section-frame';
import type { StatTile } from '../../style/stat-tile';
import type { ResultsCoins } from './results-coins';
import type { ResultsMissions } from './results-missions';
import {
  FRAME_INNER,
  planResults,
  type FrameKind,
  type ResultsContent,
  type ResultsPlan,
  type RowKind,
} from './results-model';
import { createTileRow } from './results-tiles';
import type { ResultsXp } from './results-xp';

const cfg = MENU.results;

/** The pieces that stand in the frames. */
export interface PanelParts {
  content: ResultsContent;
  /** The dev-only "not saved" plate, `null` for a normal run. */
  debugPlate: Phaser.GameObjects.Container | null;
  coins: ResultsCoins;
  /** The XP tile, bar and status line; null for a run that did not reach the save. */
  xp: ResultsXp | null;
  scoreTile: StatTile;
  tileWidth: number;
  tierRows: Phaser.GameObjects.Container[];
  /** The Team frame content and the same in one row; the panel keeps the one the fit chose. */
  team: Phaser.GameObjects.Container;
  teamRow: Phaser.GameObjects.Container;
  missions: ResultsMissions;
  /** The hint line at the bottom of the Missions frame. */
  missionHint: Phaser.GameObjects.Text | null;
}

const TITLES: Record<FrameKind, string> = {
  rewards: 'results.frame.rewards',
  team: 'results.frame.team',
  missions: 'results.frame.missions',
};

/**
 * The frames under the header ("Rewards", "Team", "Missions") with their rows, fitted to the room
 * above the buttons (docs/07-ui-screens.md, section 6). They all live in one container (`root`,
 * its origin at the top centre of the panel), so a short screen scales them together.
 */
export class ResultsPanel {
  readonly root: Phaser.GameObjects.Container;
  private plan: ResultsPlan | null = null;
  private frames: SectionFrame[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parts: PanelParts,
    /** The panel stands right under this object, so it is also under everything built after it. */
    below: Phaser.GameObjects.Container,
  ) {
    this.root = scene.add.container(0, 0);
    scene.children.moveBelow(this.root, below);
  }

  /** Height the panel takes on the screen, scale included. */
  get height(): number {
    return (this.plan?.height ?? 0) * this.root.scaleY;
  }

  /** What slides in and out with the screen: the dev plate and the frames, top to bottom. */
  content(): Movable[] {
    return [...(this.parts.debugPlate ? [this.parts.debugPlate] : []), ...this.frames];
  }

  /** Chooses the folds, the spacing and the scale for `room`, then builds the frames and puts the rows in. */
  fit(room: number): void {
    const { parts } = this;
    const plan = planResults(parts.content, room);
    this.plan = plan;
    if (plan.folds.has('missions')) parts.missions.fold(this.scene);
    parts.xp?.showOvenLine(!plan.folds.has('ovenLine'));
    const objects = this.rowObjects(plan);
    if (parts.debugPlate && plan.debugY !== null) {
      this.root.add(parts.debugPlate.setPosition(0, plan.debugY));
    }
    for (const frame of plan.frames) {
      const view = new SectionFrame(this.scene, t(TITLES[frame.kind]));
      view.setBody(cfg.frames.width, frame.height).setPosition(0, frame.y);
      for (const row of frame.rows) {
        const obj = objects.get(row.kind)?.shift();
        if (!obj) continue;
        obj.setPosition(obj.x, row.y);
        view.content.add(obj);
      }
      this.root.add(view);
      this.frames.push(view);
    }
    // What the plan left out (a status line with nothing to say) stays hidden.
    for (const left of objects.values()) for (const obj of left) obj.setVisible(false);
    this.root.setScale(plan.scale);
  }

  /** Puts the panel's top centre at (x, y). */
  setTop(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** The objects of each row kind, in the order the plan places them; the unused ones are gone. */
  private rowObjects(
    plan: ResultsPlan,
  ): Map<RowKind, Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text>> {
    const { parts } = this;
    const tiles = [parts.coins.tile, ...(parts.xp ? [parts.xp.tile] : []), parts.scoreTile];
    const map = new Map<RowKind, Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text>>();
    map.set('tiles', [createTileRow(this.scene, tiles, parts.tileWidth)]);
    if (parts.xp) {
      map.set('level', [this.levelRow(parts.xp)]);
      map.set('status', [parts.xp.status]);
    }
    map.set('tier', [...parts.tierRows]);
    const folded = plan.folds.has('teamRow');
    map.set(folded ? 'teamRow' : 'team', [folded ? parts.teamRow : parts.team]);
    (folded ? parts.team : parts.teamRow).destroy();
    map.set('mission', [...parts.missions.rows]);
    if (parts.missionHint) map.set('hint', [parts.missionHint]);
    return map;
  }

  /** "Lv N" with the XP bar across the frame and, when there is one, the "x2" button at the right. */
  private levelRow(xp: ResultsXp): Phaser.GameObjects.Container {
    const row = this.scene.add.container(0, 0, [xp.bar]);
    const button = this.parts.coins.button;
    const left = -FRAME_INNER / 2 + cfg.levelRow.labelRoom;
    const right = button
      ? FRAME_INNER / 2 - cfg.adButton.width - cfg.levelRow.gap
      : FRAME_INNER / 2;
    xp.bar.setX((left + right) / 2);
    if (button) {
      button.setPosition(FRAME_INNER / 2 - cfg.adButton.width / 2, 0);
      row.add(button);
    }
    return row;
  }
}
