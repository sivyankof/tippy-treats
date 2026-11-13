import type { Modifiers } from '../../../core/abilities/types';
import type { TowerState } from '../../../core/tower-sim';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import type { FlyingLayerView } from '../../objects/flying-layer-view';
import type { TowerView } from '../../objects/tower-view';
import type { CameraInfo } from '../run-fx';
import type { AbilityBursts } from './ability-bursts';
import { emptyFlags, guideGlow, readActiveFlags, type ActiveFlags } from './active-state';
import { FlyingCoat, type CoatState } from './flying-coat';
import { Guides } from './guides';
import { ShieldBubble, type BubbleTarget } from './shield-bubble';
import { Vignette } from './vignette';

type Scene = ConstructorParameters<typeof Guides>[0];

/**
 * Everything that stays on while an effect is active, driven by the sim state every frame:
 * the ghost's guides and glow, the brownie's bubble, the frost and rainbow on the flying layer,
 * the lemon's vignette. Nothing here decides anything; it reads the state and the modifiers.
 */
export class WhileActiveFx {
  /** What was active in the latest `update`: the state before the sim step being handled. */
  readonly flags: ActiveFlags = emptyFlags();
  private readonly guides: Guides;
  private readonly coat: FlyingCoat;
  private readonly vignette: Vignette;
  private readonly bubble: ShieldBubble;
  private readonly coatState: CoatState = { frost: false, rainbow: false, glow: false };
  private readonly bubbleTarget: BubbleTarget = { x: 0, width: 0, surfaceY: 0 };
  private glossMs = 0;

  constructor(
    scene: Scene,
    private readonly tower: TowerView,
    private readonly flying: FlyingLayerView,
    bursts: AbilityBursts,
  ) {
    this.guides = new Guides(scene);
    this.coat = new FlyingCoat(scene);
    this.vignette = new Vignette(scene);
    this.bubble = new ShieldBubble(scene, bursts);
  }

  /** The shield caught a miss. */
  popShield(): void {
    this.bubble.pop(this.target());
  }

  /** The shield ran out. */
  meltShield(): void {
    this.bubble.melt(this.target());
  }

  /** `running` is false once the run is over: every visual then fades out. */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    mods: Readonly<Modifiers>,
    cam: Readonly<CameraInfo>,
    running: boolean,
  ): void {
    const flags = readActiveFlags(state.effects, state.shield, running, this.flags);
    const guidesOn = running && mods.guides;
    const flyingX = state.flying?.x ?? null;

    this.coatState.frost = flags.frosty;
    this.coatState.rainbow = flags.rainbow;
    this.coatState.glow = guideGlow(
      guidesOn,
      flyingX,
      this.tower.topViewX(),
      mods.perfectTolerance,
    );
    this.coat.update(
      dtMs,
      timeMs,
      this.coatState,
      this.flying.position(),
      state.flying?.width ?? 0,
    );
    this.guides.update(
      dtMs,
      guidesOn,
      this.tower.topSpan(),
      this.tower.topY(),
      cam.scrollY + HUD_LAYOUT.bottomEdge,
    );
    this.vignette.update(dtMs, timeMs, flags.lemon, cam.width, cam.height);
    this.bubble.update(dtMs, timeMs, state.shield > 0, running, this.target());
    this.runRainbowGloss(dtMs, flags.rainbow && flyingX !== null);
  }

  /** A white band runs over the flying layer now and then while the rainbow is on. */
  private runRainbowGloss(dtMs: number, on: boolean): void {
    if (!on) {
      this.glossMs = 0;
      return;
    }
    this.glossMs += dtMs;
    if (this.glossMs < ABILITY_ANIM.active.rainbow.glossEveryMs) return;
    this.glossMs = 0;
    this.flying.sweepGloss();
  }

  private target(): BubbleTarget {
    const span = this.tower.topSpan();
    const t = this.bubbleTarget;
    t.x = this.tower.topViewX();
    t.width = span.right - span.left;
    t.surfaceY = this.tower.topY();
    return t;
  }
}
