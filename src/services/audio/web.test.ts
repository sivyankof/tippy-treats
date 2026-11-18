import { describe, expect, it, vi } from 'vitest';
import { AUDIO_MIX } from '../../data/audio-mix';
import { SFX } from '../../data/sfx';
import type { MusicControl, MusicStartOptions } from './music-control';
import { WebAudioService } from './web';

/** The only parts of the audio graph the synth touches; everything else is not needed. */
interface FakeParam {
  value: number;
  setValueAtTime(): void;
  linearRampToValueAtTime(): void;
  exponentialRampToValueAtTime(): void;
  setTargetAtTime(value: number): void;
}

class FakeNode {
  onended: (() => void) | null = null;
  type = '';
  buffer: unknown = null;
  disconnected = false;
  readonly gain = fakeParam();
  readonly frequency = fakeParam();
  readonly Q = fakeParam();
  readonly threshold = fakeParam();
  readonly knee = fakeParam();
  readonly ratio = fakeParam();
  readonly attack = fakeParam();
  readonly release = fakeParam();
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {}
  stop(): void {}
}

function fakeParam(): FakeParam {
  const param: FakeParam = {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(value: number) {
      param.value = value;
    },
  };
  return param;
}

class FakeContext {
  currentTime = 0;
  state = 'suspended';
  sampleRate = 8000;
  destination = new FakeNode();
  oscillators: FakeNode[] = [];
  nodes = 0;
  resumes = 0;
  suspends = 0;
  private node(): FakeNode {
    this.nodes++;
    return new FakeNode();
  }
  gains: FakeNode[] = [];
  createGain = () => {
    const g = this.node();
    this.gains.push(g);
    return g;
  };
  createDynamicsCompressor = () => this.node();
  createWaveShaper = () => this.node();
  createBiquadFilter = () => this.node();
  createBufferSource = () => this.node();
  createOscillator = () => {
    const osc = this.node();
    this.oscillators.push(osc);
    return osc;
  };
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  resume = () => {
    this.resumes++;
    return Promise.resolve();
  };
  suspend = () => {
    this.suspends++;
    return Promise.reject(new Error('closed'));
  };
}

function setup() {
  const ctx = new FakeContext();
  let created = 0;
  const service = new WebAudioService(() => {
    created++;
    // The fake implements just the members the synth uses.
    return ctx as unknown as AudioContext;
  });
  return { ctx, service, created: () => created };
}

