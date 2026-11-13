import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { formatNumber } from '../../i18n';
import { readDebugParams } from '../../util/debug-params';
import { DebugPanel } from '../debug/debug-panel';
import { launchRun, SCENES } from '../scene-keys';
import { Button } from '../ui/button';
import { createOutlinedText } from '../ui/outlined-text';
import { PauseOverlay } from '../ui/pause-overlay';
import { addUiRegion } from '../ui/ui-regions';
import { WobbleBar } from '../ui/wobble-bar';
import type { GameScene } from './game-scene';

const { pauseSize, pauseMargin, pauseBarWidth, pauseBarHeight, pauseBarGap } = HUD_LAYOUT;

export class HudScene extends Phaser.Scene {
  private heightText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private wobbleBar!: WobbleBar;
  private pauseButton!: Button;
  private overlay!: PauseOverlay;
  private debugPanel!: DebugPanel;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    const { width } = this.scale.gameSize;

    this.heightText = createOutlinedText(
      this,
      width / 2,
      HUD_LAYOUT.heightY,
      formatNumber(0),
      HUD_LAYOUT.heightFont,
    );
    this.scoreText = createOutlinedText(
      this,
      width / 2,
      HUD_LAYOUT.scoreY,
      formatNumber(0),
      HUD_LAYOUT.scoreFont,
      PALETTE.gold,
    );
    this.wobbleBar = new WobbleBar(this);
    this.pauseButton = this.createPauseButton();
    this.overlay = new PauseOverlay(this, {
      onResume: () => this.scene.resume(SCENES.game),
      onRestart: () => {
        launchRun(this);
      },
    });
    this.debugPanel = new DebugPanel(this);
    this.debugPanel.setVisible(import.meta.env.DEV && readDebugParams().debug);

    const unregisterButton = addUiRegion(() =>
      this.overlay.visible || !this.pauseEnabled()
        ? null
        : { x: pauseMargin, y: pauseMargin, width: pauseSize, height: pauseSize },
    );
    const unregisterOverlay = addUiRegion(() =>
      this.overlay.visible
        ? { x: 0, y: 0, width: this.scale.gameSize.width, height: this.scale.gameSize.height }
        : null,
    );

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.pause, this);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-D', () => {
        this.debugPanel.setVisible(!this.debugPanel.visible);
      });
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unregisterButton();
      unregisterOverlay();
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.pause, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
  }

  override update(time: number, delta: number): void {
    const info = this.gameScene()?.getRunInfo() ?? null;
    if (info) {
      this.heightText.setText(formatNumber(info.height));
      this.scoreText.setText(formatNumber(info.score));
      this.wobbleBar.update(info.wobble, time, delta);
    }
    this.pauseButton.setVisible(this.pauseEnabled());
    this.debugPanel.update(info, this.game.loop.actualFps);
  }

  private gameScene(): GameScene | null {
    const scene = this.scene.get(SCENES.game) as GameScene | undefined;
    return scene ?? null;
  }

  private pauseEnabled(): boolean {
    const info = this.gameScene()?.getRunInfo();
    return !!info && info.phase !== 'over' && !this.scene.isActive(SCENES.results);
  }

  private pause(): void {
    if (this.overlay.visible || !this.pauseEnabled()) return;
    this.scene.pause(SCENES.game);
    this.overlay.show();
  }

  private createPauseButton(): Button {
    return new Button(this, {
      x: pauseMargin + pauseSize / 2,
      y: pauseMargin + pauseSize / 2,
      width: pauseSize,
      height: pauseSize,
      radius: HUD_LAYOUT.pauseRadius,
      fill: PALETTE.panel,
      shadowColor: PALETTE.panelShadow,
      shadowOffset: HUD_LAYOUT.pauseShadow,
      textureKey: 'ui_pause_button',
      decorate: (g, width, height) => {
        const left = (width - (pauseBarWidth * 2 + pauseBarGap)) / 2;
        const top = (height - pauseBarHeight) / 2;
        g.fillStyle(PALETTE.textDark, 1);
        g.fillRoundedRect(left, top, pauseBarWidth, pauseBarHeight, pauseBarWidth / 2);
        g.fillRoundedRect(
          left + pauseBarWidth + pauseBarGap,
          top,
          pauseBarWidth,
          pauseBarHeight,
          pauseBarWidth / 2,
        );
      },
      // Pausing on release keeps the press from ever reaching the run or the overlay.
      onClick: () => this.pause(),
    });
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.overlay.layout(width, height);
    this.wobbleBar.layout(width);
    this.debugPanel.layout(height);
  }
}
