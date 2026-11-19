import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { PALETTE } from '../../data/common/palette';
import { formatNumber, t } from '../../i18n';
import { CREATURES } from '../../data/creatures/creatures';
import { readDebugParams } from '../../util/debug-params';
import { ContinueWindow } from '../ui/run/continue-window';
import { DebugPanel } from '../debug/debug-panel';
import { launchRun, restartRun, SCENES } from '../scene-keys';
import type { Button } from '../ui/common/button';
import { createIconButton } from '../ui/menu/icon-button';
import { NumberRoll } from '../ui/common/number-roll';
import { createOutlinedText } from '../ui/common/outlined-text';
import { PauseOverlay } from '../ui/run/pause-overlay';
import { EffectBadges } from '../ui/creatures/effect-badges';
import { MasterCaptions } from '../ui/creatures/master-captions';
import { TempoChip } from '../ui/tower/tempo-chip';
import { ZoneBanner } from '../ui/zones/zone-plate';
import { LAP_BANNER } from '../../data/zones/zone-plate';
import { LAP_PLATE } from '../../data/zones/space-planets';
import { flyingLap } from '../../core/zones/space-laps';
import { LapChangeWatch } from '../../core/zones/space-planet';
import { ZoneChangeWatch } from '../ui/zones/zone-change-watch';
import { RunMusic } from '../music-cues';
import { BACKDROP } from '../../data/backdrop/backdrop';
import { prepTarget, sameTarget, type PrepTarget } from '../objects/backdrop/zones/zone-prep';
import { HudNumbersIdle } from '../ui/run/hud-idle';
import { isCompactNext } from '../ui/run/hud-row-layout';
import { NextCreatureBadge } from '../ui/creatures/next-creature-badge';
import { TreasureHud } from '../ui/economy/treasure-hud';
import { fxGuard } from '../fx-guard';
import { enterScreen } from '../ui/common/transition';
import { addUiRegion } from '../ui/common/ui-regions';
import { WobbleBar } from '../ui/tower/wobble-bar';
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
  private lapBanner!: ZoneBanner;
  /** "Demo: <name>" during a creature demo. */
  private demoLabel!: Phaser.GameObjects.Text;
  private zoneWatch = new ZoneChangeWatch();
  private preparedTarget: PrepTarget | null = null;
  private lapWatch = new LapChangeWatch(LAP_PLATE.firstLap);
  private runMusic = new RunMusic();
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
    this.lapBanner = new ZoneBanner(this, LAP_BANNER, 'ui_lap_banner');
    this.demoLabel = createOutlinedText(this, 0, 0, '', HUD_LAYOUT.demoLabelFont, PALETTE.gold);
    this.zoneWatch = new ZoneChangeWatch();
    this.preparedTarget = null;
    this.lapWatch = new LapChangeWatch(LAP_PLATE.firstLap);
    this.runMusic = new RunMusic();
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
      this.runMusic.end();
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
    const live = info && info.phase !== 'over' ? info : null;
    const announced = this.zoneWatch.observe(live ? live.zoneIndex : null);
    const lap = this.lapWatch.observe(live ? flyingLap(live.height) : null);
    this.runMusic.observe(live !== null, info?.mode === 'daily', this.overlay.visible);
    const coming = live ? prepTarget(live.height, live.zoneIndex, BACKDROP.prep.leadLayers) : null;
    fxGuard.call('hud-zone-banner', this, this.updateZoneBanner, announced, lap, coming, time);
    if (info) {
      this.heightRoll.set(info.height);
      this.scoreRoll.set(info.score);
      this.heightText.setText(formatNumber(this.heightRoll.update(delta)));
      this.scoreText.setText(formatNumber(this.scoreRoll.update(delta)));
      this.wobbleBar.update(info.wobble, time, delta);
      // The badges go first: the next chip turns compact on the frame a third badge comes in.
      const badges = this.effectBadges;
      fxGuard.call(
        'hud-effect-badges',
        badges,
        badges.update,
        info.effects,
        info.shield,
        time,
        delta,
      );
      this.nextBadge.update(info.height, info.team, isCompactNext(badges.count));
      fxGuard.call('hud-next-idle', this.nextBadge, this.nextBadge.idle, time);
      this.updateMasterCaptions(info.team, delta);
      this.tempoChip.update(info.tempoLeft, time, delta);
      this.treasure.update(info, time, delta, this.gameScene()?.continueFlow?.isOpen === true);
    }
    fxGuard.call('hud-numbers-idle', this.numbersIdle, this.numbersIdle.update, time);
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
    const captions = this.masterCaptions;
    // A failure drops the caption, so a plate left on screen cannot sit over the un-hidden chip.
    if (!fxGuard.call('hud-master-captions', this, this.stepMasterCaptions, team, game, delta)) {
      fxGuard.cleanup('hud-master-captions', captions, captions.hide);
    }
    this.nextBadge.setSuppressed(captions.showing);
  }

  private stepMasterCaptions(team: RunInfo['team'], game: GameScene, delta: number): void {
    this.masterCaptions.prepare(team);
    this.masterCaptions.update(game.masterFeed, this.effectBadges.count, delta);
  }

  /** `coming`: the change the backdrop is getting ready for; its plate text is written ahead too. */
  private updateZoneBanner(
    announced: number | null,
    lap: number | null,
    coming: PrepTarget | null,
    time: number,
  ): void {
    // Each target is prepared once: the text is formatted when it comes up, not every frame of the lead.
    if (!sameTarget(coming, this.preparedTarget)) {
      this.preparedTarget = coming;
      if (coming?.kind === 'zone') this.zoneBanner.prepare(coming.index);
      else if (coming?.kind === 'lap') this.lapBanner.prepareLap(coming.lap);
    }
    if (announced !== null) this.zoneBanner.show(announced);
    if (lap !== null) this.lapBanner.showLap(lap);
    this.zoneBanner.update(time);
    this.lapBanner.update(time);
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
    this.tempoChip.layout(this.wobbleBar.plateEdge, width, height);
    this.nextBadge.layout(width);
    this.zoneBanner.layout(width);
    this.lapBanner.layout(width);
    this.treasure.layout(width);
    this.tutorialHints.layout(width, height);
    this.debugPanel.layout(height);
  }
}
