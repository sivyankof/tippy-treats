import type * as Phaser from 'phaser';
import { APP_VERSION, BUILD_HASH, BUILD_TIME } from '../../../../data/app/app-info';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { getLang, t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { DEBUG_MENU } from '../../../../data/debug/debug-menu';
import { createTapSequence } from '../../../../util/tap-sequence';
import {
  notificationsAnyOn,
  setAllNotifications,
  setLanguage,
  setNotificationOn,
  type NotificationKind,
} from '../../../app/apply-settings';
import { productOwned } from '../../../../core/economy/shop';
import { sitePageIn, type SitePage } from '../../../../data/app/site';
import { services } from '../../../../services';
import {
  buyOutcomeKey,
  buyProduct,
  loadPrices,
  restorePurchases,
} from '../../../economy/purchases';
import { createTextButton } from '../../common/button';
import { rowCentres } from '../../common/button-row';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { openConfirmWindow } from './confirm-window';
import { fitText, fitTextGroup, wrapWithoutLoneWord } from '../widgets/fit-text';
import { openSupportMail, shortInstallId } from '../../../app/support-contact';
import { createToggleRows, soundSettingRows, type ToggleRowSpec } from './setting-toggles';
import { createLinkButton } from './link-button';
import { createGamesRow } from './games-row';
import { gamesShown } from '../../../games/games-actions';
import { cloudAfterReset, cloudSync } from '../../../cloud/cloud-actions';
import { createCloudRow } from './cloud-row';

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
 * notifications, restore purchases, the site links, version and "Reset progress" with two
 * confirmations.
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
  // The price comes from the store a moment later: its place is kept, the button joins when it is
  // known. Once "No ads" is bought there is no place for it: nothing is left empty.
  const noAdsTop = y;
  const noAdsRoom = productOwned(gameState.data, 'remove_ads')
    ? 0
    : cfg.wideButton.height + cfg.noAdsGap;
  y += noAdsRoom;
  // The result line stands in its own room under "Restore purchases", never over a button.
  const result = createOutlinedText(
    scene,
    0,
    y + cfg.wideButton.height + cfg.resultHeight / 2,
    '',
    cfg.resultFont,
  );
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
      // The restore may have given "No ads" back: its button goes, like after a purchase.
      if (productOwned(gameState.data, 'remove_ads')) dropNoAds();
    });
  });
  y += cfg.wideButton.height + cfg.resultHeight + cfg.blockGap;

  const links = createSiteLinks(scene, y, width);
  y += cfg.links.height + cfg.links.gap + cfg.links.height;

  // Only where the consent form of the ads is required (known once the consent flow has run); a full-width
  // link row like "Contact us", right under it.
  const privacy = services.consent.privacyOptionsRequired()
    ? createLinkButton(scene, t('settings.privacyOptions'), width, y + cfg.links.gap, () => {
        void services.consent.showPrivacyOptions();
      })
    : null;
  if (privacy) y += cfg.links.gap + cfg.links.height;
  // Game Center: a row of the same kind right under them, only where the game services are.
  const games = gamesShown() ? createGamesRow(scene, width, y + cfg.links.gap) : null;
  if (games) y += cfg.links.gap + cfg.links.height;
  y += cfg.blockGap;

  // The iCloud line sits above the credits, only where the cloud copy exists.
  const cloud = cloudSync().status !== 'unsupported' ? createCloudRow(scene, width, y) : null;
  if (cloud) y += cfg.infoLine + cfg.cloudGap;

  // The credits line may wrap onto a second line; the lines under it move down by what it took.
  const credits = createOutlinedText(scene, 0, 0, t('settings.musicCredits'), cfg.infoFont)
    .setAlign('center')
    .setAlpha(cfg.infoAlpha);
  const creditLines = wrapWithoutLoneWord(credits, width);
  credits.setY(y + (cfg.infoLine * creditLines) / 2);
  y += cfg.infoLine * creditLines;
  const info = [
    t('settings.version', { version: APP_VERSION }),
    t('settings.build', { hash: BUILD_HASH, date: BUILD_TIME }),
    t('settings.installId', { id: shortInstallId(gameState.data.installId) }),
  ].map((line, i) =>
    createOutlinedText(scene, 0, y + cfg.infoLine * (i + 0.5), line, cfg.infoFont).setAlpha(
      cfg.infoAlpha,
    ),
  );
  // Internal builds only: taps on the version line open the debug menu. The test is written out here, not
  // taken from `build-kind.ts`: the bundler folds only a direct `import.meta.env` test, and the store build must lose the menu chunk.
  if (import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1') {
    const taps = createTapSequence(DEBUG_MENU.openTaps, DEBUG_MENU.openWindowMs);
    info[0]?.setInteractive().on('pointerup', () => {
      if (taps.tap()) void import('../../../debug/debug-menu').then((menu) => menu.showDebugMenu());
    });
  }
  y += cfg.infoLine * info.length + cfg.blockGap;

  const reset = wide(t('settings.reset'), PALETTE.danger, y, () =>
    askReset(scene, handlers.onReset),
  );
  y += cfg.wideButton.height;

  // Everything under the place of "No ads": it moves up into that place once "No ads" is bought here.
  const underNoAds: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> = [
    restore,
    result,
    ...links,
    ...(privacy ? [privacy] : []),
    ...(games ? [games] : []),
    ...(cloud ? [cloud] : []),
    credits,
    ...info,
    reset,
  ];
  popup.content.add([...sounds.toggles, ...language, ...notify.toggles, ...underNoAds]);
  popup.setContentHeight(y);
  let noAdsButton: Phaser.GameObjects.Container | null = null;
  let noAdsGone = noAdsRoom === 0;
  /** "No ads" is owned now: its button (if it came) goes and the parts under it move up into its place, once. */
  function dropNoAds(): void {
    if (noAdsGone) return;
    noAdsGone = true;
    noAdsButton?.destroy();
    noAdsButton = null;
    for (const part of underNoAds) part.y -= noAdsRoom;
    popup.setContentHeight(y - noAdsRoom);
  }

  /**
   * "No ads · {price}": only while it is not bought and the store gave a price. While the price is
   * unknown its place stays empty; when "No ads" is owned there is no place at all.
   */
  const addNoAdsButton = async (): Promise<void> => {
    if (noAdsGone) return;
    const price = (await loadPrices()).remove_ads;
    if (!result.active || noAdsGone) return;
    if (productOwned(gameState.data, 'remove_ads')) {
      dropNoAds();
      return;
    }
    if (price === undefined) return;
    const button = wide(t('settings.noAds', { price }), cfg.noAdsFill, noAdsTop, () => {
      if (busy) return;
      busy = true;
      button.setEnabled(false);
      void buyProduct('remove_ads').then((outcome) => {
        busy = false;
        if (!result.active) return;
        if (outcome === 'purchased') {
          dropNoAds();
          result.setText(t('shop.owned'));
        } else {
          button.setEnabled(true);
          const key = buyOutcomeKey(outcome);
          if (key !== null) result.setText(t(key));
        }
        fitText(result, width);
      });
    });
    noAdsButton = button;
    popup.content.add(button);
  };
  void addNoAdsButton();
  return popup;
}

