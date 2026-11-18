import { describe, expect, it } from 'vitest';
import { MUSIC_PLAY } from '../../../data/music/music-play';
import type { Song } from '../../../data/music/song';
import { MUSIC_VARIANTS, SONGS } from '../../../data/music/songs';
import {
  clampLayer,
  initialLevels,
  crackleWindow,
  humanizeNote,
  levelAt,
  planLoop,
  retargetLevels,
  scheduleWindow,
  songTiming,
  swingStep,
  zoneLayer,
  type LoopPlan,
} from './music-schedule';

const ALL = MUSIC_VARIANTS.map((variant) => [variant, SONGS[variant]] as const);

function fullLevels(song: Song) {
  return initialLevels(song, MUSIC_PLAY.layers);
}

/** The song on the grid: no humanize, no lazy hits (the timing checks). */
function exact(song: Song): Song {
  return {
    ...song,
    humanize: { timeSec: 0, velocity: 0 },
    parts: song.parts.map((part) => ({ ...part, late: { chance: 0, sec: 0 } })),
  };
}

describe('planLoop', () => {
  const song = SONGS.a;

  it('plays the plain form first', () => {
    const plan = planLoop(song, 123, 0);
    expect(plan.fill).toBe(false);
    expect(plan.rest.every((rest) => rest === null)).toBe(true);
    expect(plan.picks.flat().every((pick) => pick === 0)).toBe(true);
  });

  it('is the same for the same seed and loop', () => {
    for (let loop = 1; loop < 20; loop++) {
      expect(planLoop(song, 77, loop)).toEqual(planLoop(song, 77, loop));
    }
  });

  it('varies over loops and seeds: alternatives, rests and fills all come up', () => {
    const seen = { alt: false, rest: false, fill: false, plain: false };
    const keys = new Set<string>();
    for (let loop = 1; loop < 40; loop++) {
      const plan = planLoop(song, 5, loop);
      keys.add(JSON.stringify(plan));
      if (plan.picks.flat().some((pick) => pick > 0)) seen.alt = true;
      if (plan.rest.some((rest) => rest !== null)) seen.rest = true;
      if (plan.fill) seen.fill = true;
      else seen.plain = true;
    }
    expect(seen).toEqual({ alt: true, rest: true, fill: true, plain: true });
    expect(keys.size).toBeGreaterThan(10);
    expect(planLoop(song, 5, 3)).not.toEqual(planLoop(song, 6, 3));
  });

  it('picks rests only among the rest bars of a part', () => {
    for (let loop = 1; loop < 50; loop++) {
      planLoop(song, 9, loop).rest.forEach((rest, p) => {
        if (rest !== null) expect(song.parts[p]?.restBars).toContain(rest);
      });
    }
  });
});

