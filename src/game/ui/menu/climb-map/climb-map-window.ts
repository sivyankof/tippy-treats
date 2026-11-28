import * as Phaser from 'phaser';
import { climbMap } from '../../../../core/progression/climb-map';
import { ANIM } from '../../../../data/common/anim';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { bakeClimbMapTextures } from '../../../fx/zones/climb-map-textures';
import { createOutlinedText } from '../../common/outlined-text';
import { safeFrame } from '../../common/safe-frame';
import { PopupWindow } from '../../style/dialog-window';
import { faceOffsetY, VolumePlate } from '../../style/volume';
import { fitText } from '../widgets/fit-text';
import { createGamesButton } from '../widgets/games-button';
import { gamesShown, openBoard } from '../../../games/games-actions';
import { MENU } from '../../../../data/common/menu-layout';
import { ribbonHeight, windowContentHeight } from './climb-map-layout';
import { ClimbMapRibbon } from './climb-map-ribbon';
import { logMapOpen } from './climb-map-telemetry';
import { goalText } from './climb-map-text';

const cfg = CLIMB_MAP;

/** Tells the owner of the screen under the window that it is hidden (`true`: the window is fully open) or shown again. */
export type CoverHandler = (covered: boolean) => void;

/** The climb map opened from the record plate of Home: the only opening that sends `map_open`. */
export function openMapFromHome(
  scene: Phaser.Scene,
  onClosed: () => void,
  cover?: CoverHandler,
): PopupWindow {
  logMapOpen();
  return openMapWindow(scene, onClosed, cover);
}

/**
 * The climb map (docs/07-ui-screens.md, section 2.3): a tall window with the ribbon of bands, the
 * tower and the flags, and the goal row under it. Content, top to bottom: the ribbon, then rows
 * at the same gap (`CLIMB_MAP.goal.gap`); a row appended under the goal takes its height from the
 * ribbon (`ribbonHeight`): "Leaderboard" where the game services are. While the window is fully open (after its pop-in) `cover(true)` lets
 * the screen under it hide; `cover(false)` comes when the window starts to go, or is gone.
 */
export function openMapWindow(
  scene: Phaser.Scene,
  onClosed?: () => void,
  cover?: CoverHandler,
): PopupWindow {
  const frame = safeFrame(scene.scale.gameSize.height);
  const contentHeight = windowContentHeight(frame.height, frame.top);
  let covered = false;
  let ribbon: ClimbMapRibbon | null = null;
  const popup = new PopupWindow(scene, {
    title: t('climbMap.title'),
    contentHeight,
    onClosed: () => {
      release();
      onClosed?.();
    },
  });

  /** Everything the window set going comes down; the screen under it is shown again. */
  const release = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, watch);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
    opened.remove();
    ribbon?.stop();
    if (covered) cover?.(false);
    covered = false;
  };
  // PopupWindow offers no hook for "closing started": the window is watched every frame instead.
  const watch = (): void => {
    if (popup.leaving) release();
  };
  const opened = scene.time.delayedCall(ANIM.ui.popup.durationMs, () => {
    if (popup.leaving) return;
    covered = true;
    cover?.(true);
    ribbon?.start();
  });
  scene.events.on(Phaser.Scenes.Events.UPDATE, watch);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, release);

  bakeClimbMapTextures(scene);
  const map = climbMap({
    record: gameState.recordHeight,
    todayBest: gameState.todayBest,
    checkpoints: gameState.checkpoints,
    bestLap: gameState.data.bestLap,
  });
  // "Leaderboard" under the goal, only where the game services are: the ribbon gives up its room.
  const board = gamesShown();
  const buttonHeight = MENU.gamesButton.height;
  const height = ribbonHeight(contentHeight, board ? [buttonHeight] : []);
  ribbon = new ClimbMapRibbon(scene, { width: popup.innerWidth, height }, map);
  popup.content.add(ribbon.root);
  const goalTop = height + cfg.goal.gap;
  popup.content.add(createGoalRow(scene, popup.innerWidth, goalTop, goalText(map)));
  if (board) {
    const top = goalTop + cfg.goal.height + cfg.goal.gap;
    popup.content.add(
      createGamesButton(scene, t('games.board'), popup.innerWidth, top + buttonHeight / 2, (button) =>
        popup.leaving ? Promise.resolve() : openBoard(scene, 'classic_height', button),
      ),
    );
  }
  popup.setContentHeight(contentHeight);
  return popup;
}

/** The goal on a light plate: "14 layers to Clouds". */
function createGoalRow(
  scene: Phaser.Scene,
  width: number,
  top: number,
  text: string,
): Phaser.GameObjects.Container {
  const { height, font } = cfg.goal;
  const plate = new VolumePlate(scene, 'card', height).setBodyWidth(width);
  const label = createOutlinedText(scene, 0, faceOffsetY('card'), text, font);
  fitText(label, width - 80);
  return scene.add.container(0, top + height / 2, [plate, label]);
}
