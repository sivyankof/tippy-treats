import { describe, expect, it } from 'vitest';
import type { MusicCue } from '../../data/audio/music';
import { RunMusic } from './run-music';

function make() {
  const cues: MusicCue[] = [];
  const busy: boolean[] = [];
  const music = new RunMusic(
    (cue) => cues.push(cue),
    (on) => busy.push(on),
  );
  return { music, cues, busy };
}

describe('RunMusic', () => {
  it('asks once on the first live frame and goes busy', () => {
    const { music, cues, busy } = make();
    music.observe(false, false, false);
    expect(cues).toEqual([]);
    music.observe(true, true, false);
    music.observe(true, true, false);
    expect(cues).toEqual([{ kind: 'run', daily: true }]);
    expect(busy).toEqual([true]);
  });

  it('stays busy when the run is over until the HUD lets go', () => {
    const { music, busy } = make();
    music.observe(true, false, false);
    music.observe(false, false, false);
    expect(busy).toEqual([true]);
    music.end();
    expect(busy).toEqual([true, false]);
  });

  it('end without a run does nothing, and a second end too', () => {
    const { music, busy } = make();
    music.end();
    music.observe(true, false, false);
    music.end();
    music.end();
    expect(busy).toEqual([true, false]);
  });

  it('lets go once the results are on show, before the HUD goes ("Play again" must not decode into the next run)', () => {
    const { music, cues, busy } = make();
    music.observe(true, false, false);
    music.observe(false, false, false);
    expect(busy).toEqual([true]);
    music.observe(false, false, true);
    expect(busy).toEqual([true, false]);
    // The HUD lives on under the results: neither the results nor its end make it busy or ask again.
    music.observe(false, false, true);
    music.observe(true, false, false);
    music.end();
    expect(busy).toEqual([true, false]);
    expect(cues).toHaveLength(1);
  });
});
