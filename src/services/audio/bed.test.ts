import { describe, expect, it } from 'vitest';
import { WEATHER_BED } from '../../data/weather-bed';
import { BedPlayer, startBed } from './bed';
import { Mixer } from './mixer';

class Param {
  value = 0;
  setValueAtTime(): void {}
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(): void {}
  setTargetAtTime(): void {}
  cancelScheduledValues(): void {}
}

class Node {
  onended: (() => void) | null = null;
  type = '';
  loop = false;
  buffer: unknown = null;
  stops: number[] = [];
  disconnected = false;
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {}
  stop(at: number): void {
    this.stops.push(at);
  }
}

function rig(): { ctx: BaseAudioContext; mixer: Mixer; nodes: Node[] } {
  const nodes: Node[] = [];
  const make = (): Node => {
    const node = new Node();
    nodes.push(node);
    return node;
  };
  const ctx = {
    currentTime: 2,
    sampleRate: 100,
    destination: new Node(),
    createGain: make,
    createDynamicsCompressor: make,
    createWaveShaper: make,
    createBiquadFilter: make,
    createBufferSource: make,
    createOscillator: make,
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  } as unknown as BaseAudioContext;
  const mixer = new Mixer(ctx);
  nodes.length = 0;
  return { ctx, mixer, nodes };
}

const buffer = {} as AudioBuffer;
const recipe = WEATHER_BED.beds.rain;

describe('startBed', () => {
  it('a timed bed stops itself once and frees its five nodes', () => {
    const { ctx, mixer, nodes } = rig();
    startBed(ctx, mixer, buffer, recipe, 5);
    expect(nodes).toHaveLength(5);
    expect(mixer.tally.live).toBe(5);
    const src = nodes[0]!;
    expect(src.loop).toBe(true);
    expect(src.stops).toEqual([2 + 5 + WEATHER_BED.stopTail]);
    src.onended?.();
    expect(mixer.tally.live).toBe(0);
    expect(nodes.every((n) => n.disconnected)).toBe(true);
  });

  it('an endless bed runs until stopped, fades out and frees its nodes', () => {
    const { ctx, mixer, nodes } = rig();
    const voice = startBed(ctx, mixer, buffer, recipe, null);
    const src = nodes[0]!;
    expect(src.stops).toEqual([]);
    voice.stop();
    voice.stop();
    expect(src.stops).toEqual([2 + recipe.fadeOutSec + WEATHER_BED.stopTail]);
    src.onended?.();
    expect(mixer.tally.live).toBe(0);
  });
});

describe('BedPlayer', () => {
  it('starts one bed, swaps it and stops it', () => {
    const { ctx, mixer, nodes } = rig();
    const player = new BedPlayer(ctx, mixer, () => 0.5);
    player.set('rain');
    player.set('rain');
    expect(nodes.filter((n) => n.loop)).toHaveLength(1);
    player.set('wind');
    const looped = nodes.filter((n) => n.loop);
    expect(looped).toHaveLength(2);
    expect(looped[0]!.stops).toHaveLength(1);
    player.set(null);
    expect(looped[1]!.stops).toHaveLength(1);
  });
});
