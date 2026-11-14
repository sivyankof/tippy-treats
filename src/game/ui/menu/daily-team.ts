import type * as Phaser from 'phaser';
import type { TeamSlot } from '../../../core/sim-types';
import { MENU } from '../../../data/menu-layout';
import { gameState } from '../../../state';
import { t } from '../../../i18n';
import { CreatureCard } from './creature-card';
import { createCaption, type DailySection } from './daily-section';

const card = MENU.card;
const caption = MENU.daily.caption;

/** The team of the day: a caption and three creature cards; a tap on a card pokes its creature. */
export class DailyTeam implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = caption.height + card.height;
  private readonly cards: CreatureCard[];

  constructor(scene: Phaser.Scene, team: readonly TeamSlot[]) {
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
      return view;
    });
    this.root = scene.add.container(0, 0, [createCaption(scene, t('daily.team')), ...this.cards]);
  }

  tick(dtMs: number): void {
    for (const view of this.cards) view.tick(dtMs);
  }
}
