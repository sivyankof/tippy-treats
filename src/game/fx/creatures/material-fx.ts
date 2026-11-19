import type {
  CreatureMaterial,
  MaterialBurst,
  MaterialTexture,
} from '../../../data/creatures/creature-materials';
import { BALANCE } from '../../../data/tower/balance';
import type { CreatureId } from '../../../data/creatures/creatures';
import { EDGE_SQUASH } from '../../../data/tower/edge-squash';
import { parseHex } from '../../../util/color';
import { effectsMode } from '../../effects-mode';
import { creatureColors } from '../../objects/creature-art/primitives';
import type { LayerPose, TowerView } from '../../objects/tower-view';
import { AbilityBursts } from '../abilities/ability-bursts';
import { HALF_LAYER, UP_DEG } from '../abilities/kit';
import { DROP_BIG_SCALE, FX_TEXTURES } from '../common/fx-textures';
import { ringPoint, sparkleDelay } from '../tower/layer-sparkle';
import { twinkle } from '../common/sparkle-fx';
import type { Particles } from '../common/particles';

/** How hard a landing pushes the camera and the squash wave (multipliers). */
export interface Impact {
  kick: number;
  wave: number;
}

const NO_IMPACT: Readonly<Impact> = { kick: 1, wave: 1 };

const TEXTURES: Readonly<Record<MaterialTexture, string>> = {
  drop: FX_TEXTURES.drop,
  circle: FX_TEXTURES.circle,
  star: FX_TEXTURES.star,
  crumb: FX_TEXTURES.crumb,
  spark: FX_TEXTURES.spark,
};

/** Colours of a burst: palette keys of the creature, or hex colours of their own. */
function burstTints(burst: Pick<MaterialBurst, 'colors'>, creature: CreatureId): number[] {
  const palette = creatureColors(creature);
  return burst.colors.map((c) =>
    c.startsWith('#') ? parseHex(c) : palette[c as keyof typeof palette],
  );
}

/**
 * A hard flying layer knocked against the screen edge: its particles fly from (`x`, `y`) in
 * `directionDeg`, away from the wall. None in "fewer effects".
 */
export function wallKnockBurst(
  bursts: AbilityBursts,
  burst: Readonly<Omit<MaterialBurst, 'from'>>,
  creature: CreatureId,
  x: number,
  y: number,
  directionDeg: number,
): void {
  if (effectsMode.reduced) return;
  coneBurst(bursts, burst, creature, x, y, directionDeg);
}

/**
 * A fast flying layer touched the screen edge: `count` drops of its glaze (`tint`), `size` times
 * their full size (the weaker the touch, the smaller), fly up from
 * a little inside the wall at (`wallX`, `y`), `inwards` being 1 for the left wall and -1 for the
 * right one. None in "fewer effects".
 */
export function wallGlazeDrops(
  bursts: AbilityBursts,
  count: number,
  size: number,
  tint: number,
  wallX: number,
  y: number,
  inwards: 1 | -1,
): void {
  if (effectsMode.reduced || count <= 0) return;
  const { insetPx, riseShare, awayDeg, launch, style } = EDGE_SQUASH.drops;
  const scale: [number, number] = [
    (style.scale[0]! * size) / DROP_BIG_SCALE,
    (style.scale[1]! * size) / DROP_BIG_SCALE,
  ];
  // One drop per launch, each its own way and speed, so they fly apart instead of in a clump.
  for (const { offsetDeg, speed } of launch.slice(0, count)) {
    bursts.cone(
      wallX + inwards * insetPx,
      y - riseShare * BALANCE.layer.height,
      UP_DEG + inwards * (awayDeg + offsetDeg),
      1,
      { ...style, speed: [speed, speed], scale },
      FX_TEXTURES.dropBig,
      [tint],
    );
  }
}

/** A cone of the burst's particles from (`x`, `y`) in `directionDeg`, in the texture and tints of its material. */
function coneBurst(
  bursts: AbilityBursts,
  burst: Readonly<Omit<MaterialBurst, 'from'>>,
  creature: CreatureId,
  x: number,
  y: number,
  directionDeg: number,
): void {
  bursts.cone(
    x,
    y,
    directionDeg,
    burst.count,
    burst.style,
    TEXTURES[burst.texture],
    burstTints(burst, creature),
  );
}

