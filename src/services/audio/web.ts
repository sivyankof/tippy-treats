import type { Rarity } from '../../data/creatures/rarity';
import type { BedKind } from '../../data/audio/weather-bed';
import { MS_PER_SECOND } from '../../util/math';
import { audioLog, errorText } from './audio-log';
import type { AudioStatus } from './audio-status';
import { BedPlayer } from './bed';
import type { DuckReason } from './mixer-math';
import { Mixer } from './mixer';
import {
  musicHostOf,
  NO_MUSIC_FACTORY,
  type MusicControl,
  type MusicFactory,
} from './music-control';
import { MusicProxy } from './music-proxy';
import { MusicWatchdog } from './music/music-watchdog';
import { MUSIC_WATCHDOG } from '../../data/audio/music-watchdog';
import type { SoundArgs, SoundId } from './sound-args';
import { SoundPlayer, type DevSoundTrims } from './sound-player';
import { Synth } from './synth';
import type {
  AudioDebugStats,
  AudioDevControl,
  AudioService,
  AudioSuspendReason,
  MusicDebugState,
} from './types';

/** Creates an audio context, or returns null when Web Audio is not available. */
export type AudioContextFactory = () => AudioContext | null;

interface WebAudioGlobals {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/** Default factory: the standard or the prefixed constructor, null when neither exists. */
export function createBrowserAudioContext(): AudioContext | null {
  const g = globalThis as WebAudioGlobals;
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Web Audio implementation of the sound and the music. The context is created on `unlock()` (a user
 * gesture); sounds requested before that, while disabled, hidden or without Web Audio are dropped.
 * Sounds come from the registry (`sound-book.ts`) through the voice gate; the named methods are
 * thin wrappers over `play`.
 */
export class WebAudioService implements AudioService, AudioDevControl {
  private on = true;
  private musicOn = true;
  private readonly holds = new Set<AudioSuspendReason>();
  private ctx: AudioContext | null = null;
  /** The graph could not be built: no more tries, the game plays on without sound. */
  private buildFailed = false;
  private mixer: Mixer | null = null;
  private player: SoundPlayer | null = null;
  private beds: BedPlayer | null = null;
  private bedKind: BedKind | null = null;
  private recordDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly musicProxy = new MusicProxy();
  /** Duck reasons held now; kept before the mixer exists so a window open at the first tap still ducks. */
  private readonly ducks = new Set<DuckReason>();
  /** The soundboard's per-sound corrections; shared with the player, which exists only after unlock. */
  private readonly devSoundTrims: DevSoundTrims = {};
  private devLevels: Partial<{ master: number; sfx: number; music: number }> = {};
  private readonly watchdog = new MusicWatchdog();
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  /** The music bus peak at the last watchdog look. */
  private lastLevel: number | null = null;
  /** When the watchdog last asked a stopped context to run (ms since the page start). */
  private lastResumeAskMs = Number.NEGATIVE_INFINITY;
  /** The context's clock when it was made; null once it has moved (a moved clock is never judged dead). */
  private clockAtMake: number | null = null;
  /** Since when a running, unheld context has kept its clock still at `clockAtMake`. */
  private clockStillSinceMs: number | null = null;
  private contextRemakes = 0;
  /** A dead context waits for the next tap to be made again (a browser). */
  private deadContext = false;
  private stateListener: (() => void) | null = null;

  constructor(
    private readonly createContext: AudioContextFactory = createBrowserAudioContext,
    private readonly random: () => number = Math.random,
    private readonly musicFactory: MusicFactory = NO_MUSIC_FACTORY,
    /** Told of every state of the music switch (the first track's preload starts or lets go). */
    private readonly onMusicSwitch: (on: boolean) => void = () => undefined,
    /**
     * A dead context may be made again at once, outside a gesture (the app: its media and audio
     * need none). A browser makes it again on the next tap.
     */
    private readonly remakeWithoutGesture = false,
  ) {}

  get enabled(): boolean {
    return this.on;
  }

  setEnabled(on: boolean): void {
    this.on = on;
    this.mixer?.setSfxOn(on);
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  setMusicEnabled(on: boolean): void {
    audioLog.add(`music switch ${on ? 'on' : 'off'}`);
    const was = this.musicOn;
    this.musicOn = on;
    this.onMusicSwitch(on);
    this.mixer?.setMusicOn(on);
    // Switched on again: a new player from scratch (new elements, nothing left of the old one).
    if (on && !was && this.mixer) this.rebuildMusic();
    this.musicProxy.setEnabled(on);
  }

  /** The music player is made again over the live mixer; the context is asked to run. */
  private rebuildMusic(): void {
    const { mixer } = this;
    if (!mixer) return;
    audioLog.add('music: new player');
    this.watchdog.reset();
    this.musicProxy.replace(this.musicFactory(musicHostOf(mixer)));
    if (this.holds.size === 0) this.run((ctx) => ctx.resume(), 'resume');
  }

  /**
   * Once per `MUSIC_WATCHDOG.checkMs`: a playlist that should be heard and has been silent for a
   * while starts again (`MusicWatchdog`); a context that does not run is only asked to run.
   */
  private watchMusic(): void {
    const { ctx, mixer } = this;
    if (!ctx || !mixer) return;
    const nowMs = audioLog.uptimeSec() * MS_PER_SECOND;
    if (this.clockFrozen(ctx, nowMs)) {
      if (this.remakeWithoutGesture) {
        this.remakeContext();
        return;
      }
      if (!this.deadContext) {
        this.deadContext = true;
        audioLog.add(
          `watchdog: context clock stands at ${ctx.currentTime.toFixed(2)}, made again at the next tap`,
        );
      }
    }
    let level: number;
    try {
      level = mixer.musicPeak();
    } catch {
      // No meter: the watchdog stays quiet.
      return;
    }
    this.lastLevel = level;
    const music = this.musicProxy.state();
    const wanted =
      this.musicProxy.asked()?.kind === 'playlist' &&
      mixer.musicBusOpen &&
      this.holds.size === 0 &&
      this.musicProxy.heldReasons().length === 0;
    if (wanted && ctx.state !== 'running') {
      // A stopped context leaves the meter on its last samples: it is only asked to run (no restart counted).
      this.watchdog.reset();
      if (nowMs - this.lastResumeAskMs < MUSIC_WATCHDOG.resumeEveryMs) return;
      this.lastResumeAskMs = nowMs;
      audioLog.add(`watchdog: playlist wanted, context ${ctx.state}, asked to run`);
      this.run((c) => c.resume(), 'resume');
      return;
    }
    const restart = this.watchdog.check({
      wanted,
      audible: level > MUSIC_WATCHDOG.audibleLevel,
      loading: music.loading,
      nowMs,
    });
    if (!restart) return;
    audioLog.add(`watchdog: playlist silent (${music.track ?? 'no track'}), started again`);
    this.musicProxy.restart();
  }

  /**
   * The context says it runs and nothing holds the sound, yet its clock has not moved once since it
   * was made, for `frozenClockMs` (a cold launch in the iOS simulator). A clock that ever moved is
   * never judged: a slow return from the background is not a dead context.
   */
  private clockFrozen(ctx: AudioContext, nowMs: number): boolean {
    if (this.clockAtMake === null) return false;
    if (ctx.currentTime !== this.clockAtMake) {
      this.clockAtMake = null;
      this.clockStillSinceMs = null;
      return false;
    }
    if (ctx.state !== 'running' || this.holds.size > 0) {
      this.clockStillSinceMs = null;
      return false;
    }
    this.clockStillSinceMs ??= nowMs;
    return (
      nowMs - this.clockStillSinceMs >= MUSIC_WATCHDOG.frozenClockMs &&
      this.contextRemakes < MUSIC_WATCHDOG.maxContextRemakes
    );
  }

  /**
   * A dead context is closed and the whole graph is made again: the music player is let go first
   * (the new one goes on from its place), then the context.
   */
  private remakeContext(): void {
    this.contextRemakes += 1;
    this.deadContext = false;
    audioLog.add(
      `watchdog: context clock stands at ${this.ctx?.currentTime.toFixed(2) ?? '-'}, context made again`,
    );
    this.musicProxy.letGo();
    this.dropGraph();
    this.watchdog.reset();
    this.lastLevel = null;
    this.unlock();
  }

  /** Forgets the graph and closes its context (nothing is made again here). */
  private dropGraph(): void {
    const ctx = this.ctx;
    if (ctx && this.stateListener) ctx.removeEventListener?.('statechange', this.stateListener);
    this.stateListener = null;
    this.ctx = null;
    this.mixer = null;
    this.player = null;
    this.beds = null;
    this.clockAtMake = null;
    this.clockStillSinceMs = null;
    try {
      ctx?.close().catch(() => undefined);
    } catch {
      // Ignore: the context may be closed already.
    }
  }

  setLevels(levels: Partial<{ master: number; sfx: number; music: number }>): void {
    this.devLevels = { ...this.devLevels, ...levels };
    this.mixer?.setDevScales(levels);
  }

  setSoundTrimDb(id: SoundId, db: number): void {
    this.devSoundTrims[id] = db;
  }

  musicState(): MusicDebugState {
    return { ...this.musicProxy.state(), asked: this.musicProxy.asked(), ducks: [...this.ducks] };
  }

  status(): AudioStatus {
    const music = this.musicProxy.state();
    const session = (globalThis.navigator as { audioSession?: { type?: string } } | undefined)
      ?.audioSession?.type;
    return {
      uptimeSec: audioLog.uptimeSec(),
      contextState: this.ctx?.state ?? 'none',
      contextTime: this.ctx ? this.ctx.currentTime : null,
      musicOn: this.musicOn,
      sfxOn: this.on,
      session: session ?? 'none',
      audioHolds: [...this.holds],
      musicHolds: this.musicProxy.heldReasons(),
      asked: this.musicProxy.asked(),
      track: music.track,
      playlist: music.playlist,
      decks: music.decks,
      loading: music.loading,
      level: this.lastLevel,
      restarts: this.watchdog.restarts,
    };
  }

  get music(): MusicControl {
    return this.musicProxy;
  }

  duckMusic(reason: DuckReason, on: boolean): void {
    if (on) this.ducks.add(reason);
    else this.ducks.delete(reason);
    this.mixer?.duckMusic(reason, on);
  }

  unlock(): void {
    if (this.deadContext && this.ctx) {
      // A tap: the dead context is made again inside it.
      this.remakeContext();
      return;
    }
    if (!this.ctx) {
      if (this.buildFailed) return;
      let ctx: AudioContext | null = null;
      try {
        ctx = this.createContext();
        if (!ctx) {
          audioLog.add('unlock: no Web Audio');
          return;
        }
        audioLog.add(
          `unlock: context made, ${ctx.state}, ${ctx.sampleRate} Hz, holds [${[...this.holds].join(',')}]`,
        );
        const made = ctx;
        const listener = (): void => audioLog.add(`context ${made.state}`);
        made.addEventListener?.('statechange', listener);
        const mixer = new Mixer(ctx);
        const synth = new Synth(ctx, mixer, this.random);
        this.ctx = ctx;
        this.stateListener = listener;
        this.clockAtMake = ctx.currentTime;
        this.mixer = mixer;
        this.player = new SoundPlayer(synth, undefined, this.devSoundTrims);
        this.beds = new BedPlayer(ctx, mixer, this.random);
        this.applyBed();
        if (!this.on) mixer.setSfxOn(false);
        if (!this.musicOn) mixer.setMusicOn(false);
        mixer.setDevScales(this.devLevels);
        for (const reason of this.ducks) mixer.duckMusic(reason, true);
        // `replace` lets the player of a remade context go and keeps the playlist's place.
        this.musicProxy.replace(this.musicFactory(musicHostOf(mixer)));
        this.watchTimer ??= setInterval(() => this.watchMusic(), MUSIC_WATCHDOG.checkMs);
      } catch (error) {
        audioLog.add(`unlock: graph failed, ${errorText(error)}`);
        // Sound stays off: do not leave a context behind or make another one on the next tap.
        this.buildFailed = true;
        this.musicProxy.letGo();
        this.ctx ??= ctx;
        this.dropGraph();
        return;
      }
    }
    if (this.holds.size === 0) {
      if (this.ctx?.state !== 'running')
        audioLog.add(`unlock: resume from ${this.ctx?.state ?? 'none'}`);
      this.run((ctx) => ctx.resume(), 'resume');
      this.kick();
    }
  }

  suspend(reason: AudioSuspendReason): void {
    audioLog.add(`suspend ${reason}, holds [${[...this.holds, reason].join(',')}]`);
    this.holds.add(reason);
    this.musicProxy.hold('app', true);
    this.run((ctx) => ctx.suspend(), 'suspend');
  }

  resume(reason: AudioSuspendReason): void {
    this.holds.delete(reason);
    audioLog.add(`resume ${reason}, holds [${[...this.holds].join(',')}]`);
    if (this.holds.size > 0) return;
    this.run((ctx) => ctx.resume(), 'resume');
    this.musicProxy.hold('app', false);
  }

  setBed(kind: BedKind | null): void {
    this.bedKind = kind;
    this.applyBed();
  }

  private applyBed(): void {
    try {
      this.beds?.set(this.bedKind);
    } catch {
      // A failing bed must never break the game.
    }
  }

  debugStats(): AudioDebugStats {
    return {
      liveNodes: this.mixer?.tally.live ?? 0,
      musicNodes: this.mixer?.musicTally.live ?? 0,
      contextState: this.ctx?.state ?? 'none',
    };
  }

  play<K extends SoundId>(id: K, ...args: SoundArgs[K]): void {
    if (!this.on || this.holds.size > 0 || !this.player) return;
    try {
      const result = this.player.play(id, args);
      if (result.played && result.ducksMusic) this.duckForLength(result.length);
    } catch {
      // A failing sound must never break the game.
    }
  }

  drop = (): void => this.play('drop');
  perfect = (comboStep: number): void => this.play('perfect', comboStep);
  bite = (): void => this.play('bite');
  coin = (): void => this.play('coin');
  berry = (): void => this.play('berry');
  ability = (rarity: Rarity): void => this.play('ability', rarity);
  rainbowChime = (): void => this.play('rainbowChime');
  rainbowJoke = (): void => this.play('rainbowJoke');
  cloudPuff = (): void => this.play('cloudPuff');
  shieldPop = (): void => this.play('shieldPop');
  sneeze = (): void => this.play('sneeze');
  miss = (): void => this.play('miss');
  collapseThud = (index: number): void => this.play('collapseThud', index);
  record = (): void => this.play('record');
  recordBlip = (): void => this.play('recordBlip');
  click = (): void => this.play('click');
  lickSlurp = (): void => this.play('lickSlurp');
  lickSlurpLong = (): void => this.play('lickSlurpLong');
  lickSmack = (): void => this.play('lickSmack');
  lickHum = (): void => this.play('lickHum');
  guestSplat = (): void => this.play('guestSplat');
  guestPeel = (): void => this.play('guestPeel');
  guestBuzz = (): void => this.play('guestBuzz');
  guestGiggle = (): void => this.play('guestGiggle');
  topperHop = (): void => this.play('topperHop');
  squeak = (pitch: number): void => this.play('squeak', pitch);

  /** The music stays turned down for `length` seconds (the record fanfare). */
  private duckForLength(length: number): void {
    if (this.recordDuckTimer !== null) clearTimeout(this.recordDuckTimer);
    this.duckMusic('record', true);
    this.recordDuckTimer = setTimeout(() => {
      this.recordDuckTimer = null;
      this.duckMusic('record', false);
    }, length * MS_PER_SECOND);
  }

  /** The silent unlock source, until the context runs; never throws. */
  private kick(): void {
    if (this.ctx?.state === 'running') return;
    try {
      this.mixer?.kick();
    } catch {
      // Not needed on a modern browser.
    }
  }

  /** Runs a context call; a sync error or a rejected promise is only logged. */
  private run(call: (ctx: AudioContext) => Promise<void>, what: string): void {
    if (!this.ctx) return;
    try {
      call(this.ctx).catch((error: unknown) =>
        audioLog.add(`${what} rejected: ${errorText(error)}`),
      );
    } catch (error) {
      audioLog.add(`${what} threw: ${errorText(error)}`);
    }
  }
}
