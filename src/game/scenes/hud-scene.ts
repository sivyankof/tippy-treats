import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { CREATURES } from '../../data/creatures';
import { readDebugParams } from '../../util/debug-params';
import { ContinueWindow } from '../ui/continue-window';
import { DebugPanel } from '../debug/debug-panel';
import { launchRun, restartRun, SCENES } from '../scene-keys';
import type { Button } from '../ui/button';
import { createIconButton } from '../ui/menu/icon-button';
import { NumberRoll } from '../ui/number-roll';
import { createOutlinedText } from '../ui/outlined-text';
import { PauseOverlay } from '../ui/pause-overlay';
import { EffectBadges } from '../ui/effect-badges';
import { MasterCaptions } from '../ui/master-captions';
import { TempoChip } from '../ui/tempo-chip';
import { ZoneBanner } from '../ui/zone-plate';
import { ZoneChangeWatch } from '../ui/zone-change-watch';
import { HudNumbersIdle } from '../ui/hud-idle';
import { isCompactNext } from '../ui/hud-row-layout';
import { NextCreatureBadge } from '../ui/next-creature-badge';
import { TreasureHud } from '../ui/treasure-hud';
import { enterScreen } from '../ui/transition';
import { addUiRegion } from '../ui/ui-regions';
import { WobbleBar } from '../ui/wobble-bar';
import { TutorialHints } from '../tutorial/tutorial-hints';
import type { RunInfo } from '../run-info';
import type { GameScene } from './game-scene';

const { pauseSize, pauseMargin } = HUD_LAYOUT;

export class HudScene extends Phaser.Scene {
  private heightText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private wobbleBar!: WobbleBar;
  private pauseButton!: Button;
  private overlay!: PauseOverlay;
  private debugPanel!: DebugPanel;
  private continueWindow!: ContinueWindow;
  private nextBadge!: NextCreatureBadge;
  private effectBadges!: EffectBadges;
  private masterCaptions!: MasterCaptions;
  private tempoChip!: TempoChip;
  private zoneBanner!: ZoneBanner;
  /** "Demo: <name>" during a creature demo. */
  private demoLabel!: Phaser.GameObjects.Text;
  private zoneWatch = new ZoneChangeWatch();
  private treasure!: TreasureHud;
  private numbersIdle!: HudNumbersIdle;
  private tutorialHints!: TutorialHints;
  private heightRoll = new NumberRoll();
  private scoreRoll = new NumberRoll();

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    const { width } = this.scale.gameSize;
    // A restarted scene keeps its instance: the counters start over and show the new run at once.
    this.heightRoll = new NumberRoll();
    this.scoreRoll = new NumberRoll();

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
    this.numbersIdle = new HudNumbersIdle(this.heightText, this.scoreText);
    this.wobbleBar = new WobbleBar(this);
    this.nextBadge = new NextCreatureBadge(this);
    this.effectBadges = new EffectBadges(this);
    this.masterCaptions = new MasterCaptions(this);
    // Built before the first frame of the run, not inside it (the plates are baked and measured).
    const team = this.gameScene()?.getRunInfo()?.team;
    if (team) {
      this.masterCaptions.prepare(team);
    }
    this.tempoChip = new TempoChip(this);
    this.zoneBanner = new ZoneBanner(this);
    this.demoLabel = createOutlinedText(this, 0, 0, '', HUD_LAYOUT.demoLabelFont, PALETTE.gold);
    this.zoneWatch = new ZoneChangeWatch();
    this.treasure = new TreasureHud(this);
    this.tutorialHints = new TutorialHints(this);
    // Breathing only: a gloss band has nowhere to run on a button this small.
    this.pauseButton = this.createPauseButton().breathe(false);
    this.overlay = new PauseOverlay(this, {
      onResume: () => this.scene.resume(SCENES.game),
      onRestart: () => restartRun(this, this.gameScene()?.request),
      onHome: () => this.gameScene()?.leaveRun(true),
    });
    this.continueWindow = new ContinueWindow(this);
    this.debugPanel = new DebugPanel(this, () => launchRun(this, this.gameScene()?.request));
    this.debugPanel.setVisible(import.meta.env.DEV && readDebugParams().debug);

