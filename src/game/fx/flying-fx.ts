import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import type { FlyingLayerView } from '../objects/flying-layer-view';
import type { TowerView } from '../objects/tower-view';
import { GoldenFx } from './golden-fx';
import type { Particles } from './particles';
import { RuleFx } from './rule-fx';

/**
 * What is laid around the flying layer beyond its own picture: the look of the zone rules
 * (rush, roof wind, clouds, fake-out) and the shine of a golden layer.
 */
export class FlyingFx {
  private readonly rules: RuleFx;
  private readonly golden: GoldenFx;

  constructor(
    scene: Phaser.Scene,
    tower: TowerView,
    private readonly flying: FlyingLayerView,
    particles: Particles,
  ) {
    this.rules = new RuleFx(scene, flying, particles);
    this.golden = new GoldenFx(scene, tower, flying, particles);
  }

  handleEvents(events: readonly SimEvent[]): void {
    this.rules.handleEvents(events);
  }

  /** Call after the flying view was synced for this frame. */
  update(dtMs: number, timeMs: number, state: Readonly<TowerState>): void {
    const pos = this.flying.position();
    const hidden = this.rules.update(dtMs, timeMs, state, pos);
    this.golden.update(dtMs, timeMs, state, pos, hidden);
  }
}
