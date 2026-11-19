import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC, MUSIC_TRACKS } from '../../../data/audio/music';
import { FakeGain } from './fake-nodes';
import { MediaPool, type MediaContext } from './media-pool';
import { StreamDeck, type DeckClock } from './tune-deck';

/** A media element whose clock the test moves. */
class FakeMedia {
  src = '';
  currentTime = 0;
  paused = true;
  preload = '';
  plays = 0;
  onended: (() => void) | null = null;
  play(): Promise<void> {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  removeAttribute(): void {
    this.src = '';
  }
  getAttribute(name: string): string | null {
    return name === 'src' && this.src ? this.src : null;
  }
  load(): void {}
}

const SPEC = MUSIC_TRACKS.menu;
const LENGTH = SPEC.frames / SPEC.sampleRate;

function setup() {
  const elements: FakeMedia[] = [];
  const ctx = {
    currentTime: 0,
    createGain: () => new FakeGain(),
    createMediaElementSource: () => new FakeGain(),
  };
  const pool = new MediaPool(
    ctx as unknown as MediaContext,
    () => {
      const el = new FakeMedia();
      elements.push(el);
      return el as unknown as HTMLMediaElement;
    },
    4,
  );
  const clock: DeckClock = {
    get currentTime() {
      return ctx.currentTime;
    },
    setTimeout: (call, ms) => setTimeout(call, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const deck = StreamDeck.open(
    ctx as unknown as BaseAudioContext,
    clock,
    pool,
    'menu',
    SPEC,
    '/menu.m4a',
    true,
  );
  /** Plays on: the context and every sounding element move `sec` forward. */
  const advance = async (sec: number): Promise<void> => {
    const step = 0.1;
    for (let t = 0; t < sec - 1e-9; t += step) {
      ctx.currentTime += step;
      for (const el of elements) if (!el.paused) el.currentTime += step;
      await vi.advanceTimersByTimeAsync(step * 1000);
    }
  };
  return { deck, pool, elements, advance };
}

describe('StreamDeck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the next pass from the beginning before the end and pauses the old one after the overlap', async () => {
    const { deck, elements, advance } = setup();
    if (!deck) throw new Error('no deck');
    await deck.start();
    const [a, b] = elements;
    expect(a?.paused).toBe(false);
    expect(b?.paused).toBe(true);
    await advance(LENGTH - MUSIC.loopOverlapSec - 0.5);
    expect(b?.paused).toBe(true);
    await advance(1);
    expect(b?.paused).toBe(false);
    expect(b?.currentTime).toBeLessThan(1);
    expect(a?.paused).toBe(false);
    await advance(MUSIC.loopOverlapSec + 0.2);
    expect(a?.paused).toBe(true);
    // And round again on the first element, one pass later.
    const bAt = b?.currentTime ?? 0;
    await advance(LENGTH - MUSIC.loopOverlapSec - bAt + 0.5);
    expect(a?.paused).toBe(false);
    expect(a?.currentTime).toBeLessThan(1);
  });

  it('in the playlist it plays once: no second pass, one element lent', async () => {
    const { pool, elements, advance } = setup();
    // The setup's looping deck holds two; a once-only deck takes one more.
    const once = StreamDeck.open(
      { currentTime: 0, createGain: () => new FakeGain() } as unknown as BaseAudioContext,
      { currentTime: 0, setTimeout: (c, ms) => setTimeout(c, ms), clearTimeout: () => undefined },
      pool,
      'menu',
      SPEC,
      '/menu.m4a',
      false,
    );
    expect(pool.free).toBe(1);
    if (!once) throw new Error('no deck');
    await once.start(12);
    const el = elements[2];
    expect(el?.src).toBe('/menu.m4a#t=12.000');
    if (el) el.currentTime = 12;
    await advance(LENGTH);
    expect(elements.filter((e) => !e.paused)).toHaveLength(1);
  });

  it('a once-only deck asked to go round once more loops one pass, and its seconds add up', async () => {
    const { pool, elements, advance } = setup();
    const once = StreamDeck.open(
      { currentTime: 0, createGain: () => new FakeGain() } as unknown as BaseAudioContext,
      { currentTime: 0, setTimeout: (c, ms) => setTimeout(c, ms), clearTimeout: () => undefined },
      pool,
      'menu',
      SPEC,
      '/menu.m4a',
      false,
    );
    if (!once) throw new Error('no deck');
    await once.start();
    expect(once.extend()).toBe(true);
    expect(pool.free).toBe(0);
    await advance(LENGTH + 1);
    // The second element took over from the start; the first one stopped after the overlap.
    const sounding = elements.slice(2).filter((e) => !e.paused);
    expect(sounding).toHaveLength(1);
    expect(once.played()).toBeGreaterThan(LENGTH - MUSIC.loopOverlapSec);
    // No more passes were asked: it does not loop again.
    await advance(LENGTH);
    expect(elements.slice(2).filter((e) => e.plays > 1)).toHaveLength(0);
  });

  it('an element preloaded with the file keeps it through the blessing and the start', async () => {
    const elements: FakeMedia[] = [];
    const preloaded = new FakeMedia();
    preloaded.src = '/menu.m4a';
    let made = 0;
    const ctx = {
      currentTime: 0,
      createGain: () => new FakeGain(),
      createMediaElementSource: () => new FakeGain(),
    };
    const pool = new MediaPool(
      ctx as unknown as MediaContext,
      () => {
        const el = made++ === 0 ? preloaded : new FakeMedia();
        elements.push(el);
        return el as unknown as HTMLMediaElement;
      },
      2,
    );
    pool.bless('/other.m4a');
    expect(preloaded.src).toBe('/menu.m4a');
    expect(elements[1]?.src).toBe('/other.m4a');
    const deck = StreamDeck.open(
      ctx as unknown as BaseAudioContext,
      { currentTime: 0, setTimeout: () => null, clearTimeout: () => undefined },
      pool,
      'menu',
      SPEC,
      '/menu.m4a',
      false,
    );
    let reloads = 0;
    Object.defineProperty(preloaded, 'src', {
      get: () => '/menu.m4a',
      set: () => {
        reloads += 1;
      },
    });
    await deck?.start(0);
    expect(reloads).toBe(0);
    expect(preloaded.paused).toBe(false);
  });

  it('an element whose load failed is loaded again', async () => {
    const { pool, elements } = setup();
    const failed = elements[2];
    if (!failed) throw new Error('no element');
    failed.src = '/menu.m4a';
    (failed as unknown as { error: unknown }).error = { code: 2 };
    const deck = StreamDeck.open(
      { currentTime: 0, createGain: () => new FakeGain() } as unknown as BaseAudioContext,
      { currentTime: 0, setTimeout: () => null, clearTimeout: () => undefined },
      pool,
      'menu',
      SPEC,
      '/menu.m4a',
      false,
    );
    let reloads = 0;
    Object.defineProperty(failed, 'src', {
      get: () => '/menu.m4a',
      set: () => {
        reloads += 1;
      },
    });
    await deck?.start(0);
    expect(reloads).toBe(1);
  });

  it('counts what it played from where it started', async () => {
    const { deck, elements, advance } = setup();
    if (!deck) throw new Error('no deck');
    await deck.start();
    await advance(5);
    expect(deck.played()).toBeCloseTo(5, 5);
    expect(elements[0]?.currentTime).toBeCloseTo(5, 5);
  });

  it('holds: sounding elements pause and come back, no pass is started meanwhile', async () => {
    const { deck, elements, advance } = setup();
    if (!deck) throw new Error('no deck');
    await deck.start();
    deck.hold(true);
    // The elements pause once the short hold fade is over.
    await advance(MUSIC.holdFadeSec + 0.1);
    expect(elements[0]?.paused).toBe(true);
    await advance(LENGTH);
    expect(elements[1]?.paused).toBe(true);
    deck.hold(false);
    expect(elements[0]?.paused).toBe(false);
  });

  it('gives its elements back to the pool when disposed', async () => {
    const { deck, pool, advance } = setup();
    if (!deck) throw new Error('no deck');
    expect(pool.free).toBe(2);
    await deck.start();
    deck.dispose(0.1);
    await advance(0.3);
    expect(pool.free).toBe(4);
  });

  it('is not made when the pool has no two free elements', () => {
    const { pool } = setup();
    expect(pool.acquire()).not.toBeNull();
    expect(pool.free).toBe(1);
    const ctx = { currentTime: 0, createGain: () => new FakeGain() };
    const clock: DeckClock = {
      currentTime: 0,
      setTimeout: () => null,
      clearTimeout: () => undefined,
    };
    const none = StreamDeck.open(
      ctx as unknown as BaseAudioContext,
      clock,
      pool,
      'menu',
      MUSIC_TRACKS.menu,
      '/menu.m4a',
      true,
    );
    expect(none).toBeNull();
    expect(pool.free).toBe(1);
  });
});
