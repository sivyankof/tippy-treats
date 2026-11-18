import { MUSIC_PLAY } from '../../../data/music/music-play';
import type { Song } from '../../../data/music/song';
import { DEFAULT_MUSIC_VARIANT, SONGS } from '../../../data/music/songs';
import { randomSeed } from '../../../util/math';
import type { MusicControl, MusicFactory, MusicHost, MusicStartOptions } from '../music-control';
import type { TimedSource } from '../node-tally';
import { MusicVoices } from './music-voices';
import {
  clampLayer,
  initialLevels,
  retargetLevels,
  scheduleWindow,
  type LoopPlan,
  type NoteEvent,
  type PartLevel,
} from './music-schedule';

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
}

/** Loop plans kept at a time (the loop playing and the next one). */
const MAX_CACHED_PLANS = 4;

/**
 * The music player (`MusicControl`). Live, a look-ahead clock wakes every `tickMs` and schedules
 * the notes that start within `aheadSec`; notes whose time has passed (the context was suspended
 * or the timer starved) are skipped, so nothing bursts after a resume. Offline, the whole stretch
 * is scheduled at `start`. Each tune gets its own output gain (the entry fade, the menu level and
 * the stop fade); voices are created per note only and released when they end.
 */
export class TunePlayer implements MusicControl {
  private readonly voices: MusicVoices;
  private readonly active = new Set<TimedSource>();
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
  private out: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly host: MusicHost,
    private readonly offline: OfflinePlan | null = null,
  ) {
    this.voices = new MusicVoices(host.ctx, host.tally, host.random);
  }

  start(options: MusicStartOptions): void {
    this.stop();
    const { ctx, tally } = this.host;
    const song = SONGS[options.variant] ?? SONGS[DEFAULT_MUSIC_VARIANT];
    const now = ctx.currentTime;
    this.song = song;
    this.layer = clampLayer(options.layer);
    this.menu = options.menu ?? false;
    this.seed = randomSeed(this.host.random);
    this.plans.clear();
    this.origin = now + MUSIC_PLAY.startLeadSec;
    this.scheduledTo = 0;
    this.levels = initialLevels(song, this.heardLayer());
    const only = this.offline?.only;
    if (only !== undefined) {
      this.levels = this.levels.map((level, i) => ({
        ...level,
        from: +(i === only),
        to: +(i === only),
      }));
    }
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.setTargetAtTime(this.outLevel(), now, MUSIC_PLAY.entryRampSec);
    out.connect(this.host.bus);
    tally.add([out]);
    this.out = out;
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
    const out = this.out;
    this.out = null;
    this.song = null;
    if (!out) return;
    const { ctx, tally } = this.host;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, MUSIC_PLAY.stopRampSec);
    const cut = now + MUSIC_PLAY.stopCutSec;
    for (const source of this.active) {
      try {
        source.stop(cut);
      } catch {
        // Already stopped.
      }
    }
    setTimeout(() => {
      out.disconnect();
      tally.release([out]);
    }, MUSIC_PLAY.stopCutSec * 2000);
  }

  setLayer(layer: number): void {
    this.layer = clampLayer(layer);
    this.retarget(this.host.ctx.currentTime);
  }

  setMenu(on: boolean): void {
    this.menu = on;
    this.retarget(this.host.ctx.currentTime);
  }

  /** Live voices of the tune now (diagnostics and tests). */
  get voiceCount(): number {
    return this.active.size;
  }

  /** The layer heard: the menu plays layer 1. */
  private heardLayer(): number {
    return this.menu ? 1 : this.layer;
  }

  private outLevel(): number {
    return MUSIC_PLAY.tuneLevel * (this.menu ? MUSIC_PLAY.menuLevel : 1);
  }

  /** Applies the layer and the menu level from context time `when` (the fades start on the next bar line). */
  private retarget(when: number): void {
    const { song, out } = this;
    if (!song || !out) return;
    const at = Math.max(when - this.origin, this.scheduledTo);
    this.levels = retargetLevels(song, this.levels, this.heardLayer(), at);
    out.gain.setTargetAtTime(this.outLevel(), when, MUSIC_PLAY.menuRampSec);
  }

  private readonly tick = (): void => {
    try {
      const now = this.host.ctx.currentTime - this.origin;
      this.scheduleUntil(Math.max(this.scheduledTo, now), now + MUSIC_PLAY.aheadSec);
    } catch {
      // A failing note must never break the game.
    }
  };

  /** Schedules the notes of [from, to) in song time. */
  private scheduleUntil(from: number, to: number): void {
    const { song, out } = this;
    if (!song || !out || to <= from) return;
    // Only the loops around now are ever asked for again.
    if (this.plans.size > MAX_CACHED_PLANS) this.plans.clear();
    for (const event of scheduleWindow(song, this.seed, this.levels, from, to, this.plans)) {
      this.playEvent(song, event, out);
    }
    this.scheduledTo = to;
  }

  private playEvent(song: Song, event: NoteEvent, out: GainNode): void {
    const part = song.parts[event.part];
    if (!part) return;
    // Live only: offline every voice of the stretch is scheduled before any of them has ended.
    if (!this.offline && this.active.size >= MUSIC_PLAY.maxVoices) return;
    const note = {
      time: this.origin + event.time,
      length: event.length,
      pitch: event.pitch,
      gain: event.gain,
    };
    const source = this.voices.play(part.instrument, note, out, () => this.active.delete(source));
    this.active.add(source);
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
