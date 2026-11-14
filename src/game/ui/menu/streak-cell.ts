import * as Phaser from 'phaser';
import type { CalendarCell } from '../../../core/streak';
import { CREATURES } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { createTreasureTextures, TREASURE_TEXTURES } from '../../fx/treasure-textures';
import { CREATURE_ICON_KEYS } from '../creature-icons';
import { createOutlinedText } from '../outlined-text';
import { VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { drawIcon } from './icon-button';

const cfg = MENU.streak;

/** One cell of the streak calendar: the day, the reward picture and amount, the state. */
export class StreakCell extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Components.Alpha[] = [];
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly cellWidth: number,
    readonly cell: CalendarCell,
  ) {
    super(scene, x, y);
    createTreasureTextures(scene);
    const { state, reward, position } = cell;
    const fill = state === 'done' ? cfg.doneFill : PALETTE.panel;
    const rim = state === 'today' ? cfg.todayRim : PALETTE.panelShadow;
    this.add(new VolumePlate(scene, 'card', cfg.cellHeight, { fill, rim }).setBodyWidth(cellWidth));
    const half = cfg.cellHeight / 2;
    this.add(
      createOutlinedText(
        scene,
        0,
        -half + cfg.dayFont,
        t('streak.day', { n: position }),
        cfg.dayFont,
      ),
    );

    let amount: string;
    let image: Phaser.GameObjects.Image;
    if (reward.kind === 'creature') {
      image = scene.add
        .image(0, -cfg.iconLift, CREATURE_ICON_KEYS[reward.id])
        .setDisplaySize(cfg.creatureIcon, cfg.creatureIcon);
      amount = t(CREATURES[reward.id].nameKey);
    } else {
      const texture = reward.kind === 'coins' ? TREASURE_TEXTURES.coin : TREASURE_TEXTURES.berry;
      image = scene.add.image(0, -cfg.iconLift, texture).setDisplaySize(cfg.iconSize, cfg.iconSize);
      amount = `+${formatNumber(reward.amount)}`;
    }
    const color = reward.kind === 'coins' ? PALETTE.gold : PALETTE.textLight;
    const label = fitText(
      createOutlinedText(scene, 0, half - cfg.amountInset, amount, cfg.amountFont, color),
      cellWidth - cfg.cellGap * 2,
    );
    this.art.push(image, label);
    this.add([image, label]);
    this.setSize(cellWidth, cfg.cellHeight);
    if (state === 'done') this.markDone(false);
    if (state === 'today') this.startPulse();
    scene.add.existing(this);
  }

  /** Where the reward pictures start from, in screen pixels. */
  get screenPoint(): { x: number; y: number } {
    const m = this.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  /** The day passed: the cell greys, a green tick pops onto its corner. */
  markDone(animated: boolean): void {
    this.pulse?.stop();
    this.pulse = null;
    this.setScale(1);
    for (const part of this.art) part.setAlpha(cfg.doneAlpha);
    const { size, color, offset, halo } = cfg.tick;
    const g = this.scene.add.graphics();
    g.fillStyle(PALETTE.textDark, 1).fillCircle(0, 0, size / 2 + halo);
    g.fillStyle(color, 1).fillCircle(0, 0, size / 2);
    drawIcon(g, 'missions', 0, 0, size);
    g.setPosition(this.cellWidth / 2 - offset - size / 2, -cfg.cellHeight / 2 + offset + size / 2);
    this.add(g);
    if (!animated) return;
    g.setScale(0);
    this.scene.tweens.add({
      targets: g,
      scale: 1,
      duration: cfg.todayPulse.ms / 2,
      ease: 'Back.easeOut',
    });
  }

  private startPulse(): void {
    this.pulse = this.scene.tweens.add({
      targets: this,
      scale: cfg.todayPulse.scale,
      duration: cfg.todayPulse.ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
