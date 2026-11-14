import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { ANIM } from '../../data/anim';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { LICK, type LickStyle } from '../../data/lick';
import {
  beatMs,
  beatStartMs,
  bigTip,
  chainLength,
  chainDistance,
  isAiming,
  lickAllowed,
  lickedDripShare,
  lickDurationMs,
  lickFace,
  lickFrame,
  lickGlaze,
  lickStyleFor,
  LickScheduler,
  loopShape,
  newLickFace,
  tongueBody,
  type LickCheck,
  type LickGlaze,
  type LickScene,
} from './lick-plan';

const ok: LickCheck = {
  faceFree: true,
  index: 3,
  topIndex: 9,
  aiming: false,
  y: 500,
  bandTop: 0,
  bandBottom: 1000,
};

const STYLES = Object.values(LICK.styles) as LickStyle[];
const PLAIN = LICK.styles.plain;
const STEP_MS = 5;
const POINTS = LICK.tongue.segments + 1;
const MOUTH_Y = LICK.loop.centerY + LICK.loop.ry;

function newGlaze(): LickGlaze {
  return { kind: 'none', x: 0, y: 0, squash: 1, scale: 1 };
}

/** Runs a scene and calls `visit` every few milliseconds. */
function play(
  scene: LickScene,
  style: LickStyle,
  visit: (t: number, frame: ReturnType<typeof lickFrame>) => void,
): void {
  for (let t = 0; t <= lickDurationMs(scene, style); t += STEP_MS) {
    visit(t, lickFrame(scene, t, style));
  }
}

describe('scene timing', () => {
  it('plays the big scene in 1.5 to 2 s and the short one in 0.6 to 0.8 s, in every style', () => {
    for (const style of STYLES) {
      expect(lickDurationMs('big', style)).toBeGreaterThanOrEqual(1500);
      expect(lickDurationMs('big', style)).toBeLessThanOrEqual(2000);
      expect(lickDurationMs('short', style)).toBeGreaterThanOrEqual(600);
      expect(lickDurationMs('short', style)).toBeLessThanOrEqual(800);
    }
  });

  it('holds the peak for 0.15 to 0.25 s and snaps back faster than it shot out', () => {
    for (const style of STYLES) {
      expect(beatMs('big', 'hold', style)).toBeGreaterThanOrEqual(150);
      expect(beatMs('big', 'hold', style)).toBeLessThanOrEqual(250);
      expect(beatMs('big', 'snap', style)).toBeLessThan(beatMs('big', 'shoot', style));
    }
  });

  it('goes through every beat in order and ends', () => {
    for (const scene of ['big', 'short'] as const) {
      const stages: string[] = [];
      play(scene, PLAIN, (_, f) => {
        if (stages[stages.length - 1] !== f.stage) stages.push(f.stage);
      });
      const last = lickFrame(scene, lickDurationMs(scene) + 1).stage;
      if (stages[stages.length - 1] !== last) stages.push(last);
      expect(stages).toEqual([...Object.keys(LICK[scene]), 'done']);
    }
  });
});

