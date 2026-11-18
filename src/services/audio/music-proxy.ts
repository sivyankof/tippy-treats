import { NO_MUSIC, type MusicControl, type MusicStartOptions } from './music-control';

/**
 * The `AudioService.music` the game holds from the start. It remembers what the game asked
 * (tune, layer, menu) and hands it to the real player once there is one (the audio is unlocked)
 * and the music is on; while the music is off the real player is stopped. Calls never throw.
 */
export class MusicProxy implements MusicControl {
  private real: MusicControl = NO_MUSIC;
  private enabled = true;
  private options: MusicStartOptions | null = null;
  private layer: number | null = null;
  private menu: boolean | null = null;

  /** Gives the proxy its player and brings it up to date with what was asked. */
  attach(real: MusicControl): void {
    this.real = real;
    if (this.enabled) this.replay();
  }

  /** The music switch: off stops the player, on restarts it with the remembered state. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.replay();
    else this.safely(() => this.real.stop());
  }

  start(options: MusicStartOptions): void {
    this.options = options;
    this.layer = options.layer;
    this.menu = options.menu ?? null;
    if (this.enabled) this.safely(() => this.real.start(options));
  }

  stop(): void {
    this.options = null;
    if (this.enabled) this.safely(() => this.real.stop());
  }

  setLayer(layer: number): void {
    this.layer = layer;
    if (this.enabled) this.safely(() => this.real.setLayer(layer));
  }

  setMenu(on: boolean): void {
    this.menu = on;
    if (this.enabled) this.safely(() => this.real.setMenu(on));
  }

  /** What the game asked last: the tune (null when stopped), the layer and the menu switch. */
  get asked(): { options: MusicStartOptions | null; layer: number | null; menu: boolean | null } {
    return { options: this.options, layer: this.layer, menu: this.menu };
  }

  private replay(): void {
    const { options, layer, menu } = this;
    if (!options) return;
    this.safely(() => {
      this.real.start({ ...options, layer: layer ?? options.layer, menu: menu ?? options.menu });
    });
  }

  private safely(call: () => void): void {
    try {
      call();
    } catch {
      // A failing player must never break the game.
    }
  }
}