/**
 * The material effects of the creature layers that are not the layer's own shape: particles of
 * a landing, crumbs and powder shed while the tower sways hard, the gloss of glossy layers and
 * the push of a heavy one. "Fewer effects" turns all of them off; the landing squash stays.
 */
export class MaterialFx {
  private readonly bursts: AbilityBursts;
  private clockMs = 0;
  /** Time of the last shed burst and of the last gloss, per layer index. */
  private readonly lastShed = new Map<number, number>();
  private readonly lastGloss = new Map<number, number>();
  /** Clock time of the next twinkle, per layer index. */
  private readonly nextSparkle = new Map<number, number>();

  constructor(
    private readonly tower: TowerView,
    private readonly particles: Particles,
  ) {
    this.bursts = new AbilityBursts(particles);
  }

  /** The layer with the 0-based index just landed; returns how hard it pushes. */
  landed(index: number): Readonly<Impact> {
    const view = this.tower.viewAt(index);
    const creature = view?.look.creature;
    const material = view?.material.current;
    if (!view || !creature || !material || effectsMode.reduced) return NO_IMPACT;
    view.material.startShiver();
    if (material.glossOnLand) view.playGlossSweep();
    this.lastGloss.set(index, this.clockMs);
    const pose = this.tower.layerPose(index);
    if (pose && material.landBurst) this.emit(material.landBurst, creature, pose);
    return material.impact ?? NO_IMPACT;
  }

  /** Sheds particles while the tower sways hard and lets glossy layers shine now and then. */
  update(dtMs: number, wobble: number): void {
    if (effectsMode.reduced) return;
    this.clockMs += dtMs;
    for (const [index, view] of this.tower.views()) {
      const creature = view.look.creature;
      const material = view.material.current;
      if (!creature || !material) continue;
      this.shed(index, creature, material, wobble);
      const every = material.glossEveryMs;
      if (every && this.clockMs - (this.lastGloss.get(index) ?? -Infinity) >= every) {
        this.lastGloss.set(index, this.clockMs);
        const sweep = material.glossSweep;
        view.playGlossSweep(sweep?.ms, sweep?.alpha);
      }
      this.sparkle(index, creature, material);
    }
  }

  /** A star twinkles at a random point around a layer that has sparkles, now and then. */
  private sparkle(index: number, creature: CreatureId, material: CreatureMaterial): void {
    const spec = material.sparkle;
    if (!spec) return;
    const due = this.nextSparkle.get(index);
    if (due === undefined) {
      this.nextSparkle.set(index, this.clockMs + sparkleDelay(spec.everyMs));
      return;
    }
    if (this.clockMs < due) return;
    this.nextSparkle.set(index, this.clockMs + sparkleDelay(spec.everyMs));
    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const at = ringPoint(Math.random(), pose.width, BALANCE.layer.height, spec.margin);
    twinkle(
      this.particles,
      pose.x + at.x,
      pose.y + at.y,
      burstTints({ colors: spec.tints }, creature),
    );
  }

  private shed(
    index: number,
    creature: CreatureId,
    material: CreatureMaterial,
    wobble: number,
  ): void {
    const shed = material.shed;
    if (!shed || wobble < shed.fromWobble) return;
    if (this.clockMs - (this.lastShed.get(index) ?? -Infinity) < shed.everyMs) return;
    this.lastShed.set(index, this.clockMs);
    const pose = this.tower.layerPose(index);
    if (pose) this.emit(shed.burst, creature, pose);
  }

  private emit(burst: MaterialBurst, creature: CreatureId, pose: Readonly<LayerPose>): void {
    const texture = TEXTURES[burst.texture];
    const tints = burstTints(burst, creature);
    if (burst.from === 'edges') {
      this.bursts.edges(pose.x, pose.y, pose.width, burst.count, burst.style, texture, tints);
    } else {
      coneBurst(this.bursts, burst, creature, pose.x, pose.y - HALF_LAYER, UP_DEG);
    }
  }
}
