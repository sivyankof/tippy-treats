import * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { services } from '../../services';
import { shade } from '../../util/color';
import { DEPTH } from '../depth';
import type { TowerView } from '../objects/tower-view';
import { bakeTexture } from '../ui/bake-texture';
import { createOutlinedText } from '../ui/outlined-text';
import type { ComboGlow } from './combo-glow';
import type { LandingFx } from './landing-fx';
import { cuesForMoment } from './moment-cues';
import { ParticleFx } from './particle-fx';
import { freeRoom, pennantSide } from './pennant-side';
import { playCues } from './run-cues';

const flag = CONTINUE_ANIM.flag;
const LINE_TEXTURE = 'fx_record_line';
const PENNANT_TEXTURE = 'fx_record_pennant';
const TWO_PI = Math.PI * 2;

/**
 * The record of this session inside a run: a waving dashed line with a "Record" pennant at
 * the height of the best tower. When the run first rises above it, a short flash, confetti and
 * "Record!" go off with a short blip (the fanfare belongs to the results screen), the run is not
 * interrupted, and the flag fades away.
 */
export class RecordMoment {
  private readonly root: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.Image;
  private readonly pennant: Phaser.GameObjects.Container;
  private readonly particleFx: ParticleFx;
  private beatenMs = -1;
  private known = false;
  /** Side of the screen the pennant stands at: 1 right, -1 left. */
  private side: 1 | -1 = 1;

  /** `best` is the saved best height before this run, or `null` for no flag at all. */
  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly landing: LandingFx,
    private readonly glow: ComboGlow,
    private readonly best: number | null,
  ) {
    this.particleFx = new ParticleFx(landing.particles);
    bakeTexture(scene, LINE_TEXTURE, LOGICAL_SIZE.width, flag.lineHeight, (g) => {
      g.fillStyle(flag.lineColor, 1);
      for (let x = 0; x < LOGICAL_SIZE.width; x += flag.dashLength + flag.dashGap) {
        g.fillRoundedRect(x, 0, flag.dashLength, flag.lineHeight, flag.lineHeight / 2);
      }
    });
    bakeTexture(scene, PENNANT_TEXTURE, flag.labelWidth, flag.labelHeight, (g) => {
      g.fillStyle(shade(PALETTE.accent, flag.pennantDarken), 1);
      g.fillRoundedRect(0, 0, flag.labelWidth, flag.labelHeight, flag.labelRadius);
      g.fillStyle(PALETTE.accent, 1);
      g.fillRoundedRect(
        flag.outline,
        flag.outline,
        flag.labelWidth - flag.outline * 2,
        flag.labelHeight - flag.outline * 2,
        flag.labelRadius - flag.outline,
      );
    });
    this.line = scene.add.image(0, 0, LINE_TEXTURE).setOrigin(0, 0.5);
    // The pennant is its own object: the line stays behind the tower, the pennant reads over it.
    this.pennant = scene.add
      .container(0, 0, [
        scene.add.image(0, 0, PENNANT_TEXTURE),
        createOutlinedText(scene, 0, 0, t('run.record'), flag.labelFont),
      ])
      .setDepth(DEPTH.recordPennant)
      .setVisible(false);
    this.root = scene.add.container(0, 0, [this.line]).setDepth(DEPTH.recordFlag).setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.root.destroy();
      this.pennant.destroy();
    });
  }

  /** `dtMs` is visual time; `cam` gives the screen size for the confetti. */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    cam: { width: number; height: number },
  ): void {
    const best = this.best;
    if (best === null || best <= 0) return;
    if (!this.known) {
      // A run that starts above the record (debug start height) has nothing to beat.
      this.known = true;
      if (state.height > best) this.beatenMs = flag.fadeMs;
    }
    if (this.beatenMs < 0 && state.height > best) this.celebrate(state, cam);
    if (this.beatenMs >= flag.fadeMs) {
      this.root.setVisible(false);
      this.pennant.setVisible(false);
      return;
    }
    if (this.beatenMs >= 0) this.beatenMs += dtMs;
    this.place(timeMs, state);
  }

  private flagY(state: Readonly<TowerState>): number {
    return this.tower.trayTopY - ((this.best ?? 0) - state.bonusHeight) * BALANCE.layer.height;
  }

  private place(timeMs: number, state: Readonly<TowerState>): void {
    const fade = this.beatenMs < 0 ? 0 : Math.min(1, this.beatenMs / flag.fadeMs);
    const wave = Math.sin((timeMs / flag.wavePeriodMs) * TWO_PI);
    const bob = Math.sin((timeMs / flag.bobPeriodMs) * TWO_PI);
    const pulse = Math.sin((timeMs / flag.pulseMs) * TWO_PI) / 2 + 0.5;
    const [low, high] = flag.lineAlpha;
    const y = this.flagY(state);
    this.root
      .setPosition(0, y)
      .setAlpha(1 - fade)
      .setVisible(true);
    this.line.setAlpha(low + (high - low) * pulse);
    this.side = pennantSide(this.side, freeRoom(state, this.best ?? 0));
    const halfWidth = flag.labelWidth / 2;
    const x =
      this.side === 1
        ? LOGICAL_SIZE.width - flag.labelInset - halfWidth
        : flag.labelInset + halfWidth;
    this.pennant
      .setPosition(x, y - flag.labelHeight / 2 - flag.lineHeight + bob * flag.bobDistance)
      .setAngle(wave * flag.waveDeg * this.side)
      .setScale(1, 1 + flag.waveStretch * wave)
      .setAlpha(1 - fade)
      .setVisible(true);
  }

  private celebrate(state: Readonly<TowerState>, cam: { width: number; height: number }): void {
    this.beatenMs = 0;
    this.glow.flash();
    this.particleFx.confetti(cam.width, cam.height);
    this.landing.text.showLabel(
      BALANCE.tray.centerX,
      this.flagY(state) - flag.popLiftY,
      t('run.recordPop'),
      PALETTE.gold,
    );
    playCues(cuesForMoment('recordCrossed'), services);
  }
}
