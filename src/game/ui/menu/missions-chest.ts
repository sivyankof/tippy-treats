import * as Phaser from 'phaser';
import { MISSIONS } from '../../../data/missions';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { PriceTag } from './price-tag';
import { ProgressBar } from './progress-bar';

const cfg = MENU.missions;

export interface MissionsChestOptions {
  width: number;
  claimed: number;
  total: number;
  /** The chest was already opened today. */
  opened: boolean;
  onOpen: (button: Button) => void;
}

/** The chest of the day: a 0/3 bar of claimed missions and the button that opens it. */
export class MissionsChest extends Phaser.GameObjects.Container {
  /** Where the berries start their flight. */
  readonly button: Button;

  constructor(scene: Phaser.Scene, y: number, options: MissionsChestOptions) {
    super(scene, 0, y);
    const { width, claimed, total, opened } = options;
    const left = -width / 2 + cfg.padX;
    this.add(new VolumePlate(scene, 'card', cfg.chestHeight).setBodyWidth(width));
    const title = createOutlinedText(
      scene,
      left,
      cfg.chestTitleY,
      t('missions.chest'),
      cfg.chestTitleFont,
    ).setOrigin(0, 0.5);
    this.add(fitText(title, width / 2));
    this.add(
      new PriceTag(scene, width / 2 - cfg.padX - cfg.rewardX, cfg.chestTitleY, cfg.rewardFont).show(
        '{price}',
        MISSIONS.chestBerries,
        'berries',
      ),
    );
    const bar = new ProgressBar(
      scene,
      0,
      cfg.chestBarY,
      width - cfg.padX * 2,
      cfg.barHeight,
      cfg.chestBarFont,
      PALETTE.gold,
    );
    bar.setShare(total > 0 ? claimed / total : 0);
    bar.setLabel(t('missions.chestProgress', { n: claimed, total }));
    this.add(bar);

    const ready = claimed >= total && !opened;
    const layout = cfg.chestButton;
    const { button } = createTextButton(scene, {
      text: t(opened ? 'missions.chestClaimed' : 'missions.chestClaim'),
      font: layout.font,
      maxLabelWidth: layout.width - cfg.chestButtonPadding,
      fill: ready ? PALETTE.success : PALETTE.accentSecondary,
      layout,
      keyPrefix: 'ui_mission_chest',
      y: cfg.chestButtonY,
      onClick: () => options.onOpen(button),
    });
    this.button = button;
    this.add(button);
    if (ready) button.breathe(false);
    else button.setEnabled(false).setAlpha(cfg.disabledAlpha);
    this.setSize(width, cfg.chestHeight);
  }
}
