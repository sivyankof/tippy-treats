import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC, MUSIC_TRACKS } from '../../../data/music';
import { MediaPool, type MediaContext } from './media-pool';
import { StreamDeck, type DeckClock } from './tune-deck';

class FakeParam {
  value = 0;
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
  }
}

class FakeGain {
  gain = new FakeParam();
  connect(): void {}
  disconnect(): void {}
}

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
  load(): void {}
}

const SPEC = MUSIC_TRACKS.showcase;
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
    'showcase',
    SPEC,
    '/showcase.m4a',
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

  it('holds: sounding elements pause and come back, no pass is started meanwhile', async () => {
    const { deck, elements, advance } = setup();
    if (!deck) throw new Error('no deck');
    await deck.start();
    deck.hold(true);
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
    );
    expect(none).toBeNull();
    expect(pool.free).toBe(1);
  });
});
