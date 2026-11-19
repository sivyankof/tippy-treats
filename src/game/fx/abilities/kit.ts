import type * as Phaser from 'phaser';
import type { AbilityPayload } from '../../../core/abilities/types';
import type { TowerState } from '../../../core/tower/tower-sim';
import type { CreatureId } from '../../../data/creatures/creatures';
import { ANIM } from '../../../data/common/anim';
import type { LayerPose, TowerView } from '../../objects/tower/tower-view';
import type { LayerView } from '../../objects/tower/layer-view';
import type { CreatureColors } from '../../objects/creatures/creature-art/primitives';
import type { AbilityBursts } from './ability-bursts';
import type { RainbowArc } from './rainbow/rainbow-arc';
import type { SpriteFx } from './sprite-fx';

export { HALF_LAYER } from '../../objects/tower/layer-art';

/** Direction of a particle cone that points straight up (degrees, screen y runs down). */
export const UP_DEG = -90;

/** The shared tools a signature animation draws with. */
export interface FxKit {
  scene: Phaser.Scene;
  tower: TowerView;
  sprites: SpriteFx;
  bursts: AbilityBursts;
  arc: RainbowArc;
}

/** What a signature animation knows about the ability that just fired. */
export interface SignatureContext {
  kit: FxKit;
  creature: CreatureId;
  boosted: boolean;
  /** 0-based index of the creature layer in the tower. */
  index: number;
  /** The view of the layer; `null` when it is not drawn. */
  view: LayerView | null;
  /** Where the layer is drawn. The object is reused: read it at once. */
  pose: Readonly<LayerPose>;
  colors: CreatureColors;
  payload: AbilityPayload;
  state: Readonly<TowerState>;
  screenWidth: number;
  screenHeight: number;
}

/** The short animation that belongs to one creature. */
export type SignatureFx = (ctx: SignatureContext) => void;

/** World point of the mouth of a creature layer. */
export function mouthPoint(pose: Readonly<LayerPose>): { x: number; y: number } {
  return { x: pose.x, y: pose.y + ANIM.face.centerY + ANIM.face.mouthOffsetY };
}
