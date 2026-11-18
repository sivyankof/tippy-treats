import { describe, expect, it } from 'vitest';
import { trackUrl } from './tune-loader';
import { decodedBytes } from './tune-loop';
import {
  MUSIC,
  MUSIC_PLACES,
  MUSIC_TRACK_IDS,
  MUSIC_TRACKS,
  musicTrackFor,
  type MusicPlace,
} from '../../../data/music';
import { ZONES } from '../../../data/zones';

/** Context rates a phone or a desktop browser runs at. */
const RATES = [44_100, 48_000];

describe('music places', () => {
  it('every place has a track whose file is in assets/music', () => {
    for (const place of Object.keys(MUSIC_PLACES) as MusicPlace[]) {
      // The build's list of assets/music files: null means the file is not there.
      expect(trackUrl(MUSIC_PLACES[place])).not.toBeNull();
    }
  });

  it('every zone of the game has a place', () => {
    for (const zone of ZONES) expect(MUSIC_PLACES[zone.id]).toBeDefined();
  });

  it('follows the table of docs/06', () => {
    expect(MUSIC_PLACES).toEqual({
      menu: 'menu',
      kitchen: 'kitchen',
      showcase: 'showcase',
      roof: 'roof',
      clouds: 'roof',
      stars: 'stars',
      space: 'space',
      daily: 'daily',
      record: 'record',
    });
    const overlap = MUSIC_TRACK_IDS.filter((id) => MUSIC_TRACKS[id].loop === 'overlap');
    expect(overlap).toEqual(['menu', 'showcase']);
    expect(MUSIC_TRACKS.showcase.gainDb).toBe(-1);
  });
});

describe('musicTrackFor', () => {
  it('a classic run plays the track of its zone', () => {
    expect(musicTrackFor({ kind: 'run', zone: 'kitchen', daily: false })).toBe('kitchen');
    expect(musicTrackFor({ kind: 'run', zone: 'showcase', daily: false })).toBe('showcase');
    expect(musicTrackFor({ kind: 'run', zone: 'roof', daily: false })).toBe('roof');
    expect(musicTrackFor({ kind: 'run', zone: 'clouds', daily: false })).toBe('roof');
    expect(musicTrackFor({ kind: 'run', zone: 'stars', daily: false })).toBe('stars');
    expect(musicTrackFor({ kind: 'run', zone: 'space', daily: false })).toBe('space');
  });

  it('the daily tower plays one track whatever the zone', () => {
    for (const zone of ZONES) {
      expect(musicTrackFor({ kind: 'run', zone: zone.id, daily: true })).toBe('daily');
    }
  });

  it('the menus play the menu track', () => {
    expect(musicTrackFor({ kind: 'menu' })).toBe('menu');
  });

  it('the results play the record track only for a new record, otherwise keep the music', () => {
    expect(musicTrackFor({ kind: 'results', record: true })).toBe('record');
    expect(musicTrackFor({ kind: 'results', record: false })).toBeNull();
  });
});

describe('music memory', () => {
  it('any two decoded tracks together stay under the cap (a change holds two)', () => {
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

  it('the long tracks would not fit decoded, so they are streamed', () => {
    const showcase = decodedBytes(MUSIC_TRACKS.showcase, 48_000);
    const roof = decodedBytes(MUSIC_TRACKS.roof, 48_000);
    expect(showcase + roof).toBeGreaterThan(MUSIC.memoryCapBytes);
    expect(MUSIC_TRACKS.showcase.loop).toBe('overlap');
  });
});
