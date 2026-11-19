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
    music.observe(false, false);
    expect(cues).toEqual([]);
    music.observe(true, true);
    music.observe(true, true);
    expect(cues).toEqual([{ kind: 'run', daily: true }]);
    expect(busy).toEqual([true]);
  });

  it('stays busy when the run is over until the HUD lets go', () => {
    const { music, busy } = make();
    music.observe(true, false);
    music.observe(false, false);
    expect(busy).toEqual([true]);
    music.end();
    expect(busy).toEqual([true, false]);
  });

  it('end without a run does nothing, and a second end too', () => {
    const { music, busy } = make();
    music.end();
    music.observe(true, false);
    music.end();
    music.end();
    expect(busy).toEqual([true, false]);
  });
});
