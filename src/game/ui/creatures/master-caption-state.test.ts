import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../../core/tower/tower-sim';
import { MASTER_ANIM } from '../../../data/creatures/master-anim';
import {
  captionLook,
  endCaption,
  idleCaption,
  MasterFeed,
  noteCaption,
  stepCaption,
  type CaptionLook,
  type MasterNote,
} from './master-caption-state';

const cfg = MASTER_ANIM.caption;
const linear = (t: number): number => t;
const mastery = (creature: 'ghost' | 'lemon', coins: number): SimEvent => ({
  type: 'mastery',
  creature,
  coins,
  score: 0,
});

describe('MasterFeed', () => {
  it('keeps only mastery events and empties after a drain', () => {
    const feed = new MasterFeed();
    feed.take([mastery('ghost', 0), { type: 'miss', shielded: false }, mastery('lemon', 10)]);
    const seen: MasterNote[] = [];
    feed.drain((n) => seen.push({ ...n }));
    expect(seen).toEqual([{ creature: 'ghost' }, { creature: 'lemon' }]);
    feed.drain((n) => seen.push({ ...n }));
    expect(seen).toHaveLength(2);
  });

  it('drops notes beyond its cap instead of growing', () => {
    const feed = new MasterFeed();
    for (let i = 0; i < 100; i++) feed.push('ghost');
    let count = 0;
    feed.drain(() => count++);
    expect(count).toBe(16);
  });
});

describe('caption show', () => {
  it('runs in, hold, out and back to idle', () => {
    const s = idleCaption();
    expect(noteCaption(s)).toBe(true);
    expect(s.phase).toBe('in');
    stepCaption(s, cfg.inMs);
    expect(s.phase).toBe('hold');
    stepCaption(s, cfg.holdMs);
    expect(s.phase).toBe('out');
    stepCaption(s, cfg.outMs);
    expect(s.phase).toBe('idle');
  });

  it('extends the hold on a repeat, without a second spark', () => {
    const s = idleCaption();
    noteCaption(s);
    stepCaption(s, cfg.inMs + cfg.holdMs - 10);
    expect(noteCaption(s)).toBe(false);
    stepCaption(s, cfg.holdMs - 10);
    expect(s.phase).toBe('hold');
  });

  it('restarts a fading caption', () => {
    const s = idleCaption();
    noteCaption(s);
    stepCaption(s, cfg.inMs);
    stepCaption(s, cfg.holdMs);
    expect(s.phase).toBe('out');
    expect(noteCaption(s)).toBe(true);
    expect(s.phase).toBe('in');
  });

  it('pops while it comes in and only fades on the plain level', () => {
    const s = idleCaption();
    noteCaption(s);
    const look: CaptionLook = { scale: 0, alpha: 0 };
    stepCaption(s, cfg.inMs / 2);
    captionLook(s, false, linear, look);
    expect(look.scale).toBeGreaterThan(cfg.fromScale);
    expect(look.scale).toBeLessThan(1);
    captionLook(s, true, linear, look);
    expect(look.scale).toBe(1);
    expect(look.alpha).toBeCloseTo(0.5);
  });
});

describe('one caption at a time', () => {
  it('ends a caption at once', () => {
    const s = idleCaption();
    noteCaption(s);
    endCaption(s);
    expect(s.phase).toBe('idle');
    expect(noteCaption(s)).toBe(true);
  });

  it('lasts about 1.2 seconds', () => {
    expect(cfg.inMs + cfg.holdMs + cfg.outMs).toBe(1200);
  });
});