describe('WebAudioService', () => {
  it('remembers the weather bed asked for before the unlock and starts it then', () => {
    const { ctx, service } = setup();
    service.setBed('rain');
    service.unlock();
    const baseline = ctx.nodes;
    expect(service.debugStats().liveNodes).toBe(5);
    service.setBed('rain');
    expect(ctx.nodes).toBe(baseline);
    service.setBed(null);
  });

  it('is a silent no-op without Web Audio', () => {
    const service = new WebAudioService(() => null);
    service.unlock();
    expect(() => {
      service.drop();
      service.perfect(3);
      service.collapseThud(0);
      service.suspend('app');
      service.resume('app');
    }).not.toThrow();
  });

  it('survives a throwing context factory', () => {
    const service = new WebAudioService(() => {
      throw new Error('blocked');
    });
    expect(() => {
      service.unlock();
      service.click();
    }).not.toThrow();
  });

  it('drops sounds requested before unlock', () => {
    const { ctx, service } = setup();
    service.drop();
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('plays nothing while disabled and again once enabled', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.setEnabled(false);
    expect(service.enabled).toBe(false);
    service.drop();
    service.coin();
    expect(ctx.oscillators).toHaveLength(0);
    service.setEnabled(true);
    service.drop();
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });

  it('creates the context once and resumes it on each unlock', () => {
    const { ctx, service, created } = setup();
    service.unlock();
    service.unlock();
    expect(created()).toBe(1);
    expect(ctx.resumes).toBe(2);
  });

  it('forwards suspend and resume, ignoring rejections, and is silent while hidden', async () => {
    const { ctx, service } = setup();
    service.unlock();
    service.suspend('app');
    expect(ctx.suspends).toBe(1);
    service.click();
    expect(ctx.oscillators).toHaveLength(0);
    service.resume('app');
    expect(ctx.resumes).toBe(2);
    service.click();
    expect(ctx.oscillators).toHaveLength(1);
    await Promise.resolve();
  });

  it('stays silent until every suspend reason is lifted', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.suspend('ad');
    service.suspend('app');
    service.resume('app');
    expect(ctx.resumes).toBe(1);
    service.click();
    expect(ctx.oscillators).toHaveLength(0);
    service.resume('ad');
    expect(ctx.resumes).toBe(2);
    service.click();
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('does not resume on unlock while a reason holds', () => {
    const { ctx, service } = setup();
    service.suspend('ad');
    service.unlock();
    expect(ctx.resumes).toBe(0);
  });

  it('throttles the collapse series', () => {
    const { ctx, service } = setup();
    service.unlock();
    for (let i = 0; i < 100; i++) service.collapseThud(i);
    expect(ctx.oscillators).toHaveLength(1);
    ctx.currentTime += SFX.collapse.minIntervalSec + 0.001;
    service.collapseThud(101);
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('plays a perfect bell with several partials and a five-note record fanfare', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.perfect(1);
    expect(ctx.oscillators).toHaveLength(SFX.perfect.partials.length);
    ctx.oscillators.length = 0;
    service.record();
    expect(ctx.oscillators).toHaveLength(5);
  });

  it('plays the record blip as two short notes', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.recordBlip();
    expect(ctx.oscillators).toHaveLength(SFX.recordBlip.notes.length);
  });

  it('plays the slurp as a note over a hiss with a pop, and the hum as its notes', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.lickSlurp();
    expect(ctx.oscillators).toHaveLength(2);
    service.lickHum();
    expect(ctx.oscillators).toHaveLength(2 + SFX.lick.mmm.length);
    service.lickSlurpLong();
    service.lickSmack();
    expect(ctx.oscillators).toHaveLength(2 + SFX.lick.mmm.length + SFX.lick.long.notes.length + 1);
  });

  it('plays the guest sounds: the splat as two tones over a burst, the peel, the buzz and the giggle as their notes', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.guestSplat();
    expect(ctx.oscillators).toHaveLength(2);
    service.guestPeel();
    const peel = SFX.guest.peel.notes.length;
    expect(ctx.oscillators).toHaveLength(2 + peel);
    service.guestBuzz();
    expect(ctx.oscillators).toHaveLength(2 + peel + SFX.guest.buzz.length);
    service.guestGiggle();
    expect(ctx.oscillators).toHaveLength(
      2 + peel + SFX.guest.buzz.length + SFX.guest.giggle.length,
    );
  });

  it('plays the topper hop as two notes and a click', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.topperHop();
    expect(ctx.oscillators).toHaveLength(SFX.topperHop.notes.length);
  });

  it('disconnects nodes when a sound ends', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.click();
    const osc = ctx.oscillators[0];
    osc?.onended?.();
    expect(osc?.disconnected).toBe(true);
  });

  it('plays any registry sound through the typed generic call', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.play('coin');
    service.play('perfect', 3);
    expect(ctx.oscillators.length).toBeGreaterThan(SFX.coin.notes.length);
  });

  it('does not start the same sound twice within the dedupe time', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.coin();
    const first = ctx.oscillators.length;
    service.coin();
    expect(ctx.oscillators).toHaveLength(first);
    ctx.currentTime += AUDIO_MIX.dedupeSec + 0.001;
    service.coin();
    expect(ctx.oscillators).toHaveLength(first * 2);
  });

  it('refuses normal sounds at the voice cap but never a critical one', () => {
    const { ctx, service } = setup();
    service.unlock();
    const normal = [
      'coin',
      'berry',
      'click',
      'bite',
      'sneeze',
      'shieldPop',
      'lickHum',
      'guestBuzz',
    ] as const;
    for (const id of normal) service.play(id);
    const before = ctx.oscillators.length;
    service.play('guestGiggle');
    expect(ctx.oscillators).toHaveLength(before);
    service.drop();
    expect(ctx.oscillators.length).toBeGreaterThan(before);
  });

  it('counts live nodes and releases them when sounds end', () => {
    const { ctx, service } = setup();
    expect(service.debugStats()).toEqual({ liveNodes: 0, contextState: 'none' });
    service.unlock();
    service.click();
    expect(service.debugStats().liveNodes).toBe(2);
    expect(service.debugStats().contextState).toBe('suspended');
    ctx.oscillators[0]?.onended?.();
    expect(service.debugStats().liveNodes).toBe(0);
  });

  it('ramps the sfx and music buses with the switches and keeps the choice before unlock', () => {
    const { ctx, service } = setup();
    service.setMusicEnabled(false);
    service.setEnabled(false);
    expect(service.musicEnabled).toBe(false);
    service.unlock();
    // sfx bus, music bus, master: the gains of the mixer, in this order.
    expect(ctx.gains[0]?.gain.value).toBe(0);
    expect(ctx.gains[1]?.gain.value).toBe(0);
    service.setEnabled(true);
    service.setMusicEnabled(true);
    expect(ctx.gains[0]?.gain.value).toBe(AUDIO_MIX.sfxLevel);
    expect(ctx.gains[1]?.gain.value).toBe(AUDIO_MIX.musicLevel);
  });

  it('ducks the music while a window holds and for the length of the record fanfare', () => {
    vi.useFakeTimers();
    try {
      const { ctx, service } = setup();
      service.unlock();
      const musicGain = ctx.gains[1];
      service.duckMusic('window', true);
      expect(musicGain?.gain.value).toBeCloseTo(AUDIO_MIX.musicLevel * (1 - AUDIO_MIX.duckShare));
      service.duckMusic('window', false);
      expect(musicGain?.gain.value).toBeCloseTo(AUDIO_MIX.musicLevel);
      service.record();
      expect(musicGain?.gain.value).toBeCloseTo(AUDIO_MIX.musicLevel * (1 - AUDIO_MIX.duckShare));
      vi.advanceTimersByTime(5000);
      expect(musicGain?.gain.value).toBeCloseTo(AUDIO_MIX.musicLevel);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hands the remembered music state to the player made at unlock', () => {
    const log: string[] = [];
    const player: MusicControl = {
      start: (o: MusicStartOptions) => log.push(`start ${o.variant} ${o.layer}`),
      stop: () => log.push('stop'),
      setLayer: (n) => log.push(`layer ${n}`),
      setMenu: (on) => log.push(`menu ${on}`),
    };
    const ctx = new FakeContext();
    const service = new WebAudioService(
      () => ctx as unknown as AudioContext,
      Math.random,
      () => player,
    );
    service.music.start({ variant: 'b', layer: 2 });
    expect(log).toEqual([]);
    service.unlock();
    expect(log).toEqual(['start b 2']);
    service.setMusicEnabled(false);
    expect(log.at(-1)).toBe('stop');
  });

  it('holds back for the silent mode like for any other reason', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.suspend('silent');
    service.click();
    expect(ctx.oscillators).toHaveLength(0);
    service.resume('silent');
    service.click();
    expect(ctx.oscillators).toHaveLength(1);
  });
});
