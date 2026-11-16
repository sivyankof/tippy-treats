import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../core/tower-sim';
import { MASTER_ANIM } from '../../data/master-anim';
import {
  badgeCentreX,
  captionLook,
  captionPlace,
  idleCaption,
  MasterFeed,
  noteCaption,
  stepCaption,
  type CaptionLook,
  type CaptionPlace,
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
    expect(seen).toEqual([
      { creature: 'ghost', coins: 0 },
      { creature: 'lemon', coins: 10 },
    ]);
    feed.drain((n) => seen.push({ ...n }));
    expect(seen).toHaveLength(2);
  });

  it('drops notes beyond its cap instead of growing', () => {
    const feed = new MasterFeed();
    for (let i = 0; i < 100; i++) feed.push('ghost', 0);
    let count = 0;
    feed.drain(() => count++);
    expect(count).toBe(16);
  });
});

describe('caption show', () => {
  it('runs in, hold, out and back to idle', () => {
    const s = idleCaption();
    expect(noteCaption(s, 5)).toBe(true);
    expect(s.phase).toBe('in');
    stepCaption(s, cfg.inMs);
    expect(s.phase).toBe('hold');
    stepCaption(s, cfg.holdMs);
    expect(s.phase).toBe('out');
    stepCaption(s, cfg.outMs);
    expect(s.phase).toBe('idle');
    expect(s.coins).toBe(0);
  });

  it('extends the hold and adds the coins on a repeat, without a second spark', () => {
    const s = idleCaption();
    noteCaption(s, 5);
    stepCaption(s, cfg.inMs + cfg.holdMs - 10);
    expect(noteCaption(s, 5)).toBe(false);
    expect(s.coins).toBe(10);
    stepCaption(s, cfg.holdMs - 10);
    expect(s.phase).toBe('hold');
  });

  it('restarts a fading caption with the new payout only', () => {
    const s = idleCaption();
    noteCaption(s, 5);
    stepCaption(s, cfg.inMs);
    stepCaption(s, cfg.holdMs);
    expect(s.phase).toBe('out');
    expect(noteCaption(s, 3)).toBe(true);
    expect(s.coins).toBe(3);
    expect(s.phase).toBe('in');
  });

  it('pops while it comes in and only fades on the plain level', () => {
    const s = idleCaption();
    noteCaption(s, 0);
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

describe('captionPlace', () => {
  const out: CaptionPlace = { left: 0, y: 0 };
  const width = 150;

  it('sits right of the last badge of the row', () => {
    captionPlace(1, 2, width, out);
    expect(out.y).toBe(468);
    expect(out.left).toBeGreaterThan(badgeCentreX(1));
  });

  it('goes under the row when another badge follows', () => {
    captionPlace(0, 2, width, out);
    expect(out.y).toBe(cfg.belowY);
  });

  it('goes under the row when it would run into the next creature indicator', () => {
    captionPlace(2, 3, 300, out);
    expect(out.y).toBe(cfg.belowY);
  });

  it('takes the first place when the creature has no badge and the row is empty', () => {
    captionPlace(-1, 0, width, out);
    expect(out).toEqual({ left: 24, y: 468 });
  });

  it('goes under the row when it has no badge and others stand in the row', () => {
    captionPlace(-1, 2, width, out);
    expect(out.y).toBe(cfg.belowY);
  });
});
