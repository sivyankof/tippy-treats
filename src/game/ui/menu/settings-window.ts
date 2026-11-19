import type * as Phaser from 'phaser';
import { APP_VERSION, BUILD_HASH, BUILD_TIME } from '../../../data/app/app-info';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { getLang, t } from '../../../i18n';
import { gameState } from '../../../state';
import {
  notificationsAnyOn,
  setAllNotifications,
  setLanguage,
  setNotificationOn,
  type NotificationKind,
} from '../../apply-settings';
import { productOwned } from '../../../core/shop';
import { buyProduct, loadPrices, restorePurchases } from '../../purchases';
import { createTextButton } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/dialog-window';
import { openConfirmWindow } from './confirm-window';
import { fitText } from './fit-text';
import { createToggleRows, soundSettingRows, type ToggleRowSpec } from './setting-toggles';

const cfg = MENU.settings;
const NOTIFY_KINDS: readonly NotificationKind[] = ['gift', 'streak', 'daily', 'comeback'];

export interface SettingsHandlers {
  /** The language changed: the screen has to be built again in the new one (the window then reopens). */
  onLanguage: () => void;
  /** The progress was wiped: the game starts again from the first launch. */
  onReset: () => void;
  onClosed?: () => void;
}

/** The general switch and one switch per type; the types are shifted right under the general one. */
function notificationRows(): ToggleRowSpec[] {
  return [
    { label: t('settings.notifications'), read: notificationsAnyOn, write: setAllNotifications },
    ...NOTIFY_KINDS.map((kind) => ({
      label: t(`settings.notify.${kind}`),
      read: () => gameState.settings.notifications[kind],
      write: (on: boolean) => setNotificationOn(kind, on),
      indent: cfg.notifyIndent,
    })),
  ];
}

/**
 * The settings window (docs/07, section 13): sounds, music, vibration and effects, language,
 * notifications, restore purchases, version and "Reset progress" with two confirmations.
 */
export function openSettingsWindow(scene: Phaser.Scene, handlers: SettingsHandlers): PopupWindow {
  const popup = new PopupWindow(scene, { title: t('settings.title'), onClosed: handlers.onClosed });
  const width = popup.innerWidth;
  let y = 0;

  const sounds = createToggleRows(scene, soundSettingRows(), { x: 0, top: y, width });
  y = sounds.bottom + cfg.blockGap;

  const language = createLanguageRow(scene, y, width, handlers.onLanguage);
  y += cfg.language.height + cfg.blockGap;

  const notify = createToggleRows(scene, notificationRows(), { x: 0, top: y, width });
  y = notify.bottom + cfg.blockGap;

  const wide = (label: string, fill: number, top: number, onClick: () => void) =>
    createTextButton(scene, {
      text: label,
      font: cfg.wideButton.font,
      maxLabelWidth: cfg.wideButton.width - cfg.wideButton.radius * 2,
      fill,
      layout: cfg.wideButton,
      keyPrefix: 'ui_settings_wide',
      y: top + cfg.wideButton.height / 2,
      onClick,
    }).button;

  let busy = false;
  const result = createOutlinedText(
    scene,
    0,
    y + cfg.wideButton.height + cfg.resultHeight / 2,
    '',
    cfg.resultFont,
  );
  // The price comes from the store a moment later: its place is kept, the button joins when it is known.
  const noAdsTop = y;
  const noAdsRoom = cfg.wideButton.height + cfg.noAdsGap;
  y += noAdsRoom;
  const restore = wide(t('shop.restore'), cfg.restoreFill, y, () => {
    if (busy) return;
    busy = true;
    restore.setEnabled(false);
    void restorePurchases().then((outcome) => {
      busy = false;
      if (!result.active) return;
      restore.setEnabled(true);
      result.setText(t(`shop.restoreResult.${outcome}`));
      fitText(result, width);
    });
  });
  y += cfg.wideButton.height + cfg.resultHeight + cfg.blockGap;

  // The credits line may wrap onto a second line; the lines under it move down by what it took.
  const credits = createOutlinedText(scene, 0, 0, t('settings.musicCredits'), cfg.infoFont)
    .setAlign('center')
    .setWordWrapWidth(width, true)
    .setAlpha(cfg.infoAlpha);
  const creditLines = credits.getWrappedText().length;
  credits.setY(y + (cfg.infoLine * creditLines) / 2);
  y += cfg.infoLine * creditLines;
  const info = [
    t('settings.version', { version: APP_VERSION }),
    t('settings.build', { hash: BUILD_HASH, date: BUILD_TIME }),
    t('settings.installId', { id: gameState.data.installId.slice(0, cfg.installIdChars) }),
  ].map((line, i) =>
    createOutlinedText(scene, 0, y + cfg.infoLine * (i + 0.5), line, cfg.infoFont).setAlpha(
      cfg.infoAlpha,
    ),
  );
  y += cfg.infoLine * info.length + cfg.blockGap;

  const reset = wide(t('settings.reset'), PALETTE.danger, y, () =>
    askReset(scene, handlers.onReset),
  );
  y += cfg.wideButton.height;

  popup.content.add([
    ...sounds.toggles,
    ...language,
    ...notify.toggles,
    restore,
    result,
    credits,
    ...info,
    reset,
  ]);
  popup.setContentHeight(y);

  /** "No ads · {price}": only while it is not bought and the store gave a price; otherwise the place stays empty. */
  const addNoAdsButton = async (): Promise<void> => {
    if (productOwned(gameState.data, 'remove_ads')) return;
    const price = (await loadPrices()).remove_ads;
    if (price === undefined || !result.active) return;
    const button = wide(t('settings.noAds', { price }), cfg.noAdsFill, noAdsTop, () => {
      if (busy) return;
      busy = true;
      button.setEnabled(false);
      void buyProduct('remove_ads').then((outcome) => {
        busy = false;
        if (!result.active) return;
        if (outcome === 'purchased') {
          button.setVisible(false);
          result.setText(t('shop.owned'));
        } else {
          button.setEnabled(true);
          if (outcome === 'pending') result.setText(t('shop.pending'));
          else if (outcome !== 'cancelled') result.setText(t('shop.failed'));
        }
        fitText(result, width);
      });
    });
    popup.content.add(button);
  };
  void addNoAdsButton();
  return popup;
}