describe('scheduleWindow', () => {
  it.each(ALL)('%s: no event outside the window, events in time order', (_, song) => {
    const levels = fullLevels(song);
    const from = 3.217;
    const to = 9.5;
    const events = scheduleWindow(song, 4, levels, from, to);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.time).toBeGreaterThanOrEqual(from);
      expect(event.time).toBeLessThan(to);
    }
    const times = events.map((event) => event.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it.each(ALL)(
    '%s: a loose song (wide humanize, lazy hits) still adds up over windows',
    (_, base) => {
      const song: Song = {
        ...base,
        humanize: { timeSec: 0.12, velocity: 0.2 },
        parts: base.parts.map((part) => ({ ...part, late: { chance: 0.5, sec: 0.15 } })),
      };
      const levels = fullLevels(song);
      const end = songTiming(song).loopSec + 1;
      const whole = scheduleWindow(song, 5, levels, 0, end);
      const pieces = [];
      for (let t = 0; t < end; t += 0.05) {
        pieces.push(...scheduleWindow(song, 5, levels, t, Math.min(end, t + 0.05)));
      }
      expect(pieces).toEqual(whole);
    },
  );

  it.each(ALL)(
    '%s: small windows add up to one big window (nothing lost, nothing twice)',
    (_, song) => {
      const levels = fullLevels(song);
      const { loopSec } = songTiming(song);
      const end = loopSec * 2 + 1;
      const whole = scheduleWindow(song, 8, levels, 0, end);
      const pieces = [];
      for (let t = 0; t < end; t += MUSIC_PLAY.aheadSec) {
        pieces.push(...scheduleWindow(song, 8, levels, t, Math.min(end, t + MUSIC_PLAY.aheadSec)));
      }
      expect(pieces.length).toBe(whole.length);
    },
  );

  it.each(ALL)('%s: a cached plan gives the same events as a fresh one', (_, song) => {
    const levels = fullLevels(song);
    const { loopSec } = songTiming(song);
    const end = loopSec * 2 + 1;
    const cache = new Map<number, LoopPlan>();
    for (let t = 0; t < end; t += MUSIC_PLAY.aheadSec) {
      const to = Math.min(end, t + MUSIC_PLAY.aheadSec);
      expect(scheduleWindow(song, 8, levels, t, to, cache)).toEqual(
        scheduleWindow(song, 8, levels, t, to),
      );
    }
    expect(cache.size).toBeGreaterThan(0);
  });

  it.each(ALL)('%s: the loop seam lines up exactly with the loop length', (_, loose) => {
    const song = exact(loose);
    const levels = fullLevels(song);
    const { loopSec, barSec } = songTiming(song);
    const seed = 21;
    // Loop 0 and loop 1 both start with their first bar; loop 1 is later by exactly the loop length.
    const first = scheduleWindow(song, seed, levels, 0, barSec);
    const seam = scheduleWindow(song, seed, levels, loopSec - barSec, loopSec + barSec);
    const afterSeam = seam.filter((event) => event.time >= loopSec);
    const beforeSeam = seam.filter((event) => event.time < loopSec);
    expect(afterSeam.length).toBeGreaterThan(0);
    expect(beforeSeam.length).toBeGreaterThan(0);
    const offsets = (events: typeof first, origin: number) =>
      events.filter((e) => song.parts[e.part]?.layer === 1).map((e) => e.time - origin);
    // The lead of loop 1 starts on the loop line exactly as the lead of loop 0 starts on 0.
    const plan1 = planLoop(song, seed, 1);
    if (plan1.picks[0]?.[0] === 0) {
      expect(offsets(afterSeam, loopSec)[0]).toBeCloseTo(offsets(first, 0)[0] ?? NaN, 9);
    }
    // The last note before the seam starts in the last bar, the first after it on the loop line or later.
    expect(Math.max(...beforeSeam.map((e) => e.time))).toBeGreaterThanOrEqual(loopSec - barSec);
    expect(Math.min(...afterSeam.map((e) => e.time))).toBeCloseTo(loopSec, 9);
  });

  it('a part fading in grows note by note; a silent part plays nothing', () => {
    const song = SONGS.c;
    const { barSec } = songTiming(song);
    const start = initialLevels(song, 1);
    const silent = scheduleWindow(song, 3, start, 0, barSec * 2);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((event) => event.part === 0)).toBe(true);
    const levels = retargetLevels(song, start, 2, 0.3 * barSec);
    const kicks = scheduleWindow(exact(song), 3, levels, 0, barSec * 4).filter((e) => e.part === 1);
    // Fade from the next bar line over two bars: nothing in bar 0, rising gains in bars 1-2, full after.
    expect(kicks.every((e) => e.time >= barSec)).toBe(true);
    const fading = kicks.filter((e) => e.time < barSec * (1 + MUSIC_PLAY.fadeInBars));
    const full = kicks.filter((e) => e.time >= barSec * (1 + MUSIC_PLAY.fadeInBars));
    for (let i = 1; i < fading.length; i++) {
      const a = fading[i - 1];
      const b = fading[i];
      if (a && b) expect(b.gain / (b.gain + a.gain)).toBeGreaterThan(0.4);
    }
    const maxFading = Math.max(...fading.map((e) => e.gain / (song.parts[1]?.gain ?? 1)));
    const minFull = Math.min(...full.map((e) => e.gain / (song.parts[1]?.gain ?? 1)));
    expect(maxFading).toBeLessThan(1);
    expect(minFull).toBeGreaterThan(0.5);
  });

  it('a lone part never rests; with company it may', () => {
    const song = SONGS.a;
    const { barSec } = songTiming(song);
    const bass = song.parts.findIndex((part) => part.id === 'bass');
    // Find a loop and seed where the bass rests.
    let found: { seed: number; loop: number; bar: number } | null = null;
    for (let seed = 1; seed < 200 && !found; seed++) {
      for (let loop = 1; loop < 10 && !found; loop++) {
        const rest = planLoop(song, seed, loop).rest[bass];
        if (rest !== null && rest !== undefined) found = { seed, loop, bar: rest };
      }
    }
    expect(found).not.toBeNull();
    if (!found) return;
    const at = (found.loop * song.bars + found.bar) * barSec;
    const alone = song.parts.map((_, i) => {
      const on = i === bass ? 1 : 0;
      return { from: on, to: on, start: 0, end: 0 };
    });
    const lone = scheduleWindow(song, found.seed, alone, at, at + barSec);
    expect(lone.some((e) => e.part === bass)).toBe(true);
    const band = scheduleWindow(song, found.seed, fullLevels(song), at, at + barSec);
    expect(band.some((e) => e.part === bass)).toBe(false);
    expect(band.length).toBeGreaterThan(0);
  });
});