const SITE_LINKS: readonly SitePage[] = ['privacy', 'terms', 'support'];

/**
 * Privacy, terms, support: equal buttons across the window, each opens its page of the site in the
 * game's language; their labels share one size. Under them the wide "Contact us" button.
 */
function createSiteLinks(
  scene: Phaser.Scene,
  top: number,
  width: number,
): Phaser.GameObjects.Container[] {
  const { height, radius, shadowOffset, font, gap, fill } = cfg.links;
  const buttonWidth = (width - gap * (SITE_LINKS.length - 1)) / SITE_LINKS.length;
  const layout = { width: buttonWidth, height, radius, shadowOffset, font };
  const xs = rowCentres(width / 2, buttonWidth, SITE_LINKS.length, gap);
  const links = SITE_LINKS.map((page, i) =>
    createTextButton(scene, {
      text: t(`settings.links.${page}`),
      font,
      maxLabelWidth: buttonWidth - radius * 2,
      fill,
      layout,
      keyPrefix: 'ui_settings_link',
      x: xs[i],
      y: top + height / 2,
      onClick: () => services.appShell.openExternal(sitePageIn(page, getLang())),
    }),
  );
  fitTextGroup(
    links.map((link) => link.label),
    buttonWidth - radius * 2,
  );
  const contact = createLinkButton(
    scene,
    t('settings.contact'),
    width,
    top + height + gap,
    () => void openSupportMail(),
  );
  return [...links.map((link) => link.button), contact];
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
  const xs = rowCentres(width / 2, button.width, options.length, buttonGap);
  const buttons = options.map(({ lang, label: text }, i) => {
    const chosen = getLang() === lang;
    const made = createTextButton(scene, {
      text,
      font: button.font,
      maxLabelWidth: button.width - button.radius,
      fill: chosen ? picked : other,
      layout: button,
      keyPrefix: 'ui_settings_lang',
      x: xs[i],
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
  const status = cloudSync().status;
  const cloudOn = status !== 'unsupported' && status !== 'off';
  openConfirmWindow(scene, {
    title: t('settings.resetAsk.title'),
    text: t(cloudOn ? 'settings.resetAsk.textCloud' : 'settings.resetAsk.text'),
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
          cloudAfterReset();
          onReset();
        },
      }),
  });
}
