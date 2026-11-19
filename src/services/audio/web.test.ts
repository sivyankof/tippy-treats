import { describe, expect, it, vi } from 'vitest';
import { MUSIC_WATCHDOG } from '../../data/audio/music-watchdog';
import { AUDIO_MIX } from '../../data/audio/audio-mix';
import { SFX } from '../../data/audio/sfx';
import { NO_MUSIC, type MusicControl, type MusicFactory } from './music-control';
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
  closes = 0;
  close = () => {
    this.closes++;
    return Promise.reject(new Error('closed'));
  };
  suspend = () => {
    this.suspends++;
    return Promise.reject(new Error('closed'));
  };
}

/** A music player that only reports whether a tune plays, as the real one does through its host. */
const PLAYING_MUSIC: MusicFactory = (host) => ({
  ...NO_MUSIC,
  playlist: () => host.onPlaying?.(true),
  play: () => host.onPlaying?.(true),
  stop: () => host.onPlaying?.(false),
});

function setup(musicFactory?: MusicFactory) {
  const ctx = new FakeContext();
  let created = 0;
  const service = new WebAudioService(
    () => {
      created++;
      // The fake implements just the members the synth uses.
      return ctx as unknown as AudioContext;
    },
    Math.random,
    musicFactory,
  );
  return { ctx, service, created: () => created };
}