describe('swing and humanize', () => {
  it('swingStep keeps the beats, moves the second eighth to the swing share', () => {
    for (const step of [0, 4, 8, 12]) expect(swingStep(step, 4, 0.58)).toBeCloseTo(step, 9);
    expect(swingStep(2, 4, 0.58)).toBeCloseTo(2.32, 9);
    expect(swingStep(6, 4, 0.5)).toBeCloseTo(6, 9);
    // The sixteenths follow in order, inside their beat.
    const swung = [0, 1, 2, 3, 4].map((step) => swingStep(step, 4, 0.6));
    expect(swung).toEqual([...swung].sort((a, b) => a - b));
    expect(swung[3]).toBeLessThan(4);
  });

  it('humanizeNote stays within its spread, repeats for the same note and differs between notes', () => {
    const spec = { timeSec: 0.012, velocity: 0.1 };
    const shifts = new Set<number>();
    for (let n = 0; n < 200; n++) {
      const a = humanizeNote(7, 3, 1, n, spec);
      expect(Math.abs(a.shift)).toBeLessThanOrEqual(spec.timeSec);
      expect(Math.abs(a.velocity - 1)).toBeLessThanOrEqual(spec.velocity);
      expect(humanizeNote(7, 3, 1, n, spec)).toEqual(a);
      shifts.add(a.shift);
    }
    expect(shifts.size).toBeGreaterThan(190);
    const late = { chance: 1, sec: 0.02 };
    expect(humanizeNote(7, 3, 1, 0, spec, late).shift).toBeGreaterThan(0.02 - spec.timeSec - 1e-9);
  });
});

describe('crackleWindow', () => {
  it('is seeded, rare and adds up over windows', () => {
    const whole = crackleWindow(5, 0.8, 0.1, 0, 400);
    expect(whole.length).toBeGreaterThan(20);
    expect(whole.length).toBeLessThan(90);
    expect(crackleWindow(5, 0.8, 0.1, 0, 400)).toEqual(whole);
    const pieces = [];
    for (let t = 0; t < 400; t += 0.15) pieces.push(...crackleWindow(5, 0.8, 0.1, t, t + 0.15));
    expect(pieces).toEqual(whole);
    for (const hit of whole) {
      expect(hit.strength).toBeGreaterThanOrEqual(0);
      expect(hit.rate).toBeLessThan(1);
    }
    expect(crackleWindow(5, 0.8, 0, 0, 400)).toEqual([]);
  });
});

describe('levels', () => {
  const song = SONGS.b;
  const { barSec } = songTiming(song);

  it('starts with the parts of the layer on, the others off', () => {
    const levels = initialLevels(song, 3);
    expect(levels.map((level) => levelAt(level, 5))).toEqual([1, 1, 1, 1, 0, 0, 0]);
  });

  it('fades a joining part in from the next bar line over fadeInBars', () => {
    const levels = retargetLevels(song, initialLevels(song, 1), 2, barSec * 0.5);
    const part = levels[1];
    expect(part).toBeDefined();
    if (!part) return;
    expect(part.start).toBeCloseTo(barSec, 9);
    expect(part.end).toBeCloseTo(barSec * (1 + MUSIC_PLAY.fadeInBars), 9);
    expect(levelAt(part, barSec)).toBe(0);
    expect(levelAt(part, barSec * (1 + MUSIC_PLAY.fadeInBars / 2))).toBeCloseTo(0.5, 9);
    expect(levelAt(part, barSec * 10)).toBe(1);
    // Parts that stay keep their level.
    expect(levels[0]).toEqual(initialLevels(song, 1)[0]);
  });

  it('fades a leaving part out over fadeOutBars; a change on a bar line starts there', () => {
    const levels = retargetLevels(song, initialLevels(song, 6), 1, barSec * 4);
    const part = levels[6];
    expect(part?.start).toBeCloseTo(barSec * 4, 9);
    expect(part?.end).toBeCloseTo(barSec * (4 + MUSIC_PLAY.fadeOutBars), 9);
    expect(part?.to).toBe(0);
  });

  it('turning back mid-fade continues from the level reached', () => {
    const up = retargetLevels(song, initialLevels(song, 1), 2, 0);
    const halfway = barSec * (MUSIC_PLAY.fadeInBars / 2);
    const down = retargetLevels(song, up, 1, halfway);
    const part = down[1];
    expect(part?.from).toBeCloseTo(0.5, 9);
    expect(part?.to).toBe(0);
  });

  it('clamps layers to 1..6', () => {
    expect(clampLayer(0)).toBe(1);
    expect(clampLayer(9)).toBe(6);
    expect(clampLayer(Number.NaN)).toBe(1);
    expect(clampLayer(3.7)).toBe(3);
  });
});

describe('zoneLayer', () => {
  it('adds one layer per zone, Space stays at 6', () => {
    expect([0, 1, 2, 3, 4, 5].map((zone) => zoneLayer(zone, false))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(zoneLayer(7, false)).toBe(6);
  });

  it('leaves out layer 6 on the minimal effects level', () => {
    expect([0, 1, 2, 3, 4, 5].map((zone) => zoneLayer(zone, true))).toEqual([1, 2, 3, 4, 5, 5]);
  });
});
