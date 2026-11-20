import type * as Phaser from 'phaser';
import { NOTIF } from '../../../../data/progression/notif';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import { ensureNotifPermission } from '../../../app/notif-permission';
import { openConfirmWindow } from '../settings/confirm-window';
import type { HomeAsk } from './home-asks';

/**
 * The notification permission, asked once after the third finished run (docs/04-meta-retention.md,
 * section 7): the game's own question first, the system dialog only after "Yes". "Not now" (or
 * closing the window) is an answer too: the question is marked asked when it opens and never comes
 * by itself again. The settings switches can still ask the system later.
 */
export const notifAsk: HomeAsk = {
  name: 'notifications',
  due: () => !gameState.data.consent.notifAsked && gameState.runsFinished >= NOTIF.askAfterRuns,
  run(scene: Phaser.Scene, done: (shown: boolean) => void): void {
    gameState.markNotifAsked();
    let answeredYes = false;
    openConfirmWindow(scene, {
      title: t('notifAsk.title'),
      text: t('notifAsk.text'),
      cancelLabel: t('notifAsk.later'),
      confirmLabel: t('notifAsk.yes'),
      confirmFill: PALETTE.accent,
      onConfirm: () => {
        answeredYes = true;
        void ensureNotifPermission({
          notifications: services.notifications,
          telemetry: services.telemetry,
          markAsked: () => gameState.markNotifAsked(),
        }).finally(() => done(true));
      },
      onClosed: () => {
        if (!answeredYes) done(true);
      },
    });
  },
};
