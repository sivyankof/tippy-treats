import type { Modifiers } from '../../../core/abilities/types';
import type { SimEvent, TowerState } from '../../../core/tower-sim';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { CREATURES } from '../../../data/creatures';
import { RARITY_COLORS } from '../../../data/rarity';
import { t } from '../../../i18n';
import { DEPTH } from '../../depth';
import type { FlyingLayerView } from '../../objects/flying-layer-view';
import { creatureColors } from '../../objects/creature-art/primitives';
import type { TowerView } from '../../objects/tower-view';
import type { LandingFx } from '../landing-fx';
import type { CameraInfo, FlyingMemo } from '../run-fx';
import { AbilityBursts } from './ability-bursts';
import { CrumbFlight } from './crumb-flight';
import { HALF_LAYER, type FxKit, type SignatureContext } from './kit';
import { SIGNATURES } from './signatures';
import { SpriteFx } from './sprite-fx';
import { WhileActiveFx } from './while-active';

type Scene = ConstructorParameters<typeof SpriteFx>[0];
type AbilityEvent = Extract<SimEvent, { type: 'ability' }>;
type LandEvent = Extract<SimEvent, { type: 'land' }>;

/**
 * The look of the creature abilities: the general template on every `ability` event (a flash
 * and a ring in the rarity colour, "Boosted!"), the signature animation of the creature, and
 * the visuals that stay on while an effect is active.
 */
export class AbilityFx {
  private readonly kit: FxKit;
  private readonly active: WhileActiveFx;
  private readonly crumbs: CrumbFlight;

  constructor(
    scene: Scene,
    private readonly tower: TowerView,
    flying: FlyingLayerView,
    private readonly landing: LandingFx,
  ) {
    const bursts = new AbilityBursts(landing.particles);
    this.kit = { scene, tower, sprites: new SpriteFx(scene), bursts };
    this.active = new WhileActiveFx(scene, tower, flying, bursts);
    this.crumbs = new CrumbFlight(this.kit);
  }

  /**
   * Before the sim step is shown: a jelly lets the sway calm down smoothly instead of at once.
   * It has to run before the tower is synced to the new state.
   */
  beforeSync(events: readonly SimEvent[]): void {
    if (events.some((e) => e.type === 'ability' && e.creature === 'jelly')) {
      this.tower.freeze(0, ABILITY_ANIM.jelly.calmLerp);
    }
  }

  /** `mods` are the modifiers the landing was resolved with (before the step). */
  handleEvents(
    events: readonly SimEvent[],
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    mods: Readonly<Modifiers>,
    cam: Readonly<CameraInfo>,
  ): void {
    // A shield that runs out on the step it catches a miss bursts, it does not melt.
    const caught = events.some((e) => e.type === 'miss' && e.shielded);
    for (const event of events) {
      switch (event.type) {
        case 'land':
          this.onLand(event, state, memo, mods);
          break;
        case 'ability':
          this.onAbility(event, state, cam);
          break;
        case 'miss':
          if (event.shielded) this.active.popShield();
          break;
        case 'effect_end':
          if (event.effect === 'shield' && !caught) this.active.meltShield();
          break;
        default:
          break;
      }
    }
  }

  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    mods: Readonly<Modifiers>,
    cam: Readonly<CameraInfo>,
    running: boolean,
  ): void {
    this.active.update(dtMs, timeMs, state, mods, cam, running);
    this.kit.sprites.update(dtMs);
  }

  /** A normal landing during the spring effect slides in from where the layer really came down. */
  private onLand(
    event: LandEvent,
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    mods: Readonly<Modifiers>,
  ): void {
    const share = mods.springShare;
    if (event.quality === 'normal' && share > 0 && share < 1) {
      const { slideMs, slideEase } = ABILITY_ANIM.jelly;
      this.tower.topView()?.playSlide((event.dx * share) / (1 - share), slideMs, slideEase);
    }
    if (this.active.flags.crumb && event.cutWidth > 0 && event.cutSide && memo) {
      this.crumbs.fly(event, state);
    }
  }

  private onAbility(
    event: AbilityEvent,
    state: Readonly<TowerState>,
    cam: Readonly<CameraInfo>,
  ): void {
    const index = state.layers.length - 1;
    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const view = this.tower.viewAt(index);
    const color = RARITY_COLORS[CREATURES[event.creature].rarity];
    const { flash, ring, boostedText } = ABILITY_ANIM;

    view?.rig.flash(color, flash.alpha, flash.inMs, flash.outMs);
    this.landing.ring.play(pose.x, pose.y, pose.width, { tint: color, scale: ring.scale });
    if (event.boosted) {
      this.landing.ring.play(pose.x, pose.y, pose.width, {
        tint: color,
        scale: ring.boostedScale,
        delayMs: ring.boostedDelayMs,
      });
      this.landing.text.showLabel(
        pose.x,
        pose.y - HALF_LAYER - boostedText.liftY,
        t('run.boosted'),
        color,
        DEPTH.boostedText,
      );
    }

    const context: SignatureContext = {
      kit: this.kit,
      creature: event.creature,
      boosted: event.boosted,
      index,
      view,
      pose,
      colors: creatureColors(event.creature),
      payload: event.payload,
      state,
      screenWidth: cam.width,
      screenHeight: cam.height,
    };
    SIGNATURES[event.creature](context);
  }
}