describe('WebAudioService', () => {
  it('closes the context and stops retrying when the graph cannot be built', () => {
    const ctx = new FakeContext();
    ctx.createGain = () => {
      throw new Error('no gain');
    };
    let created = 0;
    const service = new WebAudioService(() => {
      created++;
      return ctx as unknown as AudioContext;
    });
    service.unlock();
    service.unlock();
    service.unlock();
    expect(created).toBe(1);
    expect(ctx.closes).toBe(1);
    expect(service.debugStats().contextState).toBe('none');
  });

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
    ctx.currentTime += AUDIO_MIX.dedupeById.collapseThud! + 0.001;
    service.collapseThud(101);
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('plays a perfect bell with several partials and a five-note record fanfare', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.perfect(1);
    // No tune plays: the normal bell, whatever the switch says.
    expect(ctx.oscillators).toHaveLength(SFX.perfect.partials.length);
    ctx.oscillators.length = 0;
    service.record();
    expect(ctx.oscillators).toHaveLength(5);
  });

  it('softens the perfect bell only while the music is really heard', () => {
    const { ctx, service } = setup(PLAYING_MUSIC);
    const partialsOf = (): number => {
      ctx.oscillators.length = 0;
      ctx.currentTime += 1;
      service.perfect(1);
      return ctx.oscillators.length;
    };
    const soft = SFX.perfect.underMusic.partials.length;
    const normal = SFX.perfect.partials.length;
    service.unlock();
    expect(partialsOf()).toBe(normal);
    service.music.play('kitchen');
    expect(partialsOf()).toBe(soft);
    service.setLevels({ music: 0 });
    expect(partialsOf()).toBe(normal);
    service.setLevels({ music: 1 });
    expect(partialsOf()).toBe(soft);
    service.setMusicEnabled(false);
    expect(partialsOf()).toBe(normal);
    service.setMusicEnabled(true);
    expect(partialsOf()).toBe(soft);
    service.music.stop();
    expect(partialsOf()).toBe(normal);
  });

  it('the bell over the music is 3-4 dB quieter and has less of its upper partials', () => {
    const bell = SFX.perfect;
    expect(bell.underMusic.gainDb).toBeLessThanOrEqual(-3);
    expect(bell.underMusic.gainDb).toBeGreaterThanOrEqual(-4);
    expect(bell.underMusic.attack).toBeGreaterThan(bell.attack);
    const upper = (partials: readonly { ratio: number; gain: number }[]) =>
      partials.filter((p) => p.ratio > 1).reduce((sum, p) => sum + p.gain, 0) /
      partials.reduce((sum, p) => sum + p.gain, 0);
    expect(upper(bell.underMusic.partials)).toBeLessThan(upper(bell.partials) * 0.6);
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
    expect(service.debugStats()).toEqual({ liveNodes: 0, musicNodes: 0, contextState: 'none' });
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
      ...NO_MUSIC,
      playlist: () => log.push('playlist'),
      play: (track) => log.push(`play ${track}`),
      stop: () => log.push('stop'),
      hold: (reason, on) => log.push(`hold ${reason} ${on}`),
    };
    const ctx = new FakeContext();
    const service = new WebAudioService(
      () => ctx as unknown as AudioContext,
      Math.random,
      () => player,
    );
    service.music.playlist();
    expect(log).toEqual([]);
    service.unlock();
    expect(log).toEqual(['playlist']);
    service.suspend('ad');
    expect(log.at(-1)).toBe('hold app true');
    service.resume('ad');
    expect(log.at(-1)).toBe('hold app false');
    service.setMusicEnabled(false);
    expect(log.at(-1)).toBe('stop');
    service.music.play('daily');
    service.setMusicEnabled(true);
    expect(log.at(-1)).toBe('play daily');
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

  it('makes the context again when it says it runs but its clock stands still, at most a few times', () => {
    vi.useFakeTimers();
    try {
      const contexts: FakeContext[] = [];
      const players: string[] = [];
      let made = 0;
      const factory: MusicFactory = () => {
        const id = ++made;
        return {
          ...NO_MUSIC,
          position: () => ({ index: 4, turnSec: 30 }),
          resumeAt: (at) => players.push(`${id} resume ${at.index} ${at.turnSec}`),
          dispose: () => players.push(`${id} dispose`),
        };
      };
      const service = new WebAudioService(
        () => {
          const ctx = new FakeContext();
          ctx.state = 'running';
          contexts.push(ctx);
          return ctx as unknown as AudioContext;
        },
        Math.random,
        factory,
        () => undefined,
        true,
      );
      service.duckMusic('window', true);
      service.unlock();
      expect(contexts).toHaveLength(1);
      vi.advanceTimersByTime(MUSIC_WATCHDOG.frozenClockMs + MUSIC_WATCHDOG.checkMs * 2);
      expect(contexts).toHaveLength(2);
      expect(contexts[0]?.closes).toBe(1);
      // The old player went before its context; the new one took over its place.
      expect(players.slice(0, 2)).toEqual(['1 dispose', '2 resume 4 30']);
      expect(service.musicState().ducks).toEqual(['window']);
      vi.advanceTimersByTime(60_000);
      expect(contexts).toHaveLength(1 + MUSIC_WATCHDOG.maxContextRemakes);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a running context with a moving clock alone, and one held for the background', () => {
    vi.useFakeTimers();
    try {
      let made = 0;
      const ctx = new FakeContext();
      ctx.state = 'running';
      const service = new WebAudioService(() => {
        made++;
        return ctx as unknown as AudioContext;
      });
      service.unlock();
      for (let i = 0; i < 20; i++) {
        ctx.currentTime += 0.5;
        vi.advanceTimersByTime(MUSIC_WATCHDOG.checkMs);
      }
      service.suspend('app');
      vi.advanceTimersByTime(10_000);
      expect(made).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('in a browser a dead context waits for the next tap to be made again', () => {
    vi.useFakeTimers();
    try {
      const contexts: FakeContext[] = [];
      const service = new WebAudioService(() => {
        const ctx = new FakeContext();
        ctx.state = 'running';
        contexts.push(ctx);
        return ctx as unknown as AudioContext;
      });
      service.unlock();
      vi.advanceTimersByTime(MUSIC_WATCHDOG.frozenClockMs * 3);
      expect(contexts).toHaveLength(1);
      service.unlock();
      expect(contexts).toHaveLength(2);
      expect(contexts[0]?.closes).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a clock that moved once is never judged dead, even if it stands later', () => {
    vi.useFakeTimers();
    try {
      let made = 0;
      const ctx = new FakeContext();
      ctx.state = 'running';
      const service = new WebAudioService(
        () => {
          made++;
          return ctx as unknown as AudioContext;
        },
        Math.random,
        undefined,
        () => undefined,
        true,
      );
      service.unlock();
      ctx.currentTime = 0.5;
      vi.advanceTimersByTime(MUSIC_WATCHDOG.checkMs);
      vi.advanceTimersByTime(MUSIC_WATCHDOG.frozenClockMs * 5);
      expect(made).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