    const unregisterButton = addUiRegion(() =>
      this.overlay.visible || !this.pauseEnabled()
        ? null
        : { x: pauseMargin, y: pauseMargin, width: pauseSize, height: pauseSize },
    );
    const unregisterPanel = addUiRegion(() => this.debugPanel.bounds());
    const unregisterContinue = addUiRegion(() => this.continueWindow.bounds());
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
      unregisterPanel();
      this.treasure.destroy();
      this.masterCaptions.clear();
      unregisterContinue();
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.pause, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    enterScreen(this, [
      this.pauseButton,
      this.heightText,
      this.scoreText,
      ...this.wobbleBar.parts,
      ...this.treasure.parts,
    ]);
  }

  override update(time: number, delta: number): void {
    const info = this.gameScene()?.getRunInfo() ?? null;
    const announced = this.zoneWatch.observe(info && info.phase !== 'over' ? info.zoneIndex : null);
    if (announced !== null) this.zoneBanner.show(announced);
    this.zoneBanner.update(time);
    if (info) {
      this.heightRoll.set(info.height);
      this.scoreRoll.set(info.score);
      this.heightText.setText(formatNumber(this.heightRoll.update(delta)));
      this.scoreText.setText(formatNumber(this.scoreRoll.update(delta)));
      this.wobbleBar.update(info.wobble, time, delta);
      this.nextBadge.update(info.height, info.team, isCompactNext(this.effectBadges.count));
      this.nextBadge.idle(time);
      this.effectBadges.update(info.effects, info.shield, time, delta);
      this.updateMasterCaptions(info.team, delta);
      this.tempoChip.update(info.tempoLeft, time, delta);
      this.treasure.update(info, time, delta, this.gameScene()?.continueFlow?.isOpen === true);
    }
    this.numbersIdle.update(time);
    this.tutorialHints.update(
      time,
      delta,
      this.gameScene()?.tutorial ?? null,
      info?.paused ?? false,
    );
    this.continueWindow.update(this.gameScene()?.continueFlow ?? null, info?.height ?? 0);
    this.pauseButton.setVisible(this.pauseEnabled());
    this.showDemoLabel();
    this.debugPanel.update(info, this.game.loop.actualFps);
  }

  /** The master captions: prepared once per run, shown for the `mastery` events the run scene noted. */
  private updateMasterCaptions(team: RunInfo['team'], delta: number): void {
    const game = this.gameScene();
    if (!game) return;
    this.masterCaptions.prepare(team);
    this.masterCaptions.update(game.masterFeed, this.effectBadges.count, delta);
    this.nextBadge.setSuppressed(this.masterCaptions.showing);
  }

  private gameScene(): GameScene | null {
    const scene = this.scene.get(SCENES.game) as GameScene | undefined;
    return scene ?? null;
  }

  private pauseEnabled(): boolean {
    const info = this.gameScene()?.getRunInfo();
    const offerOpen = this.gameScene()?.continueFlow?.isOpen ?? false;
    return !!info && info.phase !== 'over' && !offerOpen && !this.scene.isActive(SCENES.results);
  }

  private pause(): void {
    if (this.overlay.visible || !this.pauseEnabled()) return;
    this.scene.pause(SCENES.game);
    this.overlay.show();
  }

  /** The round pause button of the kit, the same as the back button of the menus. */
  private createPauseButton(): Button {
    return createIconButton(
      this,
      pauseMargin + pauseSize / 2,
      pauseMargin + pauseSize / 2,
      pauseSize,
      PALETTE.accentSecondary,
      'pause',
      // Pausing on release keeps the press from ever reaching the run or the overlay.
      () => this.pause(),
    );
  }

  private showDemoLabel(): void {
    const request = this.gameScene()?.request;
    const demo = request?.kind === 'demo';
    this.demoLabel.setVisible(demo);
    if (demo) {
      const text = t('run.demo', { name: t(CREATURES[request.creature].nameKey) });
      if (this.demoLabel.text !== text) this.demoLabel.setText(text);
    }
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.demoLabel.setPosition(width / 2, height - HUD_LAYOUT.demoLabelBottom);
    this.cameras.main.setSize(width, height);
    this.overlay.layout(width, height);
    this.continueWindow.layout(width, height);
    this.wobbleBar.layout(width);
    this.tempoChip.layout(this.wobbleBar.plateEdge);
    this.nextBadge.layout(width);
    this.zoneBanner.layout(width);
    this.treasure.layout(width);
    this.tutorialHints.layout(width, height);
    this.debugPanel.layout(height);
  }
}
