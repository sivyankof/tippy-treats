import type { MusicCue } from '../../data/audio/music';

/**
 * The music of one run (made by the HUD, fed every frame): its first frame asks for the playlist
 * or the daily tower's track. From then until `end` the run counts as played, the pause window and
 * its 3-2-1 countdown and the "Continue?" window included, and the player decodes nothing (`busy`):
 * a decode's end stalls the main thread for a frame or two, which must not land on the countdown or
 * the first frames of play. The turn of the playlist grows by whole loops instead, and the next track
 * is decoded once the results are on show (or the HUD goes, when the run is left without results).
 * Not later: the HUD lives on under the results, and a decode let go by "Play again" would land in
 * the first frames of the next run. The pause window only ducks the music, like any window.
 */
export class RunMusic {
  private asked = false;
  private busy = false;

  constructor(
    private readonly cue: (cue: MusicCue) => void,
    private readonly setBusy: (on: boolean) => void,
  ) {}

  /**
   * `live`: the run is on screen (not over); `results`: the results screen is on show. Cheap: a few
   * checks, nothing else, every frame.
   */
  observe(live: boolean, daily: boolean, results: boolean): void {
    if (this.busy) {
      if (results) this.end();
      return;
    }
    if (!live || this.asked) return;
    this.busy = true;
    this.asked = true;
    this.cue({ kind: 'run', daily });
    this.setBusy(true);
  }

  /** The run's HUD goes away: the music may decode again. */
  end(): void {
    if (!this.busy) return;
    this.busy = false;
    this.setBusy(false);
  }
}
