import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { createPlate, type VolumePlate } from '../style/volume';
import type { Movable } from '../transition';
import type { ResultsCoins } from './results-coins';
import { fitPanel, spreadBlocks } from './results-layout';
import type { ResultsMissions } from './results-missions';
import type { ResultsTiers } from './results-tiers';
import type { ResultsXp } from './results-xp';

const cfg = MENU.results;

type BlockObject = Phaser.GameObjects.Container | Phaser.GameObjects.Text;

interface PanelBlock {
  obj: BlockObject;
  height: number;
}

/** A block of the screen that takes part in the vertical layout. */
interface Placed {
  container: Phaser.GameObjects.Container;
  height: number;
}

/** The blocks that stand on the panel, top to bottom. */
export interface PanelParts {
  /** The dev-only "not saved" plate, `null` for a normal run. */
  debugPlate: PanelBlock | null;
  stats: PanelBlock;
  coins: ResultsCoins;
  tiers: ResultsTiers;
  xp: ResultsXp;
  missions: ResultsMissions;
  /** The "so close" line. */
  hint: Phaser.GameObjects.Text;
  /** The run reached the save: the XP block and the hint are shown. */
  recorded: boolean;
}

/**
 * The window plate under the results blocks, with the blocks on it. All of it lives in one
 * container (`root`, centred on the plate), so a short screen scales the plate and the blocks
 * together (docs/07-ui-screens.md, section 6).
 */
export class ResultsPanel {
  readonly root: Phaser.GameObjects.Container;
  private plate: VolumePlate | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parts: PanelParts,
  ) {
    this.root = scene.add.container(0, 0);
  }

  /** Height the panel takes on the screen, scale included. */
  get height(): number {
    return (this.plate?.bodyHeight ?? 0) * this.root.scaleY;
  }

  /** The blocks on the panel, top to bottom; empty ones are left out. */
  blocks(): PanelBlock[] {
    const { debugPlate, stats, coins, tiers, xp, missions, hint, recorded } = this.parts;
    const all: PanelBlock[] = [
      ...(debugPlate ? [debugPlate] : []),
      stats,
      { obj: coins.container, height: coins.height },
      { obj: tiers.container, height: tiers.height },
      { obj: xp.container, height: recorded ? xp.height : 0 },
      { obj: missions.container, height: missions.height },
      {
        obj: hint,
        height: recorded ? cfg.nearMissFont * cfg.lineHeight * hint.text.split('\n').length : 0,
      },
    ];
    return all.filter((b) => b.height > 0);
  }

  /** What slides in and out with the screen: the plate and the blocks, top to bottom. */
  content(): Movable[] {
    return [...(this.plate ? [this.plate] : []), ...this.blocks().map((b) => b.obj)];
  }

  /**
   * Chooses the spacing, the scale and the fold of the missions so that the header and the panel
   * fit above the buttons (with a gap above and below the pair), builds the plate and stands the
   * blocks on it.
   */
  fit(screenHeight: number, headerHeight: number, buttonsHeight: number): void {
    const room = screenHeight - cfg.buttonsBottom - buttonsHeight - cfg.top - cfg.sectionGap * 2;
    const { padY, gap } = cfg.panel;
    const { missions } = this.parts;
    const before = this.blocks();
    const fit = fitPanel({
      blocksHeight: before.reduce((total, b) => total + b.height, 0),
      foldSaving: missions.foldSaving,
      spacing: gap * Math.max(0, before.length - 1) + padY * 2,
      headerHeight,
      room,
      minShare: cfg.panelMinSpacing,
      minScale: cfg.panelMinScale,
      floorScale: cfg.panelFloorScale,
    });
    if (fit.fold) missions.fold(this.scene);
    const blocks = this.blocks();
    const sum = blocks.reduce((total, b) => total + b.height, 0);
    const pad = padY * fit.share;
    const between = gap * fit.share;
    const height = sum + between * Math.max(0, blocks.length - 1) + pad * 2;
    this.plate?.destroy();
    this.plate = createPlate(this.scene, 'window', 0, 0, cfg.panel.width, height);
    this.root.add(this.plate);
    let y = -this.plate.bodyHeight / 2 + pad;
    for (const b of blocks) {
      this.root.add(b.obj);
      b.obj.setPosition(0, y + b.height / 2);
      y += b.height + between;
    }
    this.root.setScale(fit.scale);
  }

  /** Buttons stand at the bottom; the header and the panel above them share the free room evenly. */
  layout(width: number, height: number, header: Placed, buttons: Placed): void {
    const cx = width / 2;
    const buttonsY = height - cfg.buttonsBottom - buttons.height / 2;
    const [headerY = 0, panelY = 0] = spreadBlocks(
      [header.height, this.height],
      cfg.top,
      buttonsY - buttons.height / 2,
      cfg.sectionGap,
    );
    header.container.setPosition(cx, headerY);
    this.root.setPosition(cx, panelY);
    buttons.container.setPosition(cx, buttonsY);
  }
}
