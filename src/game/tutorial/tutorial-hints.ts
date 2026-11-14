import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { t } from '../../i18n';
import { oscillate01 } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { CaptionHint } from './caption-hint';
import { bakeHintTextures, HINT_TEXTURES } from './hint-textures';
import { PerfectHint } from './perfect-hint';
import { TapHint } from './tap-hint';
import { fadeAlpha, HintClock } from './timeline';
import type { TutorialDirector } from './tutorial-director';

const { caption, arrow, wobbleHint, berryHint } = TUTORIAL_ANIM;

/**
 * Everything the first-run hints draw, in the HUD scene: the tap hint, the first-perfect
 * flash, the Honey caption with its arrow and the wobble hint. It follows a `TutorialDirector`
 * and never touches the sim.
 */
export class TutorialHints {
  private readonly tap: TapHint;
  private readonly perfect: PerfectHint;
  private readonly honey: CaptionHint;
  private readonly arrow: Phaser.GameObjects.Image;
  private readonly wobble: CaptionHint;
  private readonly wobbleClock = new HintClock();
  private readonly berry: CaptionHint;
  private readonly berryClock = new HintClock();
  private director: TutorialDirector | null = null;
  private screenWidth = 0;
  private screenHeight = 0;

  constructor(scene: Phaser.Scene) {
    bakeHintTextures(scene);
    this.perfect = new PerfectHint(scene);
    this.tap = new TapHint(scene);
    this.honey = new CaptionHint(scene);
    this.arrow = scene.add.image(0, 0, HINT_TEXTURES.arrow).setOrigin(0.5, 1).setVisible(false);
    this.wobble = new CaptionHint(scene, caption.secondPhase);
    this.berry = new CaptionHint(scene, caption.thirdPhase);
    this.honey.setText(t('tutorial.honey', { name: t('creature.honey.name') }));
    this.wobble.setText(t('tutorial.wobble'));
    this.berry.setText(t('tutorial.berry'));
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.tap.layout(screenWidth);
    this.perfect.layout(screenWidth, screenHeight);
  }

  /**
   * Follows the director of the current run; `null` while no run exists. While the run is
   * `paused` the hint clocks stand still, so nothing expires under the pause window.
   */
  update(
    timeMs: number,
    frameMs: number,
    director: TutorialDirector | null,
    paused: boolean,
  ): void {
    const deltaMs = paused ? 0 : frameMs;
    if (director !== this.director) {
      this.director = director;
      this.wobbleClock.stop();
      this.berryClock.stop();
    }
    this.tap.update(director?.tapHintVisible ?? false, timeMs, deltaMs, director?.towerTopY ?? 0);
    if (director) {
      for (const cue of director.takeCues()) {
        if (cue.type === 'first_perfect')
          this.perfect.show(effectsMode.reduced, director.towerTopY);
        else if (cue.type === 'wobble') this.startWobble(director.towerTopY);
        else if (cue.type === 'berry') this.startBerry(director.towerTopY);
      }
    }
    this.perfect.update(timeMs, deltaMs);
    this.updateWobble(timeMs, deltaMs);
    this.updateBerry(timeMs, deltaMs);
    this.updateHoney(timeMs, director);
  }

  /** The plate sits on the tower just under its top surface, below the flying row. */
  private startWobble(towerTopY: number): void {
    const lowest = this.screenHeight - wobbleHint.screenMargin - this.wobble.height / 2;
    const y = Math.min(towerTopY + wobbleHint.gapBelowTop + this.wobble.height / 2, lowest);
    this.wobble.place(this.screenWidth / 2, y);
    this.wobbleClock.start(wobbleHint.holdMs);
  }

  private updateWobble(timeMs: number, deltaMs: number): void {
    this.wobbleClock.tick(deltaMs);
    this.wobble.render(this.wobbleClock.alpha(caption.fadeInMs, caption.fadeOutMs), timeMs);
  }

  /** Same place as the wobble hint: on the tower under its top surface, never in the flying row. */
  private startBerry(towerTopY: number): void {
    const lowest = this.screenHeight - berryHint.screenMargin - this.berry.height / 2;
    const y = Math.min(towerTopY + berryHint.gapBelowTop + this.berry.height / 2, lowest);
    this.berry.place(this.screenWidth / 2, y);
    this.berryClock.start(berryHint.holdMs);
  }

  private updateBerry(timeMs: number, deltaMs: number): void {
    this.berryClock.tick(deltaMs);
    this.berry.render(this.berryClock.alpha(caption.fadeInMs, caption.fadeOutMs), timeMs);
  }

  /** The caption and the arrow above the Honey layer, for as long as the sim is held. */
  private updateHoney(timeMs: number, director: TutorialDirector | null): void {
    const target = director?.target;
    const alpha =
      director && target?.valid
        ? fadeAlpha(
            director.holdElapsedMs,
            BALANCE.tutorial.creaturePauseMs,
            caption.fadeInMs,
            caption.fadeOutMs,
          )
        : 0;
    this.arrow.setVisible(alpha > 0);
    this.honey.render(alpha, timeMs);
    if (!target || alpha <= 0) return;

    const bob = arrow.bobPx * oscillate01(timeMs, arrow.periodMs);
    const tipY = target.y - arrow.gap - bob;
    this.arrow.setPosition(target.x, tipY).setAlpha(alpha);
    const half = caption.width / 2;
    const x = Phaser.Math.Clamp(target.x, half, this.screenWidth - half);
    const plateHalf = this.honey.height / 2;
    const above = tipY - this.arrow.displayHeight - arrow.captionGap - plateHalf;
    // Too close to the HUD (a short screen): the plate goes under the layer instead.
    const lowestTop = HUD_LAYOUT.bottomEdge + caption.hudGap;
    const below = target.y + BALANCE.layer.height + arrow.captionGap + plateHalf;
    this.honey.place(x, above - plateHalf >= lowestTop ? above : below);
  }
}