describe('the big scene', () => {
  const shape = loopShape(720, 1, 1);

  it('takes the tip round the whole face: both cheeks and over the brows', () => {
    const tip = { x: 0, y: 0 };
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    play('big', PLAIN, (_, f) => {
      if (f.stage !== 'shoot' && f.stage !== 'loop') return;
      bigTip(f, PLAIN, shape, tip);
      top = Math.min(top, tip.y);
      left = Math.min(left, tip.x);
      right = Math.max(right, tip.x);
    });
    const eyeOuter = ANIM.face.eyeSpacing / 2 + ANIM.face.eyeRadius;
    expect(top).toBeLessThan(ANIM.face.browOffsetY);
    expect(right).toBeGreaterThan(eyeOuter);
    expect(left).toBeLessThan(-eyeOuter);
  });

  it('goes the way of `dir` first: clockwise or counter-clockwise', () => {
    const tip = { x: 0, y: 0 };
    const atLoop = lickFrame('big', beatStartMs('big', 'loop') + 40);
    bigTip(atLoop, PLAIN, loopShape(720, 1, 1), tip);
    expect(tip.x).toBeGreaterThan(0);
    bigTip(atLoop, PLAIN, loopShape(720, 1, -1), tip);
    expect(tip.x).toBeLessThan(0);
  });

  it('keeps the tongue growing out of the mouth and longer than the face at its peak', () => {
    const points: number[] = [];
    play('big', PLAIN, (_, f) => {
      if (tongueBody('big', f, PLAIN, shape, points) <= 0) return;
      expect(points[0]).toBeCloseTo(0);
      expect(points[1]).toBeCloseTo(MOUTH_Y);
    });
    tongueBody('big', lickFrame('big', beatStartMs('big', 'hold') + 50), PLAIN, shape, points);
    expect(chainLength(points, POINTS)).toBeGreaterThan(2 * GLAZE_DRIPS.faceHalfWidth);
  });

  it('never makes the tongue longer than about half the layer width', () => {
    for (const width of [720, 600, 480]) {
      const s = loopShape(width, 1, -1);
      const points: number[] = [];
      let longest = 0;
      play('big', PLAIN, (_, f) => {
        if (tongueBody('big', f, PLAIN, s, points) > 0) {
          longest = Math.max(longest, chainLength(points, POINTS));
        }
      });
      // The bow and the wave add a little to the straight reach.
      expect(longest).toBeLessThanOrEqual((width / 2) * 1.15);
    }
  });

  it('shoots out with a smear and an overshoot, and is back in after the snap', () => {
    const points: number[] = [];
    const start = beatStartMs('big', 'shoot');
    expect(tongueBody('big', lickFrame('big', start), PLAIN, shape, points)).toBeLessThan(1);
    expect(
      tongueBody('big', lickFrame('big', beatStartMs('big', 'loop')), PLAIN, shape, points),
    ).toBe(1);
    const tip = { x: 0, y: 0 };
    let farthest = 0;
    for (let t = start; t < beatStartMs('big', 'loop'); t++) {
      bigTip(lickFrame('big', t), PLAIN, shape, tip);
      farthest = Math.max(farthest, tip.x);
    }
    bigTip(lickFrame('big', beatStartMs('big', 'loop')), PLAIN, shape, tip);
    expect(farthest).toBeGreaterThan(tip.x);
    expect(
      tongueBody('big', lickFrame('big', beatStartMs('big', 'lips')), PLAIN, shape, points),
    ).toBe(0);
  });

  it('licks up the drop as the tip passes it', () => {
    const g = newGlaze();
    for (const kind of ['run', 'fall'] as const) {
      lickGlaze('big', kind, PLAIN, shape, lickFrame('big', beatStartMs('big', 'windup')), -40, g);
      expect(g.kind).not.toBe('none');
      lickGlaze('big', kind, PLAIN, shape, lickFrame('big', beatStartMs('big', 'stretch')), -40, g);
      expect(g.kind).toBe('none');
    }
  });

  it('squeezes the face in the wind-up, shuts the eyes in bliss for the stroke and blushes at the end', () => {
    const face = newLickFace();
    lickFace('big', lickFrame('big', beatStartMs('big', 'windup') + 60), PLAIN, 1, face);
    expect(face.scaleY).toBeLessThan(1);
    expect(face.mouth).toBe('purse');
    lickFace('big', lickFrame('big', beatStartMs('big', 'loop') + 100), PLAIN, 1, face);
    expect(face).toMatchObject({ eyeL: 'bliss', eyeR: 'bliss', mouth: 'gape', dent: true });
    expect(face.brow).toBe(1);
    lickFace('big', lickFrame('big', beatStartMs('big', 'snap') + 30), PLAIN, 1, face);
    expect(face.puff).toBeGreaterThan(0);
    lickFace('big', lickFrame('big', beatStartMs('big', 'happy') + 80), PLAIN, 1, face);
    expect(face.blush).toBeGreaterThan(0.9);
  });

  it('lets brownie lick in one motion, out and back on its own side', () => {
    const brownie = LICK.styles.brownie;
    const s = loopShape(720, 1, 1, brownie);
    const tip = { x: 0, y: 0 };
    play('big', brownie, (_, f) => {
      if (f.stage !== 'shoot' && f.stage !== 'loop') return;
      bigTip(f, brownie, s, tip);
      expect(tip.x).toBeGreaterThanOrEqual(-1e-9);
    });
  });
});

describe('the short scene', () => {
  const shape = loopShape(720, 1, -1);

  it('squints the eye on the drop side and raises the other brow', () => {
    const face = newLickFace();
    lickFace('short', lickFrame('short', beatStartMs('short', 'out')), PLAIN, -1, face);
    expect(face.eyeL).toBe('shut');
    expect(face.eyeR).toBe('expr');
    expect(face.browSide).toBe(1);
  });

  it('takes the drop off the cheek in one stroke', () => {
    const g = newGlaze();
    lickGlaze(
      'short',
      'fall',
      PLAIN,
      shape,
      lickFrame('short', beatStartMs('short', 'out')),
      -30,
      g,
    );
    expect(g.kind).toBe('drop');
    expect(g.x).toBeLessThan(0);
    lickGlaze(
      'short',
      'fall',
      PLAIN,
      shape,
      lickFrame('short', beatStartMs('short', 'back')),
      -30,
      g,
    );
    expect(g.kind).toBe('none');
  });

  it('shows the tongue only from the stroke out to the way back', () => {
    const points: number[] = [];
    expect(tongueBody('short', lickFrame('short', 10), PLAIN, shape, points)).toBe(0);
    const out = beatStartMs('short', 'stroke') + 20;
    expect(tongueBody('short', lickFrame('short', out), PLAIN, shape, points)).toBeGreaterThan(0);
  });
});

