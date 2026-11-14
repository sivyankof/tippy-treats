import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { t } from '../../i18n';
import { sineWave } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { CaptionHint } from './caption-hint';
import { bakeHintTextures, HINT_TEXTURES } from './hint-textures';
import { PerfectHint } from './perfect-hint';
import { TapHint } from './tap-hint';
import { fadeAlpha, HintClock } from './timeline';
import type { TutorialDirector } from './tutorial-director';

const { caption, arrow, wobbleHint } = TUTORIAL_ANIM;
/** Offset between the sway of the two captions, radians. */
const WOBBLE_CAPTION_PHASE = 2.2;

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
  private director: TutorialDirector | null = null;
  private screenWidth = 0;

  constructor(scene: Phaser.Scene) {
    bakeHintTextures(scene);
    this.perfect = new PerfectHint(scene);
    this.tap = new TapHint(scene);
    this.honey = new CaptionHint(scene);
    this.arrow = scene.add.image(0, 0, HINT_TEXTURES.arrow).setOrigin(0.5, 1).setVisible(false);
    this.wobble = new CaptionHint(scene, WOBBLE_CAPTION_PHASE);
    this.honey.setText(t('tutorial.honey'));
    this.wobble.setText(t('tutorial.wobble'));
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.tap.layout(screenWidth, screenHeight);
    this.perfect.layout(screenWidth, screenHeight);
    this.wobble.place(
      screenWidth / 2,
      HUD_LAYOUT.bottomEdge + wobbleHint.gapBelowHud + this.wobble.height / 2,
    );
  }

  /** Follows the director of the current run; `null` while no run exists. */
  update(timeMs: number, deltaMs: number, director: TutorialDirector | null): void {
    if (director !== this.director) {
      this.director = director;
      this.wobbleClock.stop();
    }
    this.tap.update(director?.tapHintVisible ?? false, timeMs, deltaMs);
    if (director) {
      for (const cue of director.takeCues()) {
        if (cue.type === 'first_perfect') this.perfect.show(effectsMode.reduced);
        else if (cue.type === 'wobble') this.wobbleClock.start(wobbleHint.holdMs);
      }
    }
    this.perfect.update(timeMs, deltaMs);
    this.updateWobble(timeMs, deltaMs);
    this.updateHoney(timeMs, director);
  }

  private updateWobble(timeMs: number, deltaMs: number): void {
    this.wobbleClock.tick(deltaMs);
    this.wobble.render(this.wobbleClock.alpha(caption.fadeInMs, caption.fadeOutMs), timeMs);
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

    const bob = arrow.bobPx * (0.5 + 0.5 * sineWave(timeMs, arrow.periodMs));
    const tipY = target.y - arrow.gap - bob;
    this.arrow.setPosition(target.x, tipY).setAlpha(alpha);
    const half = caption.width / 2;
    const x = Phaser.Math.Clamp(target.x, half, this.screenWidth - half);
    const plateY = tipY - arrow.height - arrow.captionGap - this.honey.height / 2;
    this.honey.place(x, plateY);
  }
}
