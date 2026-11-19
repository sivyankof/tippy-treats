import * as Phaser from 'phaser';
import { CREATURE_SLEEP } from '../../../data/creatures/creature-style';
import { MENU } from '../../../data/common/menu-layout';
import { services } from '../../../services';
import { effectsMode } from '../../effects-mode';
import { FX_TEXTURES } from '../../fx/common/fx-textures';
import { CONFETTI_TINTS } from '../../fx/common/particle-fx';
import { coneBurst } from '../../fx/common/particle-motion';
import type { Particles } from '../../fx/common/particles';
import { squeakPitch, type CreaturePortrait } from '../../objects/creature-portrait';
import type { SleepingSilhouette } from '../../objects/sleep-silhouette';
import type { GiftBox } from './new-creature-box';
import type { LightRays } from './new-creature-rays';
import { lettersShown, shakeAngle, splitLetters } from './new-creature-reveal';

const cfg = MENU.newCreature;

export type RevealPhase = 'intro' | 'shake' | 'open' | 'wake' | 'letters' | 'done';

export interface RevealParts {
  scene: Phaser.Scene;
  box: GiftBox;
  portrait: CreaturePortrait;
  /** The sleeping silhouette the creature jumps out as, before it wakes up into `portrait`. */
  sleeper: SleepingSilhouette;
  rays: LightRays;
  particles: Particles;
  nameText: Phaser.GameObjects.Text;
  rarityText: Phaser.GameObjects.Text;
  /** The full name and rarity label. */
  names: [string, string];
  center: () => { x: number; y: number };
  /** Called once, when the reveal has reached its end state. */
  onDone: () => void;
}

/** The reveal of a creature: the box drops, shakes, opens, the creature jumps out asleep, wakes up, the letters appear. */
export class NewCreatureSequence {
  phase: RevealPhase = 'intro';
  private lettersMs = 0;

  constructor(private readonly p: RevealParts) {}

  start(): void {
    if (this.phase !== 'intro') return;
    const { x, y } = this.p.center();
    this.p.box.setVisible(true).setPosition(x, y - cfg.dropFrom);
    this.p.scene.tweens.add({
      targets: this.p.box,
      y,
      duration: cfg.dropMs,
      ease: 'Bounce.easeOut',
      onComplete: () => this.p.scene.time.delayedCall(cfg.shakeDelayMs, () => this.shake()),
    });
  }

  update(dtMs: number): void {
    if (this.phase !== 'letters') return;
    this.lettersMs += dtMs;
    const [a, b] = this.p.names;
    const total = a.length + b.length;
    const shown = lettersShown(total, this.lettersMs, cfg.letterMs);
    const [n1 = 0, n2 = 0] = splitLetters([a.length, b.length], shown);
    this.p.nameText.setText(a.slice(0, n1));
    this.p.rarityText.setText(b.slice(0, n2));
    if (shown >= total) this.finish();
  }

  /** A tap during the animation jumps to the finished state. */
  skip(): void {
    if (this.phase === 'done') return;
    const { scene, box, portrait, sleeper, rays, nameText, rarityText, names } = this.p;
    scene.tweens.killTweensOf([
      box,
      box.base,
      box.lid,
      portrait,
      sleeper,
      sleeper.lettersRoot,
      rays,
    ]);
    scene.time.removeAllEvents();
    const { x, y } = this.p.center();
    box.setVisible(false);
    sleeper.setVisible(false);
    portrait.setVisible(true).setAlpha(1).setPosition(x, y).setScale(1);
    rays.setAlpha(cfg.raysAlpha);
    nameText.setText(names[0]);
    rarityText.setText(names[1]);
    this.finish();
  }

  private shake(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'shake';
    const ms = cfg.shakeMs * (effectsMode.reduced ? cfg.reducedShakeShare : 1);
    services.haptics.play('light');
    const wave = { p: 0 };
    this.p.scene.tweens.add({
      targets: wave,
      p: 1,
      duration: ms,
      ease: 'Quad.easeIn',
      onUpdate: () => this.p.box.setAngle(shakeAngle(wave.p, cfg.shakeWaves, cfg.shakeDeg)),
      onComplete: () => this.open(),
    });
  }

  private open(): void {
    if (this.phase !== 'shake') return;
    this.phase = 'open';
    const { scene, box, portrait, sleeper, rays } = this.p;
    const { x, y } = this.p.center();
    box.setAngle(0);
    services.audio.coin();
    services.haptics.play('heavy');
    box.popLid();
    this.burst(x, y - cfg.boxSize / 2);
    scene.tweens.add({ targets: box.base, alpha: 0, duration: cfg.jumpMs });
    scene.tweens.add({ targets: rays, alpha: cfg.raysAlpha, duration: cfg.raysFadeMs });
    portrait.setVisible(true).setAlpha(0).setPosition(x, y).setScale(cfg.startScale);
    sleeper.setLettersVisible(false).setAlpha(1).setVisible(true);
    sleeper.setPosition(x, y).setScale(cfg.startScale);
    scene.tweens.add({
      targets: [portrait, sleeper],
      y: y - cfg.jumpHeight,
      scale: 1,
      duration: cfg.jumpMs / 2,
      ease: 'Quad.easeOut',
      onComplete: () => this.land(y),
    });
  }

  private land(y: number): void {
    if (this.phase !== 'open') return;
    const { scene, portrait, sleeper } = this.p;
    scene.tweens.add({
      targets: [portrait, sleeper],
      y,
      duration: cfg.jumpMs / 2,
      ease: 'Quad.easeIn',
      onComplete: () => {
        services.haptics.play('medium');
        scene.tweens.add({
          targets: [portrait, sleeper],
          scaleX: cfg.squash.x,
          scaleY: cfg.squash.y,
          duration: cfg.squash.ms,
          yoyo: true,
          ease: 'Sine.easeOut',
          onComplete: () => this.wake(),
        });
      },
    });
  }

  /** The letters pop over the sleeper, then it cross-fades into the real creature, which hops happily. */
  private wake(): void {
    if (this.phase !== 'open') return;
    this.phase = 'wake';
    const { scene, sleeper } = this.p;
    const { holdMs, fadeMs } = CREATURE_SLEEP.wake;
    if (effectsMode.reduced) {
      this.crossFade(fadeMs, false);
      return;
    }
    sleeper.popLetters();
    scene.time.delayedCall(holdMs, () => this.crossFade(fadeMs, true));
  }

  private crossFade(ms: number, hop: boolean): void {
    if (this.phase !== 'wake') return;
    const { scene, portrait, sleeper } = this.p;
    if (!hop) services.audio.squeak(squeakPitch(portrait.creature));
    // The sleeper stays solid under the fading-in creature, so nothing shows through it.
    scene.tweens.add({ targets: sleeper.lettersRoot, alpha: 0, duration: ms });
    scene.tweens.add({
      targets: portrait,
      alpha: 1,
      duration: ms,
      onComplete: () => {
        if (this.phase !== 'wake') return;
        sleeper.setVisible(false);
        if (hop) portrait.poke();
        this.startLetters();
      },
    });
  }

  private startLetters(): void {
    if (this.phase !== 'wake') return;
    this.phase = 'letters';
    this.lettersMs = 0;
  }

  private burst(x: number, y: number): void {
    if (effectsMode.reduced) return;
    const { count, depth, style } = cfg.burst;
    this.p.particles.emit(count, (n) => coneBurst(x, y, cfg.burstAngleDeg, n, style), {
      texture: FX_TEXTURES.confetti,
      tints: CONFETTI_TINTS,
      depth,
    });
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.p.onDone();
  }
}