describe('drips the tongue passes over', () => {
  const { shortenTo, shrinkMs, regrowMs } = LICK.drip;

  it('shrink quickly with a little spring, then regrow slowly to the whole length', () => {
    expect(lickedDripShare(Infinity)).toBe(1);
    expect(lickedDripShare(0)).toBe(1);
    let lowest = 1;
    for (let t = 0; t <= shrinkMs; t += 5) lowest = Math.min(lowest, lickedDripShare(t));
    expect(lowest).toBeLessThan(shortenTo);
    expect(lickedDripShare(shrinkMs)).toBeCloseTo(shortenTo);
    expect(lickedDripShare(shrinkMs + regrowMs / 2)).toBeCloseTo((1 + shortenTo) / 2);
    let last = 0;
    for (let t = shrinkMs; t <= shrinkMs + regrowMs; t += 100) {
      const share = lickedDripShare(t);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
    expect(lickedDripShare(shrinkMs + regrowMs)).toBe(1);
  });

  it('measures how close a drip is to the tongue', () => {
    const points = [0, 0, 10, 0, 20, 0];
    expect(chainDistance(points, 3, 5, 3)).toBeCloseTo(3);
    expect(chainDistance(points, 3, 25, 0)).toBeCloseTo(5);
  });
});

describe('styles', () => {
  it('gives honey, lemon and brownie their own way and the others the plain one', () => {
    expect(lickStyleFor('honey').tempo).toBeGreaterThan(1);
    expect(lickStyleFor('lemon').tempo).toBeLessThan(1);
    expect(lickStyleFor('lemon').wink).toBe(true);
    expect(lickStyleFor('brownie').sweep).toBeLessThan(1);
    expect(lickStyleFor('jelly')).toBe(PLAIN);
    expect(lickStyleFor(null)).toBe(PLAIN);
  });
});

describe('LickScheduler', () => {
  it('waits the first delay, then a whole interval between licks', () => {
    const rng = new Rng(7);
    const s = new LickScheduler(() => rng.next());
    expect(s.ready).toBe(false);
    s.tick(LICK.firstDelayMs[1]);
    expect(s.ready).toBe(true);
    s.started();
    expect(s.ready).toBe(false);
    s.tick(LICK.intervalMs[0] - 1);
    expect(s.ready).toBe(false);
    s.tick(LICK.intervalMs[1] - LICK.intervalMs[0] + 1);
    expect(s.ready).toBe(true);
  });

  it('plays the big scene first, then mostly the short one', () => {
    const rng = new Rng(11);
    const s = new LickScheduler(() => rng.next());
    expect(s.nextScene()).toBe('big');
    s.started();
    let big = 0;
    const tries = 400;
    for (let i = 0; i < tries; i++) if (s.nextScene() === 'big') big++;
    expect(big / tries).toBeGreaterThan(LICK.bigChance / 2);
    expect(big / tries).toBeLessThan(0.5);
  });

  it('looks again soon when there was nothing to lick', () => {
    const s = new LickScheduler(() => 0);
    s.tick(LICK.firstDelayMs[1]);
    s.retry();
    expect(s.ready).toBe(false);
    s.tick(LICK.retryMs);
    expect(s.ready).toBe(true);
  });

  it('gives the same intervals for the same seed', () => {
    const run = (seed: number): number[] => {
      const rng = new Rng(seed).fork('lick');
      const s = new LickScheduler(() => rng.next());
      const gaps: number[] = [];
      for (let i = 0; i < 4; i++) {
        let t = 0;
        while (!s.ready) {
          s.tick(100);
          t += 100;
        }
        gaps.push(t);
        s.started();
      }
      return gaps;
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });
});

describe('lickAllowed', () => {
  it('allows a free face on screen', () => {
    expect(lickAllowed(ok)).toBe(true);
  });

  it('refuses busy faces and layers near or past the screen edge', () => {
    expect(lickAllowed({ ...ok, faceFree: false })).toBe(false);
    expect(lickAllowed({ ...ok, y: LICK.screenMarginPx - 1 })).toBe(false);
    expect(lickAllowed({ ...ok, y: 1000 - LICK.screenMarginPx + 1 })).toBe(false);
  });

  it('keeps the top layer still while a layer is aimed, not the others', () => {
    expect(lickAllowed({ ...ok, index: 9, aiming: true })).toBe(false);
    expect(lickAllowed({ ...ok, index: 9, aiming: false })).toBe(true);
    expect(lickAllowed({ ...ok, index: 8, aiming: true })).toBe(true);
  });
});

describe('isAiming', () => {
  it('counts the flight, the fall and the spawn pause even when the flying layer is hidden', () => {
    expect(isAiming('flying', false)).toBe(true);
    expect(isAiming('pause', false)).toBe(true);
    expect(isAiming('falling', false)).toBe(true);
    expect(isAiming('await_continue', true)).toBe(true);
    expect(isAiming('await_continue', false)).toBe(false);
    expect(isAiming('over', false)).toBe(false);
  });
});
