import type * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { pushBack } from '../../app/back-stack';
import { safeBand } from '../../app/safe-area';
import type { DebugPanel } from '../../debug/debug-panel';
import { toCanvasRegion } from '../../run/band-space';
import { addUiRegion } from '../common/ui-regions';
import type { ContinueWindow } from './continue-window';
import type { PauseOverlay } from './pause-overlay';

const { pauseSize, pauseMargin } = HUD_LAYOUT;

/** What of the run's HUD takes taps and the Android back. */
export interface HudInputParts {
  scene: Phaser.Scene;
  overlay: PauseOverlay;
  continueWindow: ContinueWindow;
  debugPanel: DebugPanel;
  /** The run can be paused now (it runs, no offer or results on show). */
  pauseEnabled: () => boolean;
  pause: () => void;
}

/**
 * Registers the HUD's tap regions (taps there do not reach the run) and its Android back: the
 * pause window closes, the continue offer says "no", a running run pauses. The HUD is laid out
 * in band coordinates (y 0 at the safe top); the tap regions are canvas ones. Returns the
 * function that removes everything.
 */
export function bindHudInput(parts: HudInputParts): () => void {
  const { scene, overlay, continueWindow, debugPanel } = parts;
  const releases = [
    addUiRegion(() =>
      toCanvasRegion(
        overlay.visible || !parts.pauseEnabled()
          ? null
          : { x: pauseMargin, y: pauseMargin, width: pauseSize, height: pauseSize },
        safeBand(),
      ),
    ),
    addUiRegion(() => toCanvasRegion(debugPanel.bounds(), safeBand())),
    addUiRegion(() => toCanvasRegion(continueWindow.bounds(), safeBand())),
    addUiRegion(() =>
      overlay.visible
        ? { x: 0, y: 0, width: scene.scale.gameSize.width, height: scene.scale.gameSize.height }
        : null,
    ),
    pushBack(
      () =>
        overlay.back() ||
        continueWindow.back() ||
        (parts.pauseEnabled() ? (parts.pause(), true) : false),
    ),
  ];
  return () => releases.forEach((release) => release());
}
