import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_BUS, MUSIC_PLAY } from '../../../data/music/music-play';
import type { MusicHost } from '../music-control';
import { NodeTally } from '../node-tally';
import { songTiming } from './music-schedule';
import { SONGS } from '../../../data/music/songs';
import { TunePlayer } from './tune-player';

/** Just the members of the audio graph the player touches. */
class FakeParam {
  value = 0;
  targets: Array<{ value: number; at: number }> = [];
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
  cancelScheduledValues(): void {}
  setTargetAtTime(value: number, at: number): void {
    this.targets.push({ value, at });
  }
}

class FakeNode {
  onended: ((event: Event) => void) | null = null;
  type = '';
  buffer: unknown = null;
  loop = false;
  curve: unknown = null;
  oversample = 'none';
  readonly delayTime = new FakeParam();
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
  readonly Q = new FakeParam();
  readonly playbackRate = new FakeParam();
  startAt = -1;
  stopAt = -1;
  ended = false;
  disconnected = false;
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  setPeriodicWave(): void {}
  start(at = 0): void {
    this.startAt = at;
  }
  stop(at = 0): void {
    this.stopAt = at;
  }
}

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  sources: FakeNode[] = [];
  gains: FakeNode[] = [];
  createGain = (): FakeNode => {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  };
  createOscillator = (): FakeNode => this.source();
  createBufferSource = (): FakeNode => this.source();
  createBiquadFilter = (): FakeNode => new FakeNode();
  createWaveShaper = (): FakeNode => new FakeNode();
  createDelay = (): FakeNode => new FakeNode();
  createChannelMerger = (): FakeNode => new FakeNode();
  createPeriodicWave = (): object => ({});
  createBuffer = (_channels: number, length: number, rate: number) => ({
    duration: length / rate,
    getChannelData: () => new Float32Array(length),
  });

  /** Moves the clock and ends every source whose stop time has passed. */
  advance(seconds: number): void {
    this.currentTime += seconds;
    for (const source of this.sources) {
      if (!source.ended && source.stopAt >= 0 && source.stopAt <= this.currentTime) {
        source.ended = true;
        source.onended?.(new Event('ended'));
      }
    }
  }

  private source(): FakeNode {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
}

function setup(offline: ConstructorParameters<typeof TunePlayer>[1] = null) {
  const ctx = new FakeContext();
  const tally = new NodeTally();
  const host: MusicHost = {
    ctx: ctx as unknown as BaseAudioContext,
    bus: ctx.createGain() as unknown as GainNode,
    tally,
    random: () => 0.5,
  };
  return { ctx, tally, player: new TunePlayer(host, offline) };
}

/** The music chain's fader (its gain targets show the tune's level). */
function faderOf(player: TunePlayer): FakeNode {
  return (player as unknown as { chain: { fader: FakeNode } }).chain.fader;
}

/** Live nodes of the music chain itself (built once, kept for the player's life). */
function chainNodes(player: TunePlayer): number {
  return (player as unknown as { chain: { nodes: unknown[] } }).chain.nodes.length;
}

/** Runs the live clock for `seconds` of context time in timer steps. */
function play(ctx: FakeContext, seconds: number): void {
  const step = MUSIC_PLAY.tickMs / 1000;
  for (let t = 0; t < seconds; t += step) {
    ctx.advance(step);
    vi.advanceTimersByTime(MUSIC_PLAY.tickMs);
  }
}

