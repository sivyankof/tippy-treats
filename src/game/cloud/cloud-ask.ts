import type * as Phaser from 'phaser';
import type { CloudCopy } from '../../core/save/cloud-merge';
import { gameState } from '../../state';
import type { HomeAsk } from '../ui/menu/home/home-asks';
import { openChoiceWindow, openFoundWindow } from '../ui/menu/cloud/cloud-windows';
import { cloudSync } from './cloud-actions';
import { summarize } from './cloud-summary';

/** Home is built again on the taken save; no taps in between. */
function takeAndRebuild(scene: Phaser.Scene, copy: CloudCopy, keepLocal: boolean): void {
  scene.input.enabled = false;
  void cloudSync()
    .takeCloud(copy, keepLocal)
    .then(() => {
      scene.input.enabled = true;
      if (scene.sys.isActive()) scene.scene.restart();
    });
}

/**
 * The cloud decision that needs Home (docs/07-ui-screens.md, section 2.4), asked first on entry:
 * a copy grown from ours is taken silently and Home is built again; "Progress found" and "Two
 * saves" wait for the player's answer, and nothing is written to the cloud before it.
 */
export const cloudAsk: HomeAsk = {
  name: 'cloud',
  due: () => cloudSync().homeDecision() !== null,
  run(scene, done) {
    const sync = cloudSync();
    const decision = sync.homeDecision();
    if (decision === null) {
      done(false);
      return;
    }
    const { copy } = decision;
    if (decision.kind === 'adopt') {
      takeAndRebuild(scene, copy, false);
      return;
    }
    const keepHere = (): void => {
      void sync.keepLocal(copy);
      done(true);
    };
    const cloud = summarize(copy.save, copy.savedAt);
    if (decision.kind === 'found') {
      openFoundWindow(scene, cloud, {
        restore: () => takeAndRebuild(scene, copy, true),
        startOver: keepHere,
      });
      return;
    }
    const local = summarize(gameState.data, gameState.data.lastSeenAt);
    openChoiceWindow(scene, local, cloud, {
      keepLocal: keepHere,
      keepCloud: () => takeAndRebuild(scene, copy, true),
    });
  },
};
