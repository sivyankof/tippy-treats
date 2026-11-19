import * as Phaser from 'phaser';
import { MISSIONS } from '../../../../data/progression/missions';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createTextButton } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { VolumePlate } from '../../style/volume';
import { ChestBox } from './chest-box';
import { fitText } from '../widgets/fit-text';
import { PriceTag } from '../widgets/price-tag';
import { ProgressBar } from '../widgets/progress-bar';

const cfg = MENU.missions;

export interface MissionsChestOptions {
  width: number;
  claimed: number;
  total: number;
  /** The chest was already opened today. */
  opened: boolean;
  /** The chest was opened just now: it is shown shut first, then flips its lid. */
  justOpened?: boolean;
  onOpen: () => void;
}

/** The chest of the day: the picture with its three states, a 0/3 bar of claimed missions and the button that opens it. */
export class MissionsChest extends Phaser.GameObjects.Container {
  private readonly box: ChestBox;

  constructor(scene: Phaser.Scene, y: number, options: MissionsChestOptions) {
    super(scene, 0, y);
    const { width, claimed, total, opened } = options;
    const left = -width / 2 + cfg.padX;
    const columnLeft = left + cfg.chestAreaWidth + cfg.chestColumnGap;
    const columnWidth = width / 2 - cfg.padX - columnLeft;
    const columnX = columnLeft + columnWidth / 2;
    const ready = claimed >= total && !opened;
    this.add(new VolumePlate(scene, 'card', cfg.chestHeight).setBodyWidth(width));
    this.box = new ChestBox(
      scene,
      left + cfg.chestAreaWidth / 2 + cfg.chestBoxX,
      cfg.chestBoxY,
      cfg.chestMotion,
      opened ? 'opened' : ready ? 'ready' : 'closed',
    );
    this.add(this.box);
    if (options.justOpened) this.box.playOpen();
    const title = createOutlinedText(
      scene,
      columnX,
      cfg.chestTitleY,
      t('missions.chest'),
      cfg.chestTitleFont,
    );
    this.add(fitText(title, columnWidth));
    this.add(
      new PriceTag(scene, columnX, cfg.chestPriceY, cfg.rewardFont).show(
        '{price}',
        MISSIONS.chestBerries,
        'berries',
      ),
    );
    const bar = new ProgressBar(
      scene,
      columnX,
      cfg.chestBarY,
      columnWidth,
      cfg.barHeight,
      cfg.chestBarFont,
      PALETTE.gold,
    );
    bar.setShare(total > 0 ? claimed / total : 0);
    bar.setLabel(t('missions.chestProgress', { n: claimed, total }));
    this.add(bar);

    const layout = cfg.chestButton;
    const { button } = createTextButton(scene, {
      text: t(opened ? 'missions.chestClaimed' : 'missions.chestClaim'),
      font: layout.font,
      maxLabelWidth: layout.width - cfg.chestButtonPadding,
      fill: ready ? PALETTE.success : PALETTE.accentSecondary,
      layout,
      keyPrefix: 'ui_mission_chest',
      y: cfg.chestButtonY,
      onClick: options.onOpen,
    });
    this.add(button);
    if (ready) button.breathe(false);
    else button.setEnabled(false).setAlpha(cfg.disabledAlpha);
    this.setSize(width, cfg.chestHeight);
  }

  /** Where the berries come out: the top of the open chest, in screen coordinates. */
  openingPoint(): { x: number; y: number } {
    const m = this.box.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty + this.box.openingY * m.d };
  }
}