/** "Language" and the two buttons; the chosen one is lit and cannot be pressed again. */
function createLanguageRow(
  scene: Phaser.Scene,
  top: number,
  width: number,
  onChanged: () => void,
): Phaser.GameObjects.GameObject[] {
  const { height, font, button, buttonGap, picked, other } = cfg.language;
  const centre = top + height / 2;
  const buttonsWidth = button.width * 2 + buttonGap;
  const label = createOutlinedText(
    scene,
    -width / 2,
    centre,
    t('settings.language'),
    font,
  ).setOrigin(0, 0.5);
  fitText(label, width - buttonsWidth - MENU.style.toggle.labelGap);
  const options = [
    { lang: 'en', label: t('settings.langEn') },
    { lang: 'ru', label: t('settings.langRu') },
  ] as const;
  const buttons = options.map(({ lang, label: text }, i) => {
    const chosen = getLang() === lang;
    const made = createTextButton(scene, {
      text,
      font: button.font,
      maxLabelWidth: button.width - button.radius,
      fill: chosen ? picked : other,
      layout: button,
      keyPrefix: 'ui_settings_lang',
      x: width / 2 - buttonsWidth + button.width / 2 + i * (button.width + buttonGap),
      y: centre,
      onClick: () => {
        setLanguage(lang);
        onChanged();
      },
    }).button;
    made.setEnabled(!chosen);
    return made;
  });
  return [label, ...buttons];
}

/** Two confirmations one after the other; only the second one wipes the progress. */
function askReset(scene: Phaser.Scene, onReset: () => void): void {
  openConfirmWindow(scene, {
    title: t('settings.resetAsk.title'),
    text: t('settings.resetAsk.text'),
    cancelLabel: t('settings.resetAsk.cancel'),
    confirmLabel: t('settings.resetAsk.next'),
    confirmFill: PALETTE.accentSecondary,
    onConfirm: () =>
      openConfirmWindow(scene, {
        title: t('settings.resetSure.title'),
        text: t('settings.resetSure.text'),
        cancelLabel: t('settings.resetAsk.cancel'),
        confirmLabel: t('settings.resetSure.confirm'),
        confirmFill: PALETTE.danger,
        onConfirm: () => {
          gameState.resetProgress();
          onReset();
        },
      }),
  });
}
