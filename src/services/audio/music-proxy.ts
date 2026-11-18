import type { MusicAsk, MusicTrackId } from '../../data/music';
import {
  NO_MUSIC,
  type MusicControl,
  type MusicHoldReason,
  type MusicPlayerState,
} from './music-control';

/**
 * The `AudioService.music` the game holds from the start. It remembers what the game asked last
 * (the playlist or a track) and the hold reasons, and hands them to the real player once there is
 * one (the audio is unlocked) and the music is on; while the music is off the real player is
 * stopped. Calls never throw.
 */
export class MusicProxy implements MusicControl {
  private real: MusicControl = NO_MUSIC;
  private enabled = true;
  private ask: MusicAsk | null = null;
  private readonly holds = new Set<MusicHoldReason>();
  private isBusy = false;

  /** Gives the proxy its player and brings it up to date with what was asked. */
  attach(real: MusicControl): void {
    this.real = real;
    for (const reason of this.holds) this.safely(() => this.real.hold(reason, true));
    if (this.isBusy) this.safely(() => this.real.busy(true));
    if (this.enabled) this.replay();
  }

  /** The music switch: off stops the player, on plays what was asked again. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.replay();
    else this.safely(() => this.real.stop());
  }

  playlist(): void {
    this.ask = { kind: 'playlist' };
    if (this.enabled) this.safely(() => this.real.playlist());
  }

  play(track: MusicTrackId): void {
    this.ask = { kind: 'track', track };
    if (this.enabled) this.safely(() => this.real.play(track));
  }

  next(): void {
    this.ask = { kind: 'playlist' };
    if (this.enabled) this.safely(() => this.real.next());
  }

  prepare(track: MusicTrackId | null): void {
    if (this.enabled) this.safely(() => this.real.prepare(track));
  }

  stop(): void {
    this.ask = null;
    if (this.enabled) this.safely(() => this.real.stop());
  }

  hold(reason: MusicHoldReason, on: boolean): void {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    this.safely(() => this.real.hold(reason, on));
  }

  busy(on: boolean): void {
    this.isBusy = on;
    this.safely(() => this.real.busy(on));
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

  /** What the game asked for last (null when stopped or never asked), whether the music is on or not. */
  asked(): MusicAsk | null {
    return this.ask;
  }

  private replay(): void {
    const { ask } = this;
    if (!ask) return;
    if (ask.kind === 'playlist') this.safely(() => this.real.playlist());
    else this.safely(() => this.real.play(ask.track));
  }

  private safely(call: () => void): void {
    try {
      call();
    } catch {
      // A failing player must never break the game.
    }
  }
}
