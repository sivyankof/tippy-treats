import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { t } from '../../../../i18n';
import { realNow } from '../../../../util/clock';
import { cloudSync } from '../../../cloud/cloud-actions';
import { agoOf } from '../../../cloud/cloud-summary';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';

const cfg = MENU.settings;

/** The line of the iCloud row for the current status of the cloud copy. */
function cloudLine(): string {
  const sync = cloudSync();
  if (sync.status !== 'saved') return t(`cloud.status.${sync.status}`);
  const { key, n } = agoOf(sync.savedAt ?? realNow(), realNow());
  return t('cloud.status.saved', { ago: t(`cloud.ago.${key}`, { n }) });
}

/**
 * The iCloud line of the settings (docs/07-ui-screens.md, section 13), one info line high with
 * its top edge at `top`. It follows the status while the window stands and rewrites the "ago"
 * part on a timer.
 */
export function createCloudRow(
  scene: Phaser.Scene,
  width: number,
  top: number,
): Phaser.GameObjects.Container {
  const line = createOutlinedText(scene, 0, 0, '', cfg.infoFont).setAlpha(cfg.infoAlpha);
  const show = (): void => {
    line.setText(cloudLine());
    fitText(line, width);
  };
  show();
  const row = scene.add.container(0, top + cfg.infoLine / 2, [line]);
  const off = cloudSync().onStatus(() => {
    if (row.active) show();
  });
  const timer = scene.time.addEvent({
    delay: cfg.cloudAgoRefreshMs,
    loop: true,
    callback: () => {
      if (row.active) show();
    },
  });
  row.once(Phaser.GameObjects.Events.DESTROY, () => {
    off();
    timer.remove(false);
  });
  return row;
}
