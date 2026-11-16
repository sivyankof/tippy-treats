import type { SimEvent } from '../../../core/tower-sim';
import { MASTER_ANIM } from '../../../data/master-anim';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import type { TowerView } from '../../objects/tower-view';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import type { LandingFx } from '../landing-fx';
import { HALF_LAYER, UP_DEG, type FxKit } from './kit';
import { makeSpec } from './sprite-motion';

type MasteryEvent = Extract<SimEvent, { type: 'mastery' }>;

const cfg = MASTER_ANIM;
const heartEase = easeFn('Sine.easeOut');

/**
 * What the master effects add in the world, beyond the caption of the HUD: the lemon's salute,
 * the twins' hug and the sugar dust of the puff. The score the rainbow's protected layer pays has
 * no label of its own: the score counter of the HUD shows it.
 * The caption is the general answer to every `mastery` event; the other master effects have only
 * that for now. All of it is drawn from pools that exist already (particles, sprites, texts).
 */
export class MasterFx {
  constructor(
    private readonly kit: FxKit,
    private readonly tower: TowerView,
    private readonly landing: LandingFx,
    private readonly flareVignette: () => void,
  ) {}

  /** `index` is the top layer of the tower: the layer that was just placed. */
  onMastery(event: MasteryEvent, index: number): void {
    const pose = this.tower.layerPose(index);
    if (!pose) return;
    switch (event.creature) {
      case 'lemon':
        this.salute(pose.x, pose.y);
        break;
      case 'twins':
        this.hug(index, pose.x, pose.y);
        break;
      case 'puff':
        this.dust(pose.x, pose.y, pose.width, event.score);
        break;
      default:
        break;
    }
  }

  /** Lemon "Swagger": a fan of lemon wedges and confetti from the top layer, the vignette flares. */
  private salute(x: number, y: number): void {
    if (effectsMode.reduced) return;
    const { count, style, colors } = cfg.lemon;
    this.kit.bursts.cone(x, y - HALF_LAYER, UP_DEG, count, style, FX_TEXTURES.drop, colors);
    this.flareVignette();
  }

  /** Twins "Peace": the two faces lean together and a heart floats up. */
  private hug(index: number, x: number, y: number): void {
    const view = this.tower.viewAt(index);
    const { leanShare, leanMs, heartRisePx, heartMs, heartScale, heartLiftY } = cfg.twins;
    view?.faceView.hug(leanShare, leanMs);
    if (effectsMode.reduced) return;
    const y0 = y - HALF_LAYER - heartLiftY;
    this.kit.sprites.spawn(
      makeSpec({
        texture: FX_TEXTURES.heart,
        x0: x,
        y0,
        y1: y0 - heartRisePx,
        lifeMs: heartMs,
        scaleX0: 0.4,
        scaleX1: heartScale,
        alpha1: 0,
        move: heartEase,
        depth: DEPTH.particles,
      }),
    );
  }

  /** Puff "Sugar dust": white dust from both sides of the widened layer and the score floats up. */
  private dust(x: number, y: number, width: number, score: number): void {
    this.scoreLabel(x, y, score);
    if (effectsMode.reduced) return;
    const { count, style, color } = cfg.puff;
    this.kit.bursts.edges(x, y, width, count, style, FX_TEXTURES.star, [color]);
  }

  private scoreLabel(x: number, y: number, score: number): void {
    if (score <= 0) return;
    this.landing.text.showLabel(
      x,
      y - HALF_LAYER - cfg.scoreLabel.liftY,
      t('mastery.plus', { n: formatNumber(score) }),
      PALETTE.gold,
    );
  }
}
