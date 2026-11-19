import type * as Phaser from 'phaser';
import { nextCreature, type NextCreature } from '../../../core/creatures/team-queue';
import type { TeamSlots } from '../../../core/tower/sim-types';
import { ANIM } from '../../../data/common/anim';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { MENU } from '../../../data/common/menu-layout';
import { IDLE_MOTION, IDLE_PHASE } from '../../../data/common/idle-motion';
import { PALETTE } from '../../../data/common/palette';
import { createCreatureIcon, setCreatureIcon } from './creature-icons';
import { idlePose, type IdlePose } from '../common/idle-motion';
import { nextChipSpan, nextLabelPopScale } from '../run/hud-row-layout';
import { nextChipContent } from './next-creature-label';
import { effectsMode } from '../../effects-mode';
import { fxGuard } from '../../fx-guard';
import { formatNumber } from '../../../i18n';
import { createStrokedText } from '../common/outlined-text';
import { HudPlate } from '../style/hud-plate';

const { badgeSize, badgeRowY, nextFont, nextStroke, nextChip } = HUD_LAYOUT;

/**
 * "Next creature" at the right of the badge row: the creature icon and how many layers away
 * its layer is, on a see-through wallet chip of the kit. Hidden for a run without a team. The text pops when it changes, the icon when
 * another creature comes next.
 */
export class NextCreatureBadge {
  private readonly chip: HudPlate;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private screenWidth = 0;
  private height = -1;
  private team: TeamSlots | null = null;
  private shown: NextCreature | null = null;
  private visible = false;
  private compact = false;
  private suppressed = false;
  /** False while the chip shows the icon alone. */
  private labelShown = true;
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.chip = new HudPlate(scene, MENU.style.wallet.fill).setVisible(false);
    this.icon = createCreatureIcon(scene, 0, badgeRowY).setVisible(false);
    this.label = createStrokedText(
      scene,
      0,
      badgeRowY,
      '',
      nextFont,
      PALETTE.textLight,
      PALETTE.textDark,
      nextStroke,
    )
      .setOrigin(0, 0.5)
      .setVisible(false);
  }

  /** The parts, for screen transitions and tests of the layout. */
  get parts(): Phaser.GameObjects.GameObject[] {
    return [this.chip, this.icon, this.label];
  }

  layout(screenWidth: number): void {
    this.screenWidth = screenWidth;
    this.place();
  }

  /**
   * The icon and the text rock and bob a little while they are shown. Only angle and y are
   * driven: the pop tweens own the scale.
   */
  idle(timeMs: number): void {
    if (!this.visible) return;
    const icon = idlePose(IDLE_MOTION.nextIcon, timeMs, IDLE_PHASE.next, this.pose);
    this.icon.setAngle(icon.angle).setY(badgeRowY + icon.bob);
    const label = idlePose(IDLE_MOTION.nextLabel, timeMs, IDLE_PHASE.nextLabel, this.pose);
    this.label.setAngle(label.angle).setY(badgeRowY + label.bob);
  }

  /** `height` is the tower height (twins count double); recomputed only when it or the team changes. */
  update(height: number, team: TeamSlots, compact: boolean): void {
    if (height === this.height && team === this.team && compact === this.compact) return;
    this.height = height;
    this.team = team;
    const compactChanged = compact !== this.compact;
    this.compact = compact;
    const next = nextCreature(height, team);
    const visible = next !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      this.applyVisible();
    }
    if (next) this.show(next, compactChanged);
    this.shown = next;
  }

  /** The chip gives way while a master caption shows at its place. */
  setSuppressed(suppressed: boolean): void {
    if (suppressed === this.suppressed) return;
    this.suppressed = suppressed;
    this.applyVisible();
  }

  private applyVisible(): void {
    const on = this.visible && !this.suppressed;
    this.chip.setVisible(on);
    this.icon.setVisible(on);
    this.label.setVisible(on && this.labelShown);
  }

  private show(next: NextCreature, compactChanged: boolean): void {
    const creatureChanged = next.id !== this.shown?.id;
    const textChanged = creatureChanged || compactChanged || next.inLayers !== this.shown?.inLayers;
    if (!textChanged) return;
    if (creatureChanged) {
      setCreatureIcon(this.icon, next.id);
    }
    // A full badge row: the number of layers only; on the creature layer the icon alone, flashing.
    const content = nextChipContent(next, this.compact, formatNumber);
    this.label.setText(content.text ?? '');
    this.labelShown = content.text !== null;
    this.applyVisible();
    this.place();
    // The first appearance (no previous value) neither flashes nor pops.
    if (!this.shown) return;
    if (content.flash) fxGuard.call('hud-next-flash', this, this.flash);
    else this.pop(creatureChanged ? this.icon : this.label);
  }

  /** A short double pulse of the icon: smaller on lite, none on minimal. */
  private flash(): void {
    if (effectsMode.reduced) return;
    const { scale, liteScale, ms, ease } = ANIM.badges.nextFlash;
    const rest = badgeSize / this.icon.width;
    this.scene.tweens.killTweensOf(this.icon);
    this.icon.setScale(rest);
    this.scene.tweens.add({
      targets: this.icon,
      scale: rest * (effectsMode.atMost('lite') ? liteScale : scale),
      duration: ms,
      ease,
      yoyo: true,
      repeat: 1,
    });
  }

  /** The text is pinned by its left edge, a fixed gap after the icon (a pop grows it away from the icon); the chip runs from before the icon to past the text, so the icon never lies on the text. */
  private place(): void {
    const span = nextChipSpan(this.screenWidth, this.labelShown ? this.label.width : null);
    this.label.setX(span.labelLeft);
    this.icon.setX(span.iconX);
    this.chip.place(
      (span.chipLeft + span.chipRight) / 2,
      badgeRowY,
      span.chipRight - span.chipLeft,
      nextChip.height,
    );
  }

  /** The icon pops by `nextPopScale`; the text by less when it is wide (`nextLabelPopScale`). */
  private popScale(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text): number {
    return target === this.icon ? ANIM.badges.nextPopScale : nextLabelPopScale(this.label.width);
  }

  private pop(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    const { nextPopMs, nextPopEase } = ANIM.badges;
    // The icon rests at the scale that makes it `badgeSize` wide, the text at 1.
    const rest = target === this.icon ? badgeSize / this.icon.width : 1;
    this.scene.tweens.killTweensOf(target);
    target.setScale(rest * this.popScale(target));
    this.scene.tweens.add({ targets: target, scale: rest, duration: nextPopMs, ease: nextPopEase });
  }
}
