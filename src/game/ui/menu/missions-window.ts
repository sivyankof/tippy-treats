import type * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { t } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import type { CreatureId } from '../../../data/creatures/creatures';
import type { LevelUp } from '../../../state/game-state';
import { msUntilLocalMidnight, now } from '../../../util/clock';
import type { Button } from '../common/button';
import { createOutlinedText } from '../common/outlined-text';
import { PopupWindow } from '../style/dialog-window';
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

/** The missions window: three missions of the day, the chest, the reroll (docs/07-ui-screens.md, section 11). */
export function openMissionsWindow(
  scene: Phaser.Scene,
  onClosed?: (newCreatures: CreatureId[]) => void,
  wallet?: WalletTargets,
): void {
  gameState.refreshDay();
  const timer = { event: null as Phaser.Time.TimerEvent | null };
  // Levels reached here are kept until the window is closed; the creatures they handed out go back to the caller.
  // (Home shows them; they are already in the save, so a window torn down early loses only the show.)
  const levelUps: LevelUp[] = [];
  const popup = new PopupWindow(scene, {
    title: t('missions.title'),
    onClosed: () => {
      timer.event?.remove(false);
      onClosed?.(newCreaturesOf(levelUps));
    },
  });
  const width = popup.innerWidth;
  const timerText = createOutlinedText(scene, 0, 0, '', cfg.timerFont);
  popup.content.add(timerText);
  const tick = (): void => {
    timerText.setText(t('missions.newIn', { time: formatTimeLeft(msUntilLocalMidnight(now())) }));
  };

  // The chest on screen, and whether the next one is built already opened by a tap just now.
  let chest: MissionsChest | null = null;
  let justOpened = false;

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
            showLevelUps(scene, claim.levelUps, () => levelUps.push(...claim.levelUps));
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
    chest = new MissionsChest(scene, y + cfg.chestHeight / 2, {
      width,
      claimed: items.filter((item) => item.claimed).length,
      total: items.length,
      opened: chestClaimed,
      justOpened,
      onOpen: () => {
        const berries = gameState.claimChest();
        if (berries <= 0) {
          build();
          return;
        }
        services.audio.berry();
        services.haptics.play('success');
        justOpened = true;
        build();
        // The berries come out of the chest that was just rebuilt, flipping its lid.
        flyReward(scene, {
          currency: 'berries',
          amount: berries,
          from: chest?.openingPoint() ?? { x: 0, y: 0 },
          wallet,
          pour: true,
          // The berries wait until the lid has folded and popped, so it can be seen.
          startDelayMs: cfg.chestMotion.open.foldMs + cfg.chestMotion.open.popMs,
          ...cfg.chestPour,
        });
      },
    });
    justOpened = false;
    popup.content.add(chest);
    y += cfg.chestHeight + cfg.sectionGap;
    timerText.setY(y + cfg.timerHeight / 2);
    popup.setContentHeight(y + cfg.timerHeight);
  };

  build();
  tick();
  timer.event = scene.time.addEvent({ delay: cfg.timerTickMs, loop: true, callback: tick });
}
