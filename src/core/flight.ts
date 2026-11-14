import { BALANCE } from '../data/balance';
import { ZONE_RULES } from '../data/zones';
import { MS_PER_SECOND } from '../util/math';
import type { FlyingLayer, LayerPlan, SimEvent } from './sim-types';
import type { CloudRoll, LayerRules } from './zones';

/** Absorbs floating point drift so a timer of exactly N steps ends after N steps. */
const TIMER_EPSILON_MS = 1e-6;

/** Time left after `dtMs`, never negative; a hair above zero counts as done. */
function countDown(leftMs: number, dtMs: number): number {
  const left = leftMs - dtMs;
  return left < TIMER_EPSILON_MS ? 0 : left;
}

/** The fields `flyingSpeed` reads. */
export type SpeedFields = Pick<
  FlyingLayer,
  'speed' | 'x' | 'rule' | 'rush' | 'windupMs' | 'stopMs'
>;

/** Roof profile factor at `x`: `edgeMult` at the walls, `centreMult` in the middle (sine). */
export function roofFactor(x: number): number {
  const { minCenterX, maxCenterX } = BALANCE.layer;
  const u = Math.min(1, Math.max(0, (x - minCenterX) / (maxCenterX - minCenterX)));
  const { edgeMult, centreMult } = ZONE_RULES.roof;
  return edgeMult + (centreMult - edgeMult) * Math.sin(Math.PI * u);
}

/**
 * Speed of the layer right now, px/s: zero during the rush wind-up and the fake-out stop,
 * otherwise the nominal speed times the rush multiplier and the roof profile where they apply.
 */
export function flyingSpeed(layer: SpeedFields): number {
  if (layer.windupMs > 0 || layer.stopMs > 0) return 0;
  let speed = layer.speed;
  if (layer.rush) speed *= ZONE_RULES.rush.speedMult;
  if (layer.rule === 'roof') speed *= roofFactor(layer.x);
  return speed;
}

/** A freshly spawned layer of the given plan, width and nominal speed, under the given rules. */
export function newFlyingLayer(
  plan: LayerPlan,
  rules: LayerRules,
  width: number,
  speed: number,
): FlyingLayer {
  const { minCenterX, maxCenterX } = BALANCE.layer;
  return {
    ...plan,
    index: rules.index,
    x: rules.fromLeft ? minCenterX : maxCenterX,
    width,
    dir: rules.fromLeft ? 1 : -1,
    speed,
    zoneIndex: rules.zoneIndex,
    rule: rules.rule,
    rush: rules.rush,
    windupMs: rules.rush ? ZONE_RULES.rush.windupMs : 0,
    stopMs: 0,
    coverMs: 0,
    pass: 1,
  };
}

/**
 * Motion of one flying layer: wall bounce, rush wind-up, roof profile, fake-out stop and
 * reverse, pass counting and cloud cover. It mutates the layer and reports events; the
 * state machine around it is `TowerSim`.
 */
export class Flight {
  private passStartX: number;
  private cloud: CloudRoll | null;
  private cloudStarted = false;
  private fakeoutDone = false;

  /** `rollCloud(pass)` is the pure cloud schedule of the layer (core/zones.ts). */
  constructor(
    private readonly layer: FlyingLayer,
    private readonly fakeoutX: number | null,
    private readonly rollCloud: (pass: number) => CloudRoll | null,
  ) {
    this.passStartX = layer.x;
    this.cloud = rollCloud(layer.pass);
  }

  step(dtMs: number, events: SimEvent[]): void {
    const layer = this.layer;
    layer.coverMs = countDown(layer.coverMs, dtMs);
    if (layer.windupMs > 0) {
      layer.windupMs = countDown(layer.windupMs, dtMs);
      return;
    }
    if (layer.stopMs > 0) {
      layer.stopMs = countDown(layer.stopMs, dtMs);
      if (layer.stopMs === 0) layer.dir = layer.dir === 1 ? -1 : 1;
      return;
    }

    const from = layer.x;
    const to = from + (layer.dir * flyingSpeed(layer) * dtMs) / MS_PER_SECOND;
    if (this.crossesFakeout(from, to)) {
      this.startFakeout(events);
      return;
    }
    this.bounce(to);
    this.arriveCloud(events);
  }

  private crossesFakeout(from: number, to: number): boolean {
    const point = this.fakeoutX;
    if (point === null || this.fakeoutDone) return false;
    return (from < point && to >= point) || (from > point && to <= point);
  }

  private startFakeout(events: SimEvent[]): void {
    const layer = this.layer;
    const x = this.fakeoutX ?? layer.x;
    this.fakeoutDone = true;
    layer.x = x;
    layer.stopMs = ZONE_RULES.stars.stopMs;
    events.push({ type: 'fakeout', x, stopMs: layer.stopMs });
  }

  /** Moves the layer to `to`, reflecting off the walls; a bounce starts a new pass. */
  private bounce(to: number): void {
    const layer = this.layer;
    const { minCenterX, maxCenterX } = BALANCE.layer;
    let x = to;
    let wall: number | null = null;
    if (x > maxCenterX) {
      x = maxCenterX - (x - maxCenterX);
      layer.dir = -1;
      wall = maxCenterX;
    } else if (x < minCenterX) {
      x = minCenterX + (minCenterX - x);
      layer.dir = 1;
      wall = minCenterX;
    }
    layer.x = x;
    if (wall === null) return;
    layer.pass += 1;
    this.passStartX = wall;
    this.cloud = this.rollCloud(layer.pass);
    this.cloudStarted = false;
  }

  /** Starts the cloud of this pass once the layer has covered the rolled share of the track. */
  private arriveCloud(events: SimEvent[]): void {
    const layer = this.layer;
    const roll = this.cloud;
    if (!roll || this.cloudStarted) return;
    const { minCenterX, maxCenterX } = BALANCE.layer;
    const progress = Math.abs(layer.x - this.passStartX) / (maxCenterX - minCenterX);
    if (progress < roll.startProgress) return;
    this.cloudStarted = true;
    // A cloud that arrives while the previous one still hangs there extends the cover.
    layer.coverMs = Math.max(layer.coverMs, roll.coverMs);
    events.push({ type: 'cloud', coverMs: roll.coverMs, pass: layer.pass });
  }
}
