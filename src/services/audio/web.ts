import type { Rarity } from '../../data/creatures/rarity';
import type { BedKind } from '../../data/audio/weather-bed';
import { MS_PER_SECOND } from '../../util/math';
import { audioLog, errorText } from './audio-log';
import type { AudioStatus } from './audio-status';
import { BedPlayer } from './bed';
import { ContextHealth, type HealthStep } from './context-health';
import { CONTEXT_HEALTH } from '../../data/audio/context-health';
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
  /** Whether the context really runs (`context-health.ts`), looked at while it is suspect. */
  private readonly health = new ContextHealth();
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  /** Remakes the check did by itself (capped), and all remakes (the switches too). */
  private autoRemakes = 0;
  /** The clock of a context marked dead (a browser): if it moved by the next tap, it lives after all. */
  private deadClockSec = 0;
  /** The context went `interrupted`; its next state starts the check again. */
  private wasInterrupted = false;
  private remakes = 0;
  private resumeRejects = 0;
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
    const was = this.on;
    this.on = on;
    this.mixer?.setSfxOn(on);
    // Switched on again: the whole context is made again (the player's way to mend a silent one).
    if (on && !was && this.ctx) this.remakeContext('sound switch', false);
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
    // Switched on again: the whole context and a new player from scratch (the place is kept).
    if (on && !was && this.ctx) this.remakeContext('music switch', false);
    this.musicProxy.setEnabled(on);
  }

  /**
   * Once per `MUSIC_WATCHDOG.checkMs`: a playlist that should be heard and has been silent for a
   * while starts again (`MusicWatchdog`); a context that does not run is only asked to run.
   */
  private watchMusic(): void {
    const { ctx, mixer } = this;
    if (!ctx || !mixer) return;
    const nowMs = audioLog.uptimeSec() * MS_PER_SECOND;
    // A suspect context is the check's business; the watchdog waits until it is settled.
    if (this.health.isSuspect) return;
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
   * The context may not really run (made, back from the background, a refused resume,
   * `interrupted`): it is looked at every `CONTEXT_HEALTH.tickMs` until its clock is seen going.
   */
  private markSuspect(why: string): void {
    if (!this.ctx) return;
    audioLog.add(
      `check: context suspect (${why}), ${this.ctx.state} t=${this.ctx.currentTime.toFixed(2)}`,
    );
    this.health.suspectNow();
    this.healthTimer ??= setInterval(() => this.lookAtContext(), CONTEXT_HEALTH.tickMs);
  }

  private stopHealthTimer(): void {
    if (this.healthTimer !== null) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  /** One look of the check; a due step of the way back is taken here. */
  private lookAtContext(): void {
    const { ctx } = this;
    if (!ctx) {
      this.stopHealthTimer();
      return;
    }
    // An interruption (a call, Siri, an alarm) holds the sound like the background does.
    const held = this.holds.size > 0 || (ctx.state as string) === 'interrupted';
    const verdict = this.health.look({
      nowMs: audioLog.uptimeSec() * MS_PER_SECOND,
      clockSec: ctx.currentTime,
      held,
    });
    if (verdict.kind === 'alive') {
      audioLog.add(`check: clock going, ${ctx.state} t=${ctx.currentTime.toFixed(2)}`);
      // A context that came alive: the next return gets its remakes again, nothing is dead.
      this.autoRemakes = 0;
      this.deadContext = false;
      this.stopHealthTimer();
    } else if (held) {
      // Nothing to do while held; the return (resume) or the end of the interruption looks again.
      this.stopHealthTimer();
    } else if (verdict.kind === 'given-up') {
      audioLog.add('check: nothing more to try');
      this.stopHealthTimer();
    } else if (verdict.kind === 'step') {
      this.takeStep(ctx, verdict.step);
    } else if (verdict.kind === 'idle') {
      this.stopHealthTimer();
    }
  }

  private takeStep(ctx: AudioContext, step: HealthStep): void {
    audioLog.add(`check: clock stands at ${ctx.currentTime.toFixed(2)} (${ctx.state}), ${step}`);
    if (step === 'resume') {
      this.run((c) => c.resume(), 'resume', false);
    } else if (step === 'bounce') {
      // The resume only if nothing came to hold the sound meanwhile (the app went away again).
      const resumeIfFree = (c: AudioContext): Promise<void> =>
        this.ctx === c && this.holds.size === 0 ? c.resume() : Promise.resolve();
      this.run((c) => c.suspend().then(() => resumeIfFree(c)), 'suspend and resume', false);
    } else if (this.autoRemakes >= CONTEXT_HEALTH.maxRemakes) {
      audioLog.add('check: no remakes left');
    } else if (this.remakeWithoutGesture) {
      this.remakeContext('clock stands', true);
    } else {
      if (!this.deadContext) audioLog.add('check: context made again at the next tap');
      this.deadContext = true;
      this.deadClockSec = ctx.currentTime;
    }
  }

  /**
   * The context is closed and the whole graph is made again: the music player is let go first
   * (the new one goes on from its place), then the context. The switches, levels, ducks, the bed
   * and the holds carry over (they live in the service).
   */
  private remakeContext(why: string, automatic: boolean): void {
    if (automatic) this.autoRemakes += 1;
    this.remakes += 1;
    this.deadContext = false;
    audioLog.add(
      `context made again (${why}), was ${this.ctx?.state ?? 'none'} t=${this.ctx?.currentTime.toFixed(2) ?? '-'}`,
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
    this.health.forget();
    this.stopHealthTimer();
    this.wasInterrupted = false;
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
      clockRunning: this.health.running,
      resumeRejects: this.resumeRejects,
      remakes: this.remakes,
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
      if (this.ctx.currentTime !== this.deadClockSec) {
        // Its clock moved after all: it lives.
        this.deadContext = false;
      } else {
        // A tap: the dead context is made again inside it (it counts like any automatic remake).
        this.remakeContext('tap', true);
        return;
      }
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
        const listener = (): void => {
          audioLog.add(`context ${made.state}`);
          const state = made.state as string;
          if (state === 'interrupted') {
            this.wasInterrupted = true;
            this.markSuspect('interrupted');
          } else if (this.wasInterrupted) {
            this.wasInterrupted = false;
            this.markSuspect('after an interruption');
          }
        };
        made.addEventListener?.('statechange', listener);
        const mixer = new Mixer(ctx);
        const synth = new Synth(ctx, mixer, this.random);
        this.ctx = ctx;
        this.stateListener = listener;
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
        this.markSuspect('made');
        // Made while the sound is held (a switch turned in silent mode, during an ad): held too.
        if (this.holds.size > 0) this.run((c) => c.suspend(), 'suspend');
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
    // Back (from the background, an ad, silent mode): whether the context runs is checked, not taken on trust.
    this.markSuspect(`back from ${reason}`);
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

  /**
   * Runs a context call; a sync error or a rejected promise is logged. A refused resume is counted,
   * and (unless the check itself asked, `checkOnRefusal` false) makes the context suspect.
   */
  private run(
    call: (ctx: AudioContext) => Promise<void>,
    what: string,
    checkOnRefusal = true,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const refused = (error: unknown, verb: string): void => {
      audioLog.add(`${what} ${verb}: ${errorText(error)}`);
      if (!what.includes('resume')) return;
      this.resumeRejects += 1;
      // A check under way goes on with its steps (a tap's resume must not set it back to the start).
      if (checkOnRefusal && this.ctx === ctx && !this.health.isSuspect) {
        this.markSuspect('resume refused');
      }
    };
    try {
      call(ctx).catch((error: unknown) => refused(error, 'rejected'));
    } catch (error) {
      refused(error, 'threw');
    }
  }
}
