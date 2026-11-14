import * as Phaser from 'phaser';
import { MISSIONS } from '../../../data/missions';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { share } from '../../../core/missions';
import type { MissionProgress } from '../../../core/save/schema';
import { formatNumber, t } from '../../../i18n';
import { createTextButton, type Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { missionStatus } from './missions-model';
import { PriceTag } from './price-tag';
import { ProgressBar } from './progress-bar';

const cfg = MENU.missions;

export interface MissionCardOptions {
  item: MissionProgress;
  width: number;
  /** The free reroll of the day is still there and this card may use it. */
  canReroll: boolean;
  /** The reroll of the day is spent: open cards say so instead of offering it. */
  rerollUsed: boolean;
  onClaim: (button: Button) => void;
  onReroll: () => void;
}

/** One mission of the window: text, progress bar, reward and the claim or swap button. */
export class MissionCard extends Phaser.GameObjects.Container {
  /** The claim button when the card has one (for the flight of the reward). */
  claimButton: Button | null = null;

  constructor(scene: Phaser.Scene, y: number, options: MissionCardOptions) {
    super(scene, 0, y);
    const { item, width } = options;
    const color = cfg.groupColors[item.group];
    const left = -width / 2 + cfg.padX;
    const status = missionStatus(item);
    this.add(new VolumePlate(scene, 'card', cfg.cardHeight, { rim: color }).setBodyWidth(width));
    const text = createOutlinedText(
      scene,
      left,
      cfg.textY,
      t(`mission.${item.id}`, { n: formatNumber(item.target) }),
      cfg.textFont,
    ).setOrigin(0, 0.5);
    this.add(fitText(text, width - cfg.padX * 2));
    const bar = new ProgressBar(
      scene,
      left + cfg.barWidth / 2,
      cfg.barY,
      cfg.barWidth,
      cfg.barHeight,
      cfg.barFont,
      color,
    );
    bar.setShare(share(item));
    bar.setLabel(
      t('missions.progress', {
        n: formatNumber(item.progress),
        total: formatNumber(item.target),
      }),
    );
    this.add(bar);
    this.add(
      new PriceTag(scene, cfg.rewardX, cfg.barY, cfg.rewardFont).show(
        '{price}',
        MISSIONS.reward[item.group],
        'coins',
      ),
    );
    this.addAction(scene, status, options);
    this.setSize(width, cfg.cardHeight);
  }

  private addAction(
    scene: Phaser.Scene,
    status: ReturnType<typeof missionStatus>,
    options: MissionCardOptions,
  ): void {
    const layout = cfg.actionButton;
    const make = (label: string, fill: number, key: string, onClick: () => void): Button => {
      const { button } = createTextButton(scene, {
        text: label,
        font: layout.font,
        maxLabelWidth: layout.width - cfg.actionTextPadding,
        fill,
        layout,
        keyPrefix: key,
        x: cfg.actionX,
        y: cfg.actionY,
        onClick,
      });
      this.add(button);
      return button;
    };
    if (status === 'claimable') {
      const button: Button = make(t('missions.claim'), PALETTE.success, 'ui_mission_claim', () =>
        options.onClaim(button),
      );
      button.breathe(false);
      this.claimButton = button;
    } else if (status === 'claimed') {
      this.add(
        fitText(
          createOutlinedText(
            scene,
            cfg.actionX,
            cfg.actionY,
            t('missions.claimed'),
            cfg.tickFont,
            PALETTE.success,
          ),
          layout.width,
        ),
      );
    } else if (options.canReroll) {
      make(t('missions.reroll'), PALETTE.accentSecondary, 'ui_mission_reroll', options.onReroll);
    } else if (options.rerollUsed) {
      const note = createOutlinedText(
        scene,
        cfg.actionX,
        cfg.actionY,
        t('missions.rerollUsed'),
        cfg.noteFont,
        PALETTE.panelShadow,
      ).setAlign('center');
      this.add(note.setWordWrapWidth(layout.width));
    }
  }
}
