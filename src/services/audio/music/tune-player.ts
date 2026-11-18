import {
  DEFAULT_MUSIC_MIX,
  MUSIC_BUS,
  MUSIC_PLAY,
  type MusicMix,
} from '../../../data/music/music-play';
import type { Song } from '../../../data/music/song';
import { DEFAULT_MUSIC_VARIANT, MUSIC_FILES, SONGS } from '../../../data/music/songs';
import { MS_PER_SECOND, randomSeed } from '../../../util/math';
import type { MusicControl, MusicFactory, MusicHost, MusicStartOptions } from '../music-control';
import { runSource, SOURCE_FOREVER_SEC, stopQuietly, type TimedSource } from '../node-tally';
import { FileLoop, musicFileUrl } from './file-loop';
import { MusicChain } from './music-chain';
import { MusicVoices, type VoiceHandle } from './music-voices';
import {
  clampLayer,
  crackleWindow,
  initialLevels,
  retargetLevels,
  scheduleWindow,
  songTiming,
  type LoopPlan,
  type NoteEvent,
  type PartLevel,
} from './music-schedule';
import { crackle, tapeHiss } from './tape';

/** A change during an offline render: at `at` seconds from the start, a new layer and/or the menu switch. */
export interface TuneChange {
  at: number;
  layer?: number;
  menu?: boolean;
}

/** An offline render schedules everything up front: `seconds` of the tune, with these changes. */
export interface OfflinePlan {
  seconds: number;
  changes?: readonly TuneChange[];
  /** Measurements only: play this part (index) alone, at full level. */
  only?: number;
  /** The knobs and the reverb switch of the render. */
  mix?: Partial<MusicMix>;
}

/** Wall-clock slack after the cut before the idle chain is disconnected. */
const IDLE_MARGIN_SEC = 0.05;

/** Loop plans kept at a time (the loop playing and the next one). */
const MAX_CACHED_PLANS = 4;

/**
 * The music player (`MusicControl`). Live, a look-ahead clock wakes every `tickMs` and schedules
 * the notes that start within `aheadSec`; notes whose time has passed (the context was suspended
 * or the timer starved) are skipped, so nothing bursts after a resume. Offline, the whole stretch
 * is scheduled at `start`. The music chain (filters, saturation, pump, reverb, tape, the wobble
 * LFO) is built once, at the first start; voices are created per note only and released when
 * they end. A variant listed in `MUSIC_FILES` plays its file in a loop instead.
 */
