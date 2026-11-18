import { describe, expect, it } from 'vitest';
import {
  MUSIC,
  MUSIC_PLAYLIST,
  MUSIC_TRACK_IDS,
  MUSIC_TRACKS,
  musicAskFor,
} from '../../../data/music';
import { trackUrl } from './tune-loader';
import { decodedBytes } from './tune-loop';

/** Context rates a phone or a desktop browser runs at. */
const RATES = [44_100, 48_000];

describe('music data', () => {
  it('every track has its file in assets/music', () => {
    // The build's list of assets/music files: null means the file is not there.
    for (const track of MUSIC_TRACK_IDS) expect(trackUrl(track)).not.toBeNull();
  });

  it('the playlist is the table of docs/06, the exceptions stay out of it', () => {
    expect(MUSIC_PLAYLIST).toEqual(['menu', 'kitchen', 'roof', 'stars', 'space', 'bartender']);
    expect(MUSIC_PLAYLIST).not.toContain('daily');
    expect(MUSIC_PLAYLIST).not.toContain('record');
    const once = MUSIC_TRACK_IDS.filter((id) => MUSIC_TRACKS[id].loop === 'overlap');
    expect(once).toEqual(['menu', 'bartender']);
  });

  it('the full Bartender is not in the game', () => {
    expect(MUSIC_TRACK_IDS.map((id) => MUSIC_TRACKS[id].file)).not.toContain(
      'showcase-bartender.m4a',
    );
  });
});

describe('musicAskFor', () => {
  it('the menus and a classic run ask for the playlist; zones are not even part of a cue', () => {
    expect(musicAskFor({ kind: 'menu' })).toEqual({ kind: 'playlist' });
    expect(musicAskFor({ kind: 'run', daily: false })).toEqual({ kind: 'playlist' });
  });

  it('the daily tower asks for its own track', () => {
    expect(musicAskFor({ kind: 'run', daily: true })).toEqual({ kind: 'track', track: 'daily' });
  });

  it('the results ask for the record track only for a new record, otherwise nothing', () => {
    expect(musicAskFor({ kind: 'results', record: true })).toEqual({
      kind: 'track',
      track: 'record',
    });
    expect(musicAskFor({ kind: 'results', record: false })).toBeNull();
  });
});

describe('music memory', () => {
  it('any two decoded tracks together stay under the cap (a change or a prefetch holds two)', () => {
    const decoded = MUSIC_TRACK_IDS.filter((id) => MUSIC_TRACKS[id].loop === 'seamless');
    for (const rate of RATES) {
      for (const a of decoded) {
        for (const b of decoded) {
          if (a === b) continue;
          const sum = decodedBytes(MUSIC_TRACKS[a], rate) + decodedBytes(MUSIC_TRACKS[b], rate);
          expect(sum).toBeLessThanOrEqual(MUSIC.memoryCapBytes);
        }
      }
    }
  });

  it('the long menu track would not fit decoded next to the roof track, so it is streamed', () => {
    const menu = decodedBytes(MUSIC_TRACKS.menu, 48_000);
    const roof = decodedBytes(MUSIC_TRACKS.roof, 48_000);
    expect(menu + roof).toBeGreaterThan(MUSIC.memoryCapBytes);
    expect(MUSIC_TRACKS.menu.loop).toBe('overlap');
  });
});
