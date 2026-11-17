import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { t } from '../../i18n';
import { oscillate01 } from '../../util/math';
import { FLYING_REACH } from '../camera-layout';
import { effectsMode } from '../effects-mode';
import { CaptionHint } from './caption-hint';
import {
  ARROW_FLIPPED_ORIGIN_Y,
  ARROW_SHOWN_HEIGHT,
  ARROW_TIP_ORIGIN_Y,
  bakeHintTextures,
  HINT_TEXTURES,
} from './hint-textures';
import { pickPlateY, type SpotInput } from './hint-spot';
import { PerfectHint } from './perfect-hint';
import { TapHint } from './tap-hint';
import { fadeAlpha, HintClock } from './timeline';
import type { TutorialDirector } from './tutorial-director';

const { caption, arrow, wobbleHint, berryHint, cloudHint, hintSpot } = TUTORIAL_ANIM;

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
  private readonly cloud: CaptionHint;
  private readonly cloudClock = new HintClock();
  private readonly cloudArrow: Phaser.GameObjects.Image;
  /** Last screen place of the shadow the cloud arrow pointed at. */
  private readonly cloudSpot = {
    x: 0,
    y: 0,
    known: false,
    set(x: number, y: number): void {
      this.x = x;
      this.y = y;
      this.known = true;
    },
  };
  private director: TutorialDirector | null = null;
  private screenWidth = 0;
  private screenHeight = 0;
  /** Reused by every plate placement: no allocation per frame. */
  private readonly spot: SpotInput = {
    screenHeight: 0,
    hudBottom: HUD_LAYOUT.bottomEdge,
    plateWidth: 0,
    plateHeight: 0,
    centerX: 0,
    topLayer: { left: 0, top: 0, right: 0, bottom: 0 },
    flightRow: { left: 0, top: 0, right: 0, bottom: 0 },
    shadow: null,
  };
  private readonly shadowRect = { left: 0, top: 0, right: 0, bottom: 0 };

  constructor(scene: Phaser.Scene) {
    bakeHintTextures(scene);
    this.perfect = new PerfectHint(scene);
    this.tap = new TapHint(scene);
    this.honey = new CaptionHint(scene);
    this.arrow = scene.add
      .image(0, 0, HINT_TEXTURES.arrow)
      .setOrigin(0.5, ARROW_TIP_ORIGIN_Y)
      .setVisible(false);
    this.wobble = new CaptionHint(scene, caption.secondPhase);
    this.berry = new CaptionHint(scene, caption.thirdPhase);
    this.cloud = new CaptionHint(scene, caption.fourthPhase);
    this.cloudArrow = scene.add
      .image(0, 0, HINT_TEXTURES.arrow)
      .setOrigin(0.5, ARROW_FLIPPED_ORIGIN_Y)
      .setFlipY(true)
      .setScale(cloudHint.arrowScale)
      .setVisible(false);
    this.cloud.setText(t('tutorial.cloud'));
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
      this.cloudClock.stop();
      this.cloudSpot.known = false;
    }
    this.tap.update(director?.tapHintVisible ?? false, timeMs, deltaMs, director?.towerTopY ?? 0);
    if (director) {
      for (const cue of director.takeCues()) {
        if (cue.type === 'first_perfect')
          this.perfect.show(effectsMode.reduced, director.towerTopY);
        else if (cue.type === 'wobble') this.startWobble(director);
        else if (cue.type === 'berry') this.startBerry(director);
        else if (cue.type === 'cloud') this.cloudClock.start(cloudHint.holdMs);
      }
    }
    this.perfect.update(timeMs, deltaMs);
    this.updateWobble(timeMs, deltaMs);
    this.updateBerry(timeMs, deltaMs);
    this.updateCloud(timeMs, deltaMs, director);
    this.updateHoney(timeMs, director);
  }

  /** The plate stands in a free zone, clear of the top layer, the flying row and the shadow. */
  private startWobble(director: TutorialDirector): void {
    this.wobble.place(this.screenWidth / 2, this.plateY(this.wobble, director));
    this.wobbleClock.start(wobbleHint.holdMs);
  }

  /**
   * Fills the reused placement input from the director and picks the plate's centre y.
   * `width` is the plate's own width; the caption reports its height.
   */
  private plateY(
    plate: CaptionHint,
    director: TutorialDirector,
    shadow: { readonly x: number; readonly y: number; readonly known: boolean } | null = null,
  ): number {
    const { spot, shadowRect } = this;
    const top = director.towerTopY;
    spot.screenHeight = this.screenHeight;
    spot.plateWidth = plate.width;
    spot.plateHeight = plate.height;
    spot.centerX = this.screenWidth / 2;
    const layer = spot.topLayer;
    layer.left = director.towerSpan.left;
    layer.right = director.towerSpan.right;
    layer.top = top;
    layer.bottom = top + BALANCE.layer.height;
    const row = spot.flightRow;
    row.left = 0;
    row.right = this.screenWidth;
    row.top = top - FLYING_REACH;
    row.bottom = top;
    const at = shadow ?? (director.shadow.valid ? { ...director.shadow, known: true } : null);
    if (at?.known) {
      const half = BALANCE.layer.maxWidth / 2;
      shadowRect.left = at.x - half;
      shadowRect.right = at.x + half;
      shadowRect.top = at.y;
      shadowRect.bottom = at.y + hintSpot.shadowHeight;
      spot.shadow = shadowRect;
    } else spot.shadow = null;
    return pickPlateY(spot);
  }

  private updateWobble(timeMs: number, deltaMs: number): void {
    this.wobbleClock.tick(deltaMs);
    this.wobble.render(this.wobbleClock.alpha(caption.fadeInMs, caption.fadeOutMs), timeMs);
  }

  /** Same place as the wobble hint. */
  private startBerry(director: TutorialDirector): void {
    this.berry.place(this.screenWidth / 2, this.plateY(this.berry, director));
    this.berryClock.start(berryHint.holdMs);
  }

  private updateBerry(timeMs: number, deltaMs: number): void {
    this.berryClock.tick(deltaMs);
    this.berry.render(this.berryClock.alpha(caption.fadeInMs, caption.fadeOutMs), timeMs);
  }

  /**
   * The arrow stands under the shadow of the hidden layer and follows it; the plate stands in a free
   * zone, clear of the top layer, the flying row and the shadow.
   */
  private updateCloud(timeMs: number, deltaMs: number, director: TutorialDirector | null): void {
    this.cloudClock.tick(deltaMs);
    // The plate follows the clock alone; while the shadow is gone (the layer was dropped) the
    // arrow and the plate keep their last place, so nothing blinks.
    const alpha = this.cloudClock.alpha(caption.fadeInMs, caption.fadeOutMs);
    const shadow = director?.shadow;
    if (shadow?.valid) this.cloudSpot.set(shadow.x, shadow.y);
    this.cloudArrow.setVisible(alpha > 0 && this.cloudSpot.known);
    this.cloud.render(this.cloudSpot.known ? alpha : 0, timeMs);
    if (alpha <= 0 || !this.cloudSpot.known) return;
    const bob = arrow.bobPx * oscillate01(timeMs, arrow.periodMs);
    const tipY = this.cloudSpot.y + cloudHint.arrowGap + bob;
    this.cloudArrow.setPosition(this.cloudSpot.x, tipY).setAlpha(alpha);
    if (director)
      this.cloud.place(this.screenWidth / 2, this.plateY(this.cloud, director, this.cloudSpot));
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
    const above = tipY - ARROW_SHOWN_HEIGHT - arrow.captionGap - plateHalf;
    // Too close to the HUD (a short screen): the plate goes under the layer instead.
    const lowestTop = HUD_LAYOUT.bottomEdge + caption.hudGap;
    const below = target.y + BALANCE.layer.height + arrow.captionGap + plateHalf;
    this.honey.place(x, above - plateHalf >= lowestTop ? above : below);
  }
}
