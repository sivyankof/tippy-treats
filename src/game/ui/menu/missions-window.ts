import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { t } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import type { LevelUp } from '../../../state/game-state';
import { openScreen, SCENES, type NewCreatureData } from '../../scene-keys';
import { msUntilLocalMidnight, now } from '../../../util/clock';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/dialog-window';
import type { Button } from '../button';
import { showLevelUps } from './level-up-chain';
import { newCreaturesOf } from './results-text';
import { MissionCard } from './missions-card';
import { MissionsChest } from './missions-chest';
import { flyReward, type WalletTargets } from './reward-flight';
import { formatTimeLeft } from './time-text';

const cfg = MENU.missions;

/** Where the middle of a button is on the screen. */
function screenPoint(button: Button): { x: number; y: number } {
  const matrix = button.getWorldTransformMatrix();
  return { x: matrix.tx, y: matrix.ty };
}

/** The creatures a level handed out get the new creature screen, then Home comes back (as after a run). */
function presentLevelCreatures(scene: Phaser.Scene, levelUps: readonly LevelUp[]): void {
  const creatures = newCreaturesOf(levelUps);
  if (creatures.length === 0) return;
  const data: NewCreatureData = { creatures, then: { kind: 'screen', key: SCENES.home } };
  openScreen(scene, SCENES.newCreature, data);
}

/** The missions window: three missions of the day, the chest, the reroll (docs/07-ui-screens.md, section 11). */
export function openMissionsWindow(
  scene: Phaser.Scene,
  onClosed?: () => void,
  wallet?: WalletTargets,
): void {
  gameState.refreshDay();
  const timer = { event: null as Phaser.Time.TimerEvent | null };
  const popup = new PopupWindow(scene, {
    title: t('missions.title'),
    onClosed: () => {
      timer.event?.remove(false);
      onClosed?.();
    },
  });
  const width = popup.innerWidth;
  const timerText = createOutlinedText(scene, 0, 0, '', cfg.timerFont);
  popup.content.add(timerText);
  const tick = (): void => {
    timerText.setText(t('missions.newIn', { time: formatTimeLeft(msUntilLocalMidnight(now())) }));
  };

  const build = (): void => {
    popup.content.each((child: Phaser.GameObjects.GameObject) => {
      if (child !== timerText) child.destroy();
    });
    const { items, rerollUsed, chestClaimed } = gameState.missions;
    let y = 0;
    items.forEach((item, index) => {
      const card = new MissionCard(scene, y + cfg.cardHeight / 2, {
        item,
        width,
        canReroll: !rerollUsed && !item.claimed && item.progress < item.target,
        rerollUsed,
        onClaim: (button) => {
          const claim = gameState.claimMission(index);
          if (claim) {
            services.haptics.play('success');
            flyReward(scene, {
              currency: 'coins',
              amount: claim.coins,
              from: screenPoint(button),
              wallet,
            });
          }
          build();
          if (claim && claim.levelUps.length > 0) {
            showLevelUps(scene, claim.levelUps, () => presentLevelCreatures(scene, claim.levelUps));
          }
        },
        onReroll: () => {
          if (gameState.rerollMission(index)) services.haptics.play('medium');
          build();
        },
      });
      popup.content.add(card);
      y += cfg.cardHeight + cfg.cardGap;
    });
    y += cfg.sectionGap - cfg.cardGap;
    popup.content.add(
      new MissionsChest(scene, y + cfg.chestHeight / 2, {
        width,
        claimed: items.filter((item) => item.claimed).length,
        total: items.length,
        opened: chestClaimed,
        onOpen: (button) => {
          const berries = gameState.claimChest();
          if (berries > 0) {
            services.audio.berry();
            services.haptics.play('success');
            flyReward(scene, {
              currency: 'berries',
              amount: berries,
              from: screenPoint(button),
              wallet,
            });
          }
          build();
        },
      }),
    );
    y += cfg.chestHeight + cfg.sectionGap;
    timerText.setY(y + cfg.timerHeight / 2);
    popup.setContentHeight(y + cfg.timerHeight);
  };

  build();
  tick();
  timer.event = scene.time.addEvent({ delay: cfg.timerTickMs, loop: true, callback: tick });
}