describe('TunePlayer (live)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedules only a short way ahead and keeps the live nodes bounded', () => {
    const { ctx, tally, player } = setup();
    player.start({ variant: 'c', layer: 6 });
    let most = 0;
    for (let i = 0; i < 40; i++) {
      play(ctx, 1);
      most = Math.max(most, tally.live);
      for (const source of ctx.sources) {
        expect(source.startAt).toBeLessThanOrEqual(ctx.currentTime + MUSIC_PLAY.aheadSec + 1e-9);
      }
    }
    expect(ctx.sources.length).toBeGreaterThan(200);
    expect(most).toBeLessThan(MUSIC_PLAY.maxVoices * 3 + 40);
    expect(player.voiceCount).toBeLessThanOrEqual(MUSIC_PLAY.maxVoices);
  });

  it('stops cleanly: no new notes, every voice cut and released, the output let go', () => {
    const { ctx, tally, player } = setup();
    player.start({ variant: 'a', layer: 6 });
    play(ctx, 5);
    const made = ctx.sources.length;
    player.stop();
    const cut = ctx.currentTime + MUSIC_PLAY.stopCutSec;
    for (const source of ctx.sources) {
      if (!source.ended) expect(source.stopAt).toBeLessThanOrEqual(cut + 1e-9);
    }
    play(ctx, 2);
    expect(ctx.sources.length).toBe(made);
    expect(player.voiceCount).toBe(0);
    vi.advanceTimersByTime(MUSIC_PLAY.stopCutSec * 4000);
    // Only the chain is left (built once); the reverb counts too while it is on.
    expect(tally.live).toBeLessThanOrEqual(chainNodes(player) + 20);
    const kept = tally.live;
    player.start({ variant: 'a', layer: 6 });
    play(ctx, 5);
    player.stop();
    play(ctx, 2);
    vi.advanceTimersByTime(MUSIC_PLAY.stopCutSec * 4000);
    expect(tally.live).toBe(kept);
  });

  it('skips the notes whose time has passed (no burst after a suspend or a starved timer)', () => {
    const { ctx, player } = setup();
    player.start({ variant: 'b', layer: 6 });
    play(ctx, 2);
    const before = ctx.sources.length;
    // The clock jumps 3 s while no timer ran (the context kept going, the page was busy).
    ctx.currentTime += 3;
    const resumedAt = ctx.currentTime;
    play(ctx, 1);
    const fresh = ctx.sources.slice(before);
    expect(fresh.length).toBeGreaterThan(0);
    for (const source of fresh) expect(source.startAt).toBeGreaterThanOrEqual(resumedAt);
    // A frozen clock (a suspended context) schedules nothing new.
    const frozen = ctx.sources.length;
    vi.advanceTimersByTime(MUSIC_PLAY.tickMs * 20);
    expect(ctx.sources.length).toBe(frozen);
  });

  it('the menu is quieter and plays layers 1-2 only', () => {
    const { ctx, player } = setup();
    player.start({ variant: 'c', layer: 6, menu: true });
    const out = faderOf(player);
    expect(out?.gain.targets.at(-1)?.value).toBeCloseTo(
      MUSIC_PLAY.tuneLevel * MUSIC_PLAY.menuLevel,
      9,
    );
    play(ctx, 3);
    const leadOnly = ctx.sources.length;
    player.setMenu(false);
    expect(out?.gain.targets.at(-1)?.value).toBeCloseTo(MUSIC_PLAY.tuneLevel, 9);
    play(ctx, 6);
    // Back on the run arrangement the drums, the melody and the second line join.
    expect(ctx.sources.length - leadOnly).toBeGreaterThan(leadOnly * 2);
  });

  it('a new start replaces the running tune', () => {
    const { ctx, tally, player } = setup();
    player.start({ variant: 'a', layer: 2 });
    play(ctx, 2);
    player.start({ variant: 'b', layer: 2 });
    play(ctx, 2);
    vi.advanceTimersByTime(MUSIC_PLAY.stopCutSec * 4000);
    player.stop();
    play(ctx, 6);
    vi.advanceTimersByTime(MUSIC_PLAY.stopCutSec * 4000);
    expect(tally.live).toBeLessThanOrEqual(chainNodes(player) + 20);
  });

  it('drops the reverb on request and lets its nodes go after the tail', () => {
    const { ctx, tally, player } = setup();
    player.start({ variant: 'b', layer: 1 });
    const withReverb = tally.live;
    player.setMix({ reverb: false });
    vi.advanceTimersByTime(MUSIC_BUS.reverb.tailSec * 1000 + 10);
    const without = tally.live;
    expect(withReverb - without).toBeGreaterThanOrEqual(MUSIC_BUS.reverb.delays.length * 3);
    player.setMix({ reverb: true });
    expect(tally.live).toBe(withReverb);
    play(ctx, 1);
  });

  it('dips the music on every kick (pump) and scales the drums with the knob', () => {
    const { ctx, player } = setup();
    player.setMix({ drums: 0.5 });
    player.start({ variant: 'a', layer: 3 });
    play(ctx, 6);
    const chain = (player as unknown as { chain: { pump: FakeNode; roles: { drums: FakeNode } } })
      .chain;
    const dips = chain.pump.gain.targets.filter((t) => t.value < 1);
    expect(dips.length).toBeGreaterThan(3);
    for (const dip of dips) expect(dip.value).toBeGreaterThan(0.75);
    expect(chain.roles.drums.gain.targets.at(-1)?.value ?? chain.roles.drums.gain.value).toBe(0.5);
  });
});

describe('TunePlayer (offline)', () => {
  it('schedules the whole stretch at start, with the changes on bar lines', () => {
    const seconds = 20;
    const { ctx, player } = setup({ seconds, changes: [{ at: 8, layer: 6 }] });
    player.start({ variant: 'c', layer: 1 });
    const last = Math.max(...ctx.sources.map((s) => s.startAt));
    expect(last).toBeGreaterThan(seconds - 1);
    expect(last).toBeLessThan(seconds);
    // Before the change only the keys and the tape play.
    const { barSec } = songTiming(SONGS.c);
    const early = ctx.sources.filter((s) => s.startAt < 8);
    const late = ctx.sources.filter((s) => s.startAt > 8 + barSec * 3);
    expect(late.length / (seconds - 8 - barSec * 3)).toBeGreaterThan((early.length / 8) * 1.5);
  });
});
