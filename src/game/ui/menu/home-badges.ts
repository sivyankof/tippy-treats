import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t, tn } from '../../../i18n';
import { gameState } from '../../../state';
import { cssColor } from '../../../util/color';
import { attachPressFeedback } from '../button';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { FlameIcon } from './flame-icon';
import { GiftBox } from './new-creature-box';
import { formatTimeLeft } from './time-text';

const cfg = MENU.home.badges;

/** Makes a container tappable over a `width` x `height` area around its origin, with press feedback. */
function makeTappable(
  box: Phaser.GameObjects.Container,
  width: number,
  height: number,
  onTap: () => void,
): void {
  // Container hit areas are measured from the top-left corner of its size.
  box.setSize(width, height);
  box.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  attachPressFeedback(box, { onTap });
}

/**
 * The two plates under the level plate of Home: the streak flame with the day count (opens the
 * calendar) and the gift box with its timer (opens the gift window).
 */
export class HomeBadges {
  readonly streak: Phaser.GameObjects.Container;
  readonly gift: Phaser.GameObjects.Container;
  private readonly streakPlate: VolumePlate;
  private readonly streakFlame: FlameIcon;
  private readonly streakLabel: Phaser.GameObjects.Text;
  private readonly giftLabel: Phaser.GameObjects.Text;
  private readonly giftBox: GiftBox;
  private enabled = true;
  private giftText = '';
  private giftIsReady = false;

  constructor(
    private readonly scene: Phaser.Scene,
    handlers: { streak: () => void; gift: () => void },
  ) {
    const { height } = cfg;
    this.streakPlate = new VolumePlate(scene, 'chip', height, { fill: cfg.streak.fill });
    this.streakFlame = new FlameIcon(scene, 0, 0, cfg.streak.flame);
    this.streakLabel = createOutlinedText(scene, 0, faceOffsetY('chip'), '', cfg.streak.font);
    this.streak = scene.add.container(0, 0, [this.streakPlate, this.streakFlame, this.streakLabel]);

    const giftPlate = new VolumePlate(scene, 'chip', height, { fill: cfg.gift.fill });
    giftPlate.setBodyWidth(cfg.gift.width);
    this.giftBox = new GiftBox(scene, -cfg.gift.width / 2 + cfg.gift.boxInset, 0).setScale(
      cfg.gift.box,
    );
    this.giftLabel = createOutlinedText(scene, 0, faceOffsetY('chip'), '', cfg.gift.font);
    this.gift = scene.add.container(0, 0, [giftPlate, this.giftBox, this.giftLabel]);

    this.refreshStreak();
    this.update();
    makeTappable(this.streak, this.streakPlate.width, height, () => this.tap(handlers.streak));
    makeTappable(this.gift, cfg.gift.width, height, () => this.tap(handlers.gift));
    scene.time.addEvent({ delay: cfg.shake.everyMs, loop: true, callback: () => this.shake() });
  }

  /** What slides in with the screen. */
  get parts(): Phaser.GameObjects.Container[] {
    return [this.streak, this.gift];
  }

  /** Streak plate on the left edge, gift plate on the right edge of a screen `width` wide. */
  layout(width: number): void {
    this.streak.setPosition(cfg.edge + this.streakPlate.width / 2, cfg.y);
    this.gift.setPosition(width - cfg.edge - cfg.gift.width / 2, cfg.y);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** The day count of the streak plate; call after the streak changed. */
  refreshStreak(): void {
    const { padX, flame, gap } = cfg.streak;
    this.streakLabel.setText(tn('home.streakDays', gameState.data.streak.count));
    const content = flame + gap + this.streakLabel.width;
    this.streakPlate.setBodyWidth(content + padX * 2);
    this.streakFlame.setX(-content / 2 + flame / 2);
    this.streakLabel.setX(content / 2 - this.streakLabel.width / 2);
    this.streak.setSize(this.streakPlate.width, cfg.height);
    if (this.streak.input) {
      this.streak.input.hitArea = new Phaser.Geom.Rectangle(
        0,
        0,
        this.streakPlate.width,
        cfg.height,
      );
    }
  }

  /** The timer of the gift plate; call every frame. */
  update(): void {
    const ready = gameState.giftReady;
    const text = ready ? t('home.giftReady') : formatTimeLeft(gameState.msUntilGift);
    if (text === this.giftText) return;
    this.giftText = text;
    this.giftIsReady = ready;
    const { width, boxInset, padRight } = cfg.gift;
    const left = -width / 2 + boxInset * 2;
    const right = width / 2 - padRight;
    this.giftLabel.setText(text).setColor(cssColor(ready ? cfg.readyColor : PALETTE.textLight));
    fitText(this.giftLabel, right - left).setX((left + right) / 2);
  }

  private tap(onTap: () => void): void {
    if (this.enabled) onTap();
  }

  /** A ready box shakes now and then. */
  private shake(): void {
    if (!this.giftIsReady) return;
    const { shakeMs, repeat, deg } = cfg.shake;
    this.scene.tweens.add({
      targets: this.giftBox,
      angle: { from: -deg, to: deg },
      duration: shakeMs,
      yoyo: true,
      repeat,
      onComplete: () => this.giftBox.setAngle(0),
    });
  }
}
