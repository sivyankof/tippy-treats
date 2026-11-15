import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import type { FlyingLayerView } from '../objects/flying-layer-view';
import type { TowerView } from '../objects/tower-view';
import { AbilityBursts } from './abilities/ability-bursts';
import { GoldenFx } from './golden-fx';
import { wallKnockBurst } from './material-fx';
import type { Particles } from './particles';
import { RuleFx } from './rule-fx';

/**
 * What is laid around the flying layer beyond its own picture: the look of the zone rules
 * (rush, roof wind, clouds, fake-out), the shine of a golden layer and what a hard layer knocks
 * off the screen edge.
 */
export class FlyingFx {
  private readonly rules: RuleFx;
  private readonly golden: GoldenFx;
  private readonly bursts: AbilityBursts;

  constructor(
    scene: Phaser.Scene,
    tower: TowerView,
    private readonly flying: FlyingLayerView,
    particles: Particles,
  ) {
    this.rules = new RuleFx(scene, flying, particles);
    this.golden = new GoldenFx(scene, tower, flying, particles);
    this.bursts = new AbilityBursts(particles);
  }

  handleEvents(events: readonly SimEvent[]): void {
    this.rules.handleEvents(events);
  }

  /** Call after the flying view was synced for this frame. */
  update(dtMs: number, timeMs: number, state: Readonly<TowerState>): void {
    const pos = this.flying.position();
    const hidden = this.rules.update(dtMs, timeMs, state, pos);
    this.golden.update(dtMs, timeMs, state, pos, hidden);
    const touch = this.flying.takeWallTouch();
    if (touch && !hidden) {
      const { knock, creature, x, y, directionDeg } = touch;
      wallKnockBurst(this.bursts, knock, creature, x, y, directionDeg);
    }
  }
}
