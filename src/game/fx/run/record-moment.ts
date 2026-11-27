import type { TowerState } from '../../../core/tower/tower-sim';
import { BALANCE } from '../../../data/tower/balance';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { PALETTE } from '../../../data/common/palette';
import { t } from '../../../i18n';
import { services } from '../../../services';
import type { TowerView } from '../../objects/tower/tower-view';
import type { ComboGlow } from '../tower/combo-glow';
import type { LandingFx } from '../tower/landing-fx';
import { cuesForMoment } from '../audio/moment-cues';
import { ParticleFx } from '../common/particle-fx';
import { playCues } from '../audio/run-cues';

const flag = CONTINUE_ANIM.flag;

/**
 * The record of the saved Classic best inside a run: when the run first rises above it, a short
 * flash, confetti and "Record!" go off with a short blip (the fanfare belongs to the results
 * screen) and the run is not interrupted. It goes off in every mode, also where no line of the
 * record is shown (`GoalLine` draws the line).
 */
export class RecordMoment {
  private readonly particleFx: ParticleFx;
  private known = false;
  private beaten = false;

  /** `best` is the saved best height before this run, or `null` for no celebration at all. */
  constructor(
    private readonly tower: TowerView,
    private readonly landing: LandingFx,
    private readonly glow: ComboGlow,
    private readonly best: number | null,
  ) {
    this.particleFx = new ParticleFx(landing.particles);
  }

  /** `cam` gives the screen size for the confetti. */
  update(state: Readonly<TowerState>, cam: { width: number; height: number }): void {
    const best = this.best;
    if (best === null || best <= 0 || this.beaten) return;
    if (!this.known) {
      // A run that starts above the record (debug start height) has nothing to beat.
      this.known = true;
      if (state.height > best) this.beaten = true;
    }
    if (!this.beaten && state.height > best) this.celebrate(best, state, cam);
  }

  private celebrate(
    best: number,
    state: Readonly<TowerState>,
    cam: { width: number; height: number },
  ): void {
    this.beaten = true;
    this.glow.flash();
    this.particleFx.confetti(cam.width, cam.height);
    const lineY = this.tower.trayTopY - (best - state.bonusHeight) * BALANCE.layer.height;
    this.landing.text.showLabel(
      BALANCE.tray.centerX,
      lineY - flag.popLiftY,
      t('run.recordPop'),
      PALETTE.gold,
    );
    playCues(cuesForMoment('recordCrossed'), services);
  }
}