export class TunePlayer implements MusicControl {
  private chain: MusicChain | null = null;
  private voices: MusicVoices | null = null;
  private files: FileLoop | null = null;
  private readonly active = new Set<VoiceHandle>();
  private song: Song | null = null;
  private seed = 0;
  /** Loop plans of the current song, built once each (the tick runs every 25 ms). */
  private readonly plans = new Map<number, LoopPlan>();
  /** Context time of song time 0. */
  private origin = 0;
  /** Song time up to which notes are scheduled. */
  private scheduledTo = 0;
  private levels: PartLevel[] = [];
  private layer = 1;
  private menu = false;
  private playing = false;
  private hiss: AudioBuffer | null = null;
  private hissSource: TimedSource | null = null;
  private crackles: AudioBuffer | null = null;
  private mix: MusicMix;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Context time at which the voices of the tune that stopped last are cut. */
  private cutAt = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly host: MusicHost,
    private readonly offline: OfflinePlan | null = null,
  ) {
    this.mix = { ...DEFAULT_MUSIC_MIX, ...offline?.mix };
  }

  start(options: MusicStartOptions): void {
    this.stop();
    const { ctx } = this.host;
    const chain = this.ensureChain();
    const now = ctx.currentTime;
    // The voices of a tune that has just stopped are cut at `cutAt`; the new one fades in after that.
    const fadeAt = Math.max(now, this.cutAt);
    this.cancelIdle();
    chain.wake();
    this.layer = clampLayer(options.layer);
    this.menu = options.menu ?? false;
    this.playing = true;
    this.host.onPlaying?.(true);
    const fader = chain.fader.gain;
    if (fadeAt === now) fader.setValueAtTime(0, now);
    fader.setTargetAtTime(this.outLevel(), fadeAt, MUSIC_PLAY.entryRampSec);
    this.origin = fadeAt + MUSIC_PLAY.startLeadSec;

    const url = musicFileUrl(MUSIC_FILES[options.variant]);
    if (url) {
      this.files ??= new FileLoop(ctx, this.host.tally);
      void this.files.play(url, chain.fader, this.origin);
      return;
    }
    const song = SONGS[options.variant] ?? SONGS[DEFAULT_MUSIC_VARIANT];
    this.song = song;
    this.seed = randomSeed(this.host.random);
    this.plans.clear();
    this.scheduledTo = 0;
    this.levels = initialLevels(song, this.heardLayer());
    const only = this.offline?.only;
    if (only !== undefined) {
      this.levels = this.levels.map((level, i) => ({
        ...level,
        from: +(i === only),
        to: +(i === only),
      }));
    } else {
      this.startHiss(chain, this.origin);
    }
    if (this.offline) {
      this.scheduleOffline(this.offline);
    } else {
      this.timer = setInterval(this.tick, MUSIC_PLAY.tickMs);
      this.tick();
    }
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    if (!this.playing) return;
    this.playing = false;
    this.host.onPlaying?.(false);
    const { ctx } = this.host;
    const now = ctx.currentTime;
    const cut = now + MUSIC_PLAY.stopCutSec;
    this.cutAt = cut;
    const fader = this.chain?.fader.gain;
    fader?.cancelScheduledValues(now);
    fader?.setTargetAtTime(0, now, MUSIC_PLAY.stopRampSec);
    this.chain?.release(now, cut);
    this.files?.stop(cut);
    const voices: VoiceHandle[] = [...this.active];
    // Handed over: a later stop must not move the cut of these voices.
    this.active.clear();
    const hiss = this.hissSource;
    if (hiss) voices.push({ stop: (when) => stopQuietly(hiss, when) });
    this.hissSource = null;
    for (const voice of voices) voice.stop(cut);
    if (!this.offline) this.idleLater();
  }

  setLayer(layer: number): void {
    this.layer = clampLayer(layer);
    this.retarget(this.host.ctx.currentTime);
  }

  setMenu(on: boolean): void {
    this.menu = on;
    this.retarget(this.host.ctx.currentTime);
  }

  setMix(mix: Partial<MusicMix>): void {
    this.mix = { ...this.mix, ...mix };
    this.chain?.setMix(this.mix);
  }

  /** Live voices of the tune now (diagnostics and tests). */
  get voiceCount(): number {
    return this.active.size;
  }

  /** Once the cut has passed and no tune started, the chain leaves the bus (nothing of it is computed while the music is off). */
  private idleLater(): void {
    this.cancelIdle();
    const wait = (this.cutAt - this.host.ctx.currentTime + IDLE_MARGIN_SEC) * MS_PER_SECOND;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      // A suspended context has not reached the cut yet: wait for it.
      if (this.playing) return;
      if (this.host.ctx.currentTime < this.cutAt) this.idleLater();
      else this.chain?.idle();
    }, wait);
  }

  private cancelIdle(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private ensureChain(): MusicChain {
    if (this.chain) return this.chain;
    const { ctx, bus, tally, random } = this.host;
    const chain = new MusicChain(ctx, bus, tally, this.mix);
    this.chain = chain;
    this.voices = new MusicVoices(ctx, tally, random, chain.wobble);
    return chain;
  }

  /** The tape hiss: one looping source per start, from a buffer built once. */
  private startHiss(chain: MusicChain, at: number): void {
    const { ctx, tally, random } = this.host;
    const t = MUSIC_BUS.tape;
    if (!this.hiss) {
      const rate = ctx.sampleRate;
      const frames = Math.ceil(t.hissSeconds * rate);
      const samples = tapeHiss(
        frames,
        rate,
        random,
        t.hissCutoff,
        Math.ceil(t.hissLoopFadeSec * rate),
      );
      const buffer = ctx.createBuffer(1, frames, rate);
      buffer.getChannelData(0).set(samples);
      this.hiss = buffer;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.hiss;
    src.loop = true;
    const level = ctx.createGain();
    level.gain.value = t.hissLevel;
    src.connect(level);
    level.connect(chain.tape);
    runSource(tally, src, [src, level], at, at + SOURCE_FOREVER_SEC);
    this.hissSource = src;
  }

  /** The layer heard: the menu plays the first `menuLayer` layers. */
  private heardLayer(): number {
    return this.menu ? MUSIC_PLAY.menuLayer : this.layer;
  }

  private outLevel(): number {
    return MUSIC_PLAY.tuneLevel * (this.menu ? MUSIC_PLAY.menuLevel : 1);
  }

  /** Applies the layer and the menu level from context time `when` (the fades start on the next bar line). */
  private retarget(when: number): void {
    const { song, chain } = this;
    if (!this.playing || !chain) return;
    chain.fader.gain.setTargetAtTime(this.outLevel(), when, MUSIC_PLAY.menuRampSec);
    if (!song || this.offline?.only !== undefined) return;
    const at = Math.max(when - this.origin, this.scheduledTo);
    this.levels = retargetLevels(song, this.levels, this.heardLayer(), at);
  }

  private readonly tick = (): void => {
    try {
      const now = this.host.ctx.currentTime - this.origin;
      this.scheduleUntil(Math.max(this.scheduledTo, now), now + MUSIC_PLAY.aheadSec);
    } catch {
      // A failing note must never break the game.
    }
  };

  /** Schedules the notes and crackles of [from, to) in song time. */
  private scheduleUntil(from: number, to: number): void {
    const { song } = this;
    if (!song || to <= from) return;
    // Only the loops around now are ever asked for again.
    if (this.plans.size > MAX_CACHED_PLANS) this.plans.clear();
    for (const event of scheduleWindow(song, this.seed, this.levels, from, to, this.plans)) {
      this.playEvent(song, event);
    }
    if (this.offline?.only === undefined) {
      const t = MUSIC_BUS.tape;
      const beatSec = songTiming(song).barSec / song.beatsPerBar;
      for (const hit of crackleWindow(this.seed, beatSec, t.crackleChance, from, to)) {
        this.playCrackle(this.origin + hit.time, hit.strength, hit.rate);
      }
    }
    this.scheduledTo = to;
  }

  private playEvent(song: Song, event: NoteEvent): void {
    const part = song.parts[event.part];
    const { chain, voices } = this;
    if (!part || !chain || !voices) return;
    // Live only: offline every voice of the stretch is scheduled before any of them has ended.
    if (!this.offline && this.active.size >= MUSIC_PLAY.maxVoices) return;
    const time = this.origin + event.time;
    const note = { time, length: event.length, pitch: event.pitch, gain: event.gain };
    const voice = voices.play(part.instrument, note, chain.roles[part.role], () =>
      this.active.delete(voice),
    );
    this.active.add(voice);
    if (part.instrument === 'kick') chain.kick(time, event.gain / (song.gain * part.gain));
  }

  /** One vinyl crackle: a tiny buffer source and its level into the tape input. */
  private playCrackle(time: number, strength: number, rate: number): void {
    const { chain } = this;
    if (!chain) return;
    const { ctx, tally, random } = this.host;
    const t = MUSIC_BUS.tape;
    if (!this.crackles) {
      const frames = Math.max(2, Math.ceil(t.crackleSec * ctx.sampleRate));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      buffer.getChannelData(0).set(crackle(frames, random));
      this.crackles = buffer;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.crackles;
    const speed = t.crackleRate.min + (t.crackleRate.max - t.crackleRate.min) * rate;
    src.playbackRate.setValueAtTime(speed, time);
    const level = ctx.createGain();
    level.gain.value =
      t.crackleLevel * (t.crackleGain.min + (t.crackleGain.max - t.crackleGain.min) * strength);
    src.connect(level);
    level.connect(chain.tape);
    const end = time + this.crackles.duration / speed;
    runSource(tally, src, [src, level], time, end);
    const voice: VoiceHandle = { stop: (when) => stopQuietly(src, when) };
    this.active.add(voice);
    const release = src.onended;
    src.onended = (event: Event) => {
      release?.call(src, event);
      this.active.delete(voice);
    };
  }

  /** The whole offline stretch, the changes applied at their times. */
  private scheduleOffline(plan: OfflinePlan): void {
    const changes = [...(plan.changes ?? [])].sort((a, b) => a.at - b.at);
    for (const change of changes) {
      this.scheduleUntil(this.scheduledTo, change.at - this.origin);
      if (change.layer !== undefined) this.layer = clampLayer(change.layer);
      if (change.menu !== undefined) this.menu = change.menu;
      this.retarget(change.at);
    }
    this.scheduleUntil(this.scheduledTo, plan.seconds - this.origin);
  }
}

/** The live player of the game (`WebAudioService`'s music factory). */
export const createTunePlayer: MusicFactory = (host) => new TunePlayer(host);
