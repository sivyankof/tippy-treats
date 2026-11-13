import type * as Phaser from 'phaser';
import { nextCreature, type NextCreature } from '../../core/team-queue';
import type { TeamSlot } from '../../core/sim-types';
import { ANIM } from '../../data/anim';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t, tn } from '../../i18n';
import { CREATURE_ICON_KEYS } from './creature-icons';
import { createStrokedText } from './outlined-text';

const { badgeSize, badgeGap, badgeMargin, badgeRowY, nextFont, nextStroke } = HUD_LAYOUT;

/** The words of the indicator: "now" on the creature layer, "in N layers" before it. */
export function nextCreatureLabel(next: Pick<NextCreature, 'inLayers'>): string {
  return next.inLayers === 0 ? t('run.nextCreatureNow') : tn('run.nextCreatureIn', next.inLayers);
}

/**
 * "Next creature" at the right of the badge row: the creature icon and how many layers away
 * its layer is. Hidden for a run without a team. The text pops when it changes, the icon when
 * another creature comes next.
 */
export class NextCreatureBadge {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private screenWidth = 0;
  private height = -1;
  private team: readonly (TeamSlot | null)[] | null = null;
  private shown: NextCreature | null = null;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.icon = scene.add
      .image(0, badgeRowY, CREATURE_ICON_KEYS.honey)
      .setDisplaySize(badgeSize, badgeSize)
      .setVisible(false);
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
      .setOrigin(1, 0.5)
      .setVisible(false);
  }

  /** Both parts, for screen transitions and tests of the layout. */
  get parts(): Phaser.GameObjects.GameObject[] {
    return [this.icon, this.label];
  }

  layout(screenWidth: number): void {
    this.screenWidth = screenWidth;
    this.place();
  }

  /** `height` is the tower height (twins count double); recomputed only when it or the team changes. */
  update(height: number, team: readonly (TeamSlot | null)[]): void {
    if (height === this.height && team === this.team) return;
    this.height = height;
    this.team = team;
    const next = nextCreature(height, team);
    const visible = next !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      this.icon.setVisible(visible);
      this.label.setVisible(visible);
    }
    if (next) this.show(next);
    this.shown = next;
  }

  private show(next: NextCreature): void {
    const creatureChanged = next.id !== this.shown?.id;
    const textChanged = creatureChanged || next.inLayers !== this.shown?.inLayers;
    if (!textChanged) return;
    if (creatureChanged) {
      this.icon.setTexture(CREATURE_ICON_KEYS[next.id]).setDisplaySize(badgeSize, badgeSize);
    }
    this.label.setText(nextCreatureLabel(next));
    this.place();
    // The first appearance (no previous value) does not pop.
    if (this.shown) this.pop(creatureChanged ? this.icon : this.label);
  }

  /** Text hugs the right margin, the icon sits to its left. */
  private place(): void {
    const right = this.screenWidth - badgeMargin;
    this.label.setX(right);
    this.icon.setX(right - this.label.width - badgeGap - badgeSize / 2);
  }

  private pop(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    const { nextPopScale, nextPopMs, nextPopEase } = ANIM.badges;
    // The icon rests at the scale that makes it `badgeSize` wide, the text at 1.
    const rest = target === this.icon ? badgeSize / this.icon.width : 1;
    this.scene.tweens.killTweensOf(target);
    target.setScale(rest * nextPopScale);
    this.scene.tweens.add({ targets: target, scale: rest, duration: nextPopMs, ease: nextPopEase });
  }
}
