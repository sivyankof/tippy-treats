import type {
  CreatureMaterial,
  MaterialBurst,
  MaterialTexture,
} from '../../data/creature-materials';
import type { CreatureId } from '../../data/creatures';
import { parseHex } from '../../util/color';
import { effectsMode } from '../effects-mode';
import { creatureColors } from '../objects/creature-art/primitives';
import type { LayerPose, TowerView } from '../objects/tower-view';
import { AbilityBursts } from './abilities/ability-bursts';
import { HALF_LAYER, UP_DEG } from './abilities/kit';
import { FX_TEXTURES } from './fx-textures';
import type { Particles } from './particles';

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
function burstTints(burst: MaterialBurst, creature: CreatureId): number[] {
  const palette = creatureColors(creature);
  return burst.colors.map((c) =>
    c.startsWith('#') ? parseHex(c) : palette[c as keyof typeof palette],
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

  constructor(
    private readonly tower: TowerView,
    particles: Particles,
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
        view.playGlossSweep();
      }
    }
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
      this.bursts.cone(
        pose.x,
        pose.y - HALF_LAYER,
        UP_DEG,
        burst.count,
        burst.style,
        texture,
        tints,
      );
    }
  }
}
