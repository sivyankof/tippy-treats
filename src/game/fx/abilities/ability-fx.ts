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
import { rainbowArcOnLand } from './active-state';
import { AbilityBursts } from './ability-bursts';
import { CrumbFlight } from './crumb-flight';
import { effectsMode } from '../../effects-mode';
import { FX_TEXTURES } from '../fx-textures';
import { HALF_LAYER, UP_DEG, type FxKit, type SignatureContext } from './kit';
import { MasterFx } from './master-fx';
import { RainbowArc } from './rainbow-arc';
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
  private readonly master: MasterFx;
  /** Sounds of the rainbow, set by the run effects. */
  onRainbowPuff: (() => void) | null = null;
  private trailMs = 0;
  private trailGapMs = 0;

  constructor(
    scene: Scene,
    private readonly tower: TowerView,
    private readonly flying: FlyingLayerView,
    private readonly landing: LandingFx,
  ) {
    const bursts = new AbilityBursts(landing.particles);
    this.kit = {
      scene,
      tower,
      sprites: new SpriteFx(scene),
      bursts,
      arc: new RainbowArc(scene, bursts),
    };
    this.active = new WhileActiveFx(scene, tower, this.flying, bursts);
    this.crumbs = new CrumbFlight(this.kit);
    this.master = new MasterFx(this.kit, tower, landing, () => this.active.flareVignette());
    this.kit.arc.onDeflate = () => this.onRainbowPuff?.();
  }

  /** The Rainbow arc is fully grown (the benchmark's still waits for it). */
  get rainbowArcGrown(): boolean {
    return this.kit.arc.fullyGrown;
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
        case 'spawn':
          if (event.layer.kind === 'creature' && event.layer.creature === 'rainbow') {
            this.onRainbowArrive(state);
          }
          break;
        case 'land':
          this.onLand(event, state, memo, mods);
          break;
        case 'ability':
          this.onAbility(event, state, cam);
          break;
        case 'mastery':
          this.master.onMastery(event, state.layers.length - 1);
          break;
        case 'perk':
          this.master.onPerk(event, state.layers.length - 1);
          break;
        case 'miss':
          if (event.shielded) this.active.popShield();
          break;
        case 'effect_end':
          if (event.effect === 'shield' && !caught) this.active.meltShield();
          if (event.effect === 'rainbow') this.kit.arc.stop();
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
    const body = this.flying.body();
    this.runTrail(dtMs, body);
    this.kit.arc.update(
      dtMs,
      body && { x: body.x, y: body.y - HALF_LAYER },
      cam.scrollY + cam.height,
      this.tower.topY(),
    );
  }

  /** The Rainbow layer flies in: a short rainbow trail follows it and the neighbours turn to look. */
  private onRainbowArrive(state: Readonly<TowerState>): void {
    if (effectsMode.reduced) return;
    const { trailMs, lookMs } = ABILITY_ANIM.rainbow.arrival;
    this.trailMs = trailMs;
    this.trailGapMs = 0;
    const pos = this.flying.position();
    if (!pos) return;
    const top = state.layers.length - 1;
    for (const index of [top, top - 1]) {
      this.tower.viewAt(index)?.glanceAtWorld(pos.x, pos.y, lookMs);
    }
  }

  private runTrail(
    dtMs: number,
    body: Readonly<{ x: number; y: number; width: number }> | null,
  ): void {
    if (this.trailMs <= 0 || !body || effectsMode.reduced) return;
    this.trailMs -= dtMs;
    this.trailGapMs += dtMs;
    const { everyMs, count } = ABILITY_ANIM.rainbow.arrival;
    if (this.trailGapMs < everyMs) return;
    this.trailGapMs = 0;
    this.kit.bursts.cone(
      body.x,
      body.y + HALF_LAYER,
      UP_DEG + 180,
      count,
      ABILITY_ANIM.active.rainbow.sparks.style,
      FX_TEXTURES.star,
      ABILITY_ANIM.rainbow.stripes,
    );
  }

  /** A normal (cut) landing during the spring effect slides in from where the layer really came down. */
  private onLand(
    event: LandEvent,
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    mods: Readonly<Modifiers>,
  ): void {
    const share = mods.springShare;
    if (event.quality === 'normal' && event.savedWidth === 0 && share > 0 && share < 1) {
      const { slideMs, slideEase } = ABILITY_ANIM.jelly;
      this.tower.topView()?.playSlide((event.dx * share) / (1 - share), slideMs, slideEase);
    }
    const index = state.layers.length - 1;
    if (event.savedWidth > 0) this.active.markSaved(index);
    // `mods` are the ones the drop was resolved with, `state` is after the step: read the drops left from it.
    const dropsLeft = state.effects.find((e) => e.id === 'rainbow')?.layersLeft ?? 0;
    const arcStep = rainbowArcOnLand(mods.protectCut, dropsLeft);
    const pose = arcStep === 'keep' ? null : this.tower.layerPose(index);
    if (pose) this.kit.arc.land({ x: pose.x, y: pose.y - HALF_LAYER }, arcStep === 'again');
    // A layer the rainbow saved pays the crumb coins of its would-be cut, so the crumbs fly too.
    if (this.active.flags.crumb && event.cutWidth + event.savedWidth > 0 && memo) {
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
