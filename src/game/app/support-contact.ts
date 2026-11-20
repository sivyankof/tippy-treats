import { SITE } from '../../data/app/site';
import { APP_VERSION, BUILD_HASH } from '../../data/app/app-info';
import { MENU } from '../../data/common/menu-layout';
import { t } from '../../i18n';
import { gameState } from '../../state';
import { services } from '../../services';
import type { AppShellService } from '../../services/app-shell/types';
import { buildMailBody, buildMailto } from '../../util/mailto';

/** The install id as the settings window shows it: the first characters only. */
export function shortInstallId(installId: string): string {
  return installId.slice(0, MENU.settings.installIdChars);
}

/** What goes into the letter besides the player's own words. */
export interface SupportFacts {
  version: string;
  buildHash: string;
  installId: string;
}

/**
 * The `mailto:` address of the support letter (docs/07-ui-screens.md, section 13): the subject and
 * the intro in the game's language, then the game version, the build, the install id the player
 * sees in the settings, the device model and the system version. Nothing else is read.
 */
export async function supportMailUrl(
  facts: SupportFacts,
  shell: Pick<AppShellService, 'deviceInfo' | 'appBuild'>,
  tr: (key: string) => string = t,
): Promise<string> {
  const [device, appBuild] = await Promise.all([shell.deviceInfo(), shell.appBuild()]);
  const build = appBuild === null ? facts.buildHash : `${appBuild} (${facts.buildHash})`;
  const body = buildMailBody(tr('contact.intro'), [
    { label: tr('contact.game'), value: facts.version },
    { label: tr('contact.build'), value: build },
    { label: tr('contact.install'), value: shortInstallId(facts.installId) },
    { label: tr('contact.device'), value: device.model },
    { label: tr('contact.os'), value: device.os },
  ]);
  return buildMailto(SITE.supportEmail, tr('contact.subject'), body);
}

/** "Contact us": opens the mail program with the letter prepared. */
export async function openSupportMail(): Promise<void> {
  const url = await supportMailUrl(
    { version: APP_VERSION, buildHash: BUILD_HASH, installId: gameState.data.installId },
    services.appShell,
  );
  services.appShell.openExternal(url);
}
