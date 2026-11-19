import type * as Phaser from 'phaser';
import type { TeamSlot } from '../../../core/tower/sim-types';
import { CREATURES, type CreatureId } from '../../../data/creatures/creatures';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { gameState } from '../../../state';
import { t } from '../../../i18n';
import { attachPressFeedback } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/dialog-window';
import { CreatureCard } from './creature-card';
import { createCaption, type DailySection } from './daily-section';
import { abilityText } from './detail-model';
import { onFontRefresh } from './fit-text';

const card = MENU.card;
const caption = MENU.daily.caption;
const win = MENU.daily.abilityWindow;

/** The ability of a team creature at the level of the team of the day, as in its collection card. */
export function openAbilityWindow(scene: Phaser.Scene, id: CreatureId, level: number): void {
  const popup = new PopupWindow(scene, { title: t(CREATURES[id].nameKey) });
  const levelLine = createOutlinedText(
    scene,
    0,
    win.levelY,
    t('daily.level', { n: level }),
    win.levelFont,
    PALETTE.gold,
  );
  const text = createOutlinedText(scene, 0, win.textTop, abilityText(id, level), win.font)
    .setOrigin(0.5, 0)
    .setAlign('center')
    .setWordWrapWidth(popup.innerWidth, true);
  popup.content.add([levelLine, text]);
  const fit = (): void => popup.setContentHeight(win.textTop + text.height + win.padBottom);
  fit();
  // A late web font can wrap the text differently.
  onFontRefresh(text, fit);
}

/** The team of the day: a caption and three creature cards; a tap pokes the creature and hands it to `onTap`. */
export class DailyTeam implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = caption.height + card.height;
  private readonly cards: CreatureCard[];

  constructor(scene: Phaser.Scene, team: readonly TeamSlot[], onTap: (slot: TeamSlot) => void) {
    const step = card.width + MENU.daily.team.gapX;
    const x0 = (-(team.length - 1) * step) / 2;
    this.cards = team.map((slot, i) => {
      const view = new CreatureCard(
        scene,
        x0 + i * step,
        caption.height + card.height / 2,
        { id: slot.id, level: slot.level, bakerLevel: gameState.data.bakerLevel },
        card,
      );
      view.setInteractive();
      view.on('pointerdown', () => view.portrait?.poke());
      attachPressFeedback(view, { onTap: () => onTap(slot) });
      return view;
    });
    this.root = scene.add.container(0, 0, [createCaption(scene, t('daily.team')), ...this.cards]);
  }

  tick(dtMs: number): void {
    for (const view of this.cards) view.tick(dtMs);
  }
}
