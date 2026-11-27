import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { t } from '../../../../i18n';
import { services } from '../../../../services';
import { ensureSignedIn } from '../../../games/games-actions';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { guardBusy } from '../widgets/games-button';
import type { Button } from '../../common/button';
import { createLinkButton } from './link-button';

const cfg = MENU.settings;

/**
 * The Game Center row of the settings (docs/07-ui-screens.md, section 13), a link-row high with
 * its top edge at `top`: "Sign in to Game Center" while signed out, the line "Game Center: signed
 * in" once signed in. It follows the status while the window stands.
 */
export function createGamesRow(
  scene: Phaser.Scene,
  width: number,
  top: number,
): Phaser.GameObjects.Container {
  const centre = top + cfg.links.height / 2;
  const line = fitText(
    createOutlinedText(scene, 0, 0, t('games.signedIn'), cfg.links.font),
    width,
  );
  const button: Button = createLinkButton(
    scene,
    t('games.signIn'),
    width,
    -cfg.links.height / 2,
    guardBusy(
      () => button,
      () => ensureSignedIn(scene, 'settings'),
    ),
  );
  const row = scene.add.container(0, centre, [button, line]);
  const show = (): void => {
    const signedIn = services.games.status() === 'signed_in';
    button.setVisible(!signedIn);
    line.setVisible(signedIn);
  };
  show();
  const off = services.games.onStatus(() => {
    if (row.active) show();
  });
  row.once(Phaser.GameObjects.Events.DESTROY, off);
  return row;
}
