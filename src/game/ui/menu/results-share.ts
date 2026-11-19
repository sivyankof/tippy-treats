import type * as Phaser from 'phaser';
import { SHARE_CARD } from '../../../data/run/share';
import { t, tn } from '../../../i18n';
import { services } from '../../../services';
import type { ResultsData } from '../../scene-keys';
import { showToast } from '../style/toast';
import { renderShareCard } from './share-card';

/**
 * Makes the picture of the finished tower and hands it to the share service; a download or a
 * failure is told to the player with a short notice. A closed share sheet says nothing.
 */
export async function shareResult(scene: Phaser.Scene, data: ResultsData): Promise<void> {
  const height = data.result.height;
  let notice: string | null = null;
  try {
    const image = await renderShareCard(scene, data.tower, height);
    const outcome = await services.share.shareImage({
      image,
      fileName: SHARE_CARD.fileName,
      text: tn('share.text', height),
      title: t('share.title'),
    });
    if (outcome === 'downloaded') notice = t('share.saved');
    else if (outcome === 'failed') notice = t('share.failed');
  } catch {
    notice = t('share.failed');
  }
  // The player may have left the screen while the picture was being made.
  if (notice !== null && scene.sys.isActive()) showToast(scene, notice);
}
