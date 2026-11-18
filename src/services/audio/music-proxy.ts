import type { MusicTrackId } from '../../data/music';
import { NO_MUSIC, type MusicControl, type MusicPlayerState } from './music-control';

/**
 * The `AudioService.music` the game holds from the start. It remembers the track the game asked
 * for and whether the audio is held, and hands both to the real player once there is one (the
 * audio is unlocked) and the music is on; while the music is off the real player is stopped.
 * Calls never throw.
 */
export class MusicProxy implements MusicControl {
  private real: MusicControl = NO_MUSIC;
  private enabled = true;
  private track: MusicTrackId | null = null;
  private held = false;

  /** Gives the proxy its player and brings it up to date with what was asked. */
  attach(real: MusicControl): void {
    this.real = real;
    if (this.held) this.safely(() => this.real.hold(true));
    if (this.enabled) this.replay();
  }

  /** The music switch: off stops the player, on plays the remembered track again. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.replay();
    else this.safely(() => this.real.stop());
  }

  play(track: MusicTrackId): void {
    this.track = track;
    if (this.enabled) this.safely(() => this.real.play(track));
  }

  stop(): void {
    this.track = null;
    if (this.enabled) this.safely(() => this.real.stop());
  }

  hold(on: boolean): void {
    this.held = on;
    this.safely(() => this.real.hold(on));
  }

  state(): MusicPlayerState {
    try {
      return this.real.state();
    } catch {
      return NO_MUSIC.state();
    }
  }

  resetPeak(): void {
    this.safely(() => this.real.resetPeak());
  }

  /** The track the game asked for last (null when stopped or never asked). */
  get asked(): MusicTrackId | null {
    return this.track;
  }

  private replay(): void {
    const { track } = this;
    if (track) this.safely(() => this.real.play(track));
  }

  private safely(call: () => void): void {
    try {
      call();
    } catch {
      // A failing player must never break the game.
    }
  }
}
