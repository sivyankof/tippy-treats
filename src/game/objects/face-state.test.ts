import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { CREATURE_LOOKS } from '../../data/creature-looks';
import {
  FaceState,
  aimMouth,
  moodForWobble,
  resolveExpression,
  type Mood,
  type Reaction,
} from './face-state';

const [BLINK_MIN, BLINK_MAX] = ANIM.face.blinkIntervalMs;

/** A random source that returns the given values in turn and then repeats the last. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

describe('moodForWobble', () => {
  it('is calm up to the nervous threshold', () => {
    expect(moodForWobble(0)).toBe('calm');
    expect(moodForWobble(ANIM.wobble.nervousFrom)).toBe('calm');
  });

  it('is nervous above the nervous threshold up to the danger one', () => {
    expect(moodForWobble(ANIM.wobble.nervousFrom + 0.01)).toBe('nervous');
    expect(moodForWobble(ANIM.wobble.dangerFrom)).toBe('nervous');
  });

  it('is scared above the danger threshold', () => {
    expect(moodForWobble(ANIM.wobble.dangerFrom + 0.01)).toBe('scared');
    expect(moodForWobble(100)).toBe('scared');
  });
});

describe('aimMouth', () => {
  const width = 200;
  const grin = ANIM.flying.grinShare * width;
  const edge = ANIM.flying.edgeShare * width;

  it('grins when aimed well, on either side', () => {
    expect(aimMouth(0, width)).toBe('open');
    expect(aimMouth(grin, width)).toBe('open');
    expect(aimMouth(-grin, width)).toBe('open');
  });

  it('smiles between the grin and the edge', () => {
    expect(aimMouth(grin + 0.5, width)).toBe('smile');
    expect(aimMouth(-(edge - 0.5), width)).toBe('smile');
  });

  it('goes `o` near the edge and beyond', () => {
    expect(aimMouth(edge, width)).toBe('o');
    expect(aimMouth(-edge, width)).toBe('o');
    expect(aimMouth(width * 3, width)).toBe('o');
  });

  it('smiles when the width is unknown', () => {
    expect(aimMouth(10, 0)).toBe('smile');
  });
});

describe('resolveExpression', () => {
  const moods: Mood[] = ['calm', 'nervous', 'scared'];
  const reactions: Reaction[] = ['blink', 'joy', 'ouch', 'squint', 'horror'];

  it('shows the plain mood without a reaction', () => {
    expect(resolveExpression('calm', null)).toEqual({
      eyes: 'open',
      mouth: 'smile',
      brows: false,
      ownBrows: false,
      lids: false,
      sweat: false,
    });
    expect(resolveExpression('nervous', null)).toEqual({
      eyes: 'open',
      mouth: 'flat',
      brows: false,
      ownBrows: false,
      lids: false,
      sweat: false,
    });
    expect(resolveExpression('scared', null)).toEqual({
      eyes: 'open',
      mouth: 'scared',
      brows: false,
      ownBrows: false,
      lids: false,
      sweat: true,
    });
  });

  it('lets the mouth hint replace the calm mouth only', () => {
    expect(resolveExpression('calm', null, 'yum').mouth).toBe('yum');
    expect(resolveExpression('calm', null, 'open').mouth).toBe('open');
    expect(resolveExpression('nervous', null, 'yum').mouth).toBe('flat');
    expect(resolveExpression('scared', null, 'yum').mouth).toBe('scared');
  });

  it('blink and squint only close the eyes', () => {
    for (const reaction of ['blink', 'squint'] as const) {
      for (const mood of moods) {
        expect(resolveExpression(mood, reaction)).toEqual({
          ...resolveExpression(mood, null),
          eyes: 'closed',
        });
      }
    }
    expect(resolveExpression('calm', 'squint', 'open').mouth).toBe('open');
  });

  it('joy is happy eyes and a smile whatever the mood', () => {
    for (const mood of moods) {
      expect(resolveExpression(mood, 'joy', 'o')).toEqual({
        eyes: 'happy',
        mouth: 'smile',
        brows: false,
        ownBrows: false,
        lids: false,
        sweat: false,
      });
    }
  });

  it('ouch raises the brows and opens an `o` with open eyes', () => {
    for (const mood of moods) {
      const e = resolveExpression(mood, 'ouch');
      expect(e.eyes).toBe('open');
      expect(e.mouth).toBe('o');
      expect(e.brows).toBe(true);
    }
  });

  it('horror is wide eyes, a scared mouth, brows and sweat whatever the mood', () => {
    for (const mood of moods) {
      expect(resolveExpression(mood, 'horror', 'yum')).toEqual({
        eyes: 'wide',
        mouth: 'scared',
        brows: true,
        ownBrows: false,
        lids: false,
        sweat: true,
      });
    }
  });

  it('every reaction differs from the calm face', () => {
    const calm = resolveExpression('calm', null);
    for (const reaction of reactions) {
      expect(resolveExpression('calm', reaction)).not.toEqual(calm);
    }
  });
});

describe('resolveExpression for a creature face', () => {
  const honey = CREATURE_LOOKS.honey.face;
  const crumb = CREATURE_LOOKS.crumb.face;
  const twins = CREATURE_LOOKS.twins.face;

  it('always shows the creature brows, in its own pose when calm', () => {
    const e = resolveExpression('calm', null, undefined, crumb);
    expect(e.brows).toBe(true);
    expect(e.ownBrows).toBe(true);
    expect(e.mouth).toBe('yum');
  });

  it('the default mouth replaces the plain smile only', () => {
    expect(resolveExpression('calm', null, undefined, twins).mouth).toBe('flat');
    expect(resolveExpression('calm', null, 'smile', twins).mouth).toBe('flat');
    expect(resolveExpression('calm', null, 'open', twins).mouth).toBe('open');
    expect(resolveExpression('calm', null, 'o', crumb).mouth).toBe('o');
  });

  it('worried moods keep their mouth; nervous brows stay own, scared ones turn worried', () => {
    expect(resolveExpression('nervous', null, 'open', crumb)).toMatchObject({
      mouth: 'flat',
      brows: true,
      ownBrows: true,
    });
    expect(resolveExpression('scared', null, 'open', crumb)).toMatchObject({
      mouth: 'scared',
      brows: true,
      ownBrows: false,
    });
  });

  it('sleepy creatures show lids only on a calm open-eyed face', () => {
    expect(resolveExpression('calm', null, undefined, honey).lids).toBe(true);
    expect(resolveExpression('calm', null, undefined, crumb).lids).toBe(false);
    expect(resolveExpression('nervous', null, undefined, honey).lids).toBe(false);
    for (const reaction of ['blink', 'squint', 'ouch', 'horror'] as const) {
      expect(resolveExpression('calm', reaction, undefined, honey).lids).toBe(false);
    }
  });

  it('reactions work over the creature face', () => {
    expect(resolveExpression('calm', 'joy', undefined, honey)).toMatchObject({
      eyes: 'happy',
      mouth: 'smile',
      brows: true,
      ownBrows: true,
    });
    expect(resolveExpression('calm', 'ouch', undefined, honey)).toMatchObject({
      eyes: 'open',
      mouth: 'o',
      brows: true,
      ownBrows: false,
    });
    expect(resolveExpression('calm', 'horror', undefined, honey)).toMatchObject({
      eyes: 'wide',
      mouth: 'scared',
      ownBrows: false,
    });
    expect(resolveExpression('calm', 'blink', undefined, honey).eyes).toBe('closed');
  });

  it('every creature calm face differs from the plain one', () => {
    const plain = resolveExpression('calm', null);
    for (const look of Object.values(CREATURE_LOOKS)) {
      expect(resolveExpression('calm', null, undefined, look.face)).not.toEqual(plain);
    }
  });
});

describe('FaceState reactions', () => {
  // random() = 0.5 puts the idle blink in the middle of the interval: never within these tests.
  const quiet = (): FaceState => new FaceState(() => 0.5);

  it('has no reaction at first', () => {
    expect(quiet().reaction()).toBeNull();
  });

  it('holds a reaction for its time, then drops it', () => {
    const face = quiet();
    face.react('joy', 300);
    expect(face.reaction()).toBe('joy');
    face.update(299);
    expect(face.reaction()).toBe('joy');
    face.update(2);
    expect(face.reaction()).toBeNull();
  });

  it('a stronger reaction replaces a weaker one', () => {
    const face = quiet();
    face.react('joy', 1000);
    face.react('ouch', 100);
    expect(face.reaction()).toBe('ouch');
    face.update(150);
    // The weaker one was replaced, not suspended.
    expect(face.reaction()).toBeNull();
  });

  it('a weaker reaction does not replace a stronger one', () => {
    const face = quiet();
    face.react('horror', 500);
    face.react('joy', 1000);
    face.react('blink', 1000);
    expect(face.reaction()).toBe('horror');
    face.update(600);
    expect(face.reaction()).toBeNull();
  });

  it('keeps the strict order blink < joy < ouch < squint < horror', () => {
    const order: Reaction[] = ['blink', 'joy', 'ouch', 'squint', 'horror'];
    for (let low = 0; low < order.length; low++) {
      for (let high = 0; high < order.length; high++) {
        const face = quiet();
        face.react(order[low]!, 1000);
        face.react(order[high]!, 1000);
        expect(face.reaction()).toBe(high >= low ? order[high] : order[low]);
      }
    }
  });

  it('the same reaction again restarts its time', () => {
    const face = quiet();
    face.react('ouch', 400);
    face.update(300);
    face.react('ouch', 400);
    face.update(300);
    expect(face.reaction()).toBe('ouch');
    face.update(150);
    expect(face.reaction()).toBeNull();
  });

  it('holds an infinite reaction until cleared', () => {
    const face = quiet();
    face.react('squint', Infinity);
    face.update(1000);
    expect(face.reaction()).toBe('squint');
    face.clearReaction();
    expect(face.reaction()).toBeNull();
  });

  it('a cleared high-priority reaction no longer blocks weaker ones', () => {
    const face = quiet();
    face.react('horror', Infinity);
    face.clearReaction();
    face.react('joy', 100);
    expect(face.reaction()).toBe('joy');
  });

  it('ignores a reaction without time', () => {
    const face = quiet();
    face.react('joy', 0);
    face.react('joy', -5);
    face.react('joy', Number.NaN);
    expect(face.reaction()).toBeNull();
  });

  it('reset drops the reaction', () => {
    const face = quiet();
    face.react('horror', Infinity);
    face.reset();
    expect(face.reaction()).toBeNull();
  });
});

describe('FaceState blinking', () => {
  const blinkMs = ANIM.face.blinkMs;

  it('blinks after the scheduled pause for the blink duration', () => {
    const face = new FaceState(() => 0); // shortest pause
    face.update(BLINK_MIN - 1);
    expect(face.reaction()).toBeNull();
    face.update(1);
    expect(face.reaction()).toBe('blink');
    face.update(blinkMs - 1);
    expect(face.reaction()).toBe('blink');
    face.update(1);
    expect(face.reaction()).toBeNull();
  });

  it('uses the injected random to pick the pause', () => {
    const face = new FaceState(() => 1); // longest pause
    face.update(BLINK_MAX - 1);
    expect(face.reaction()).toBeNull();
    face.update(1);
    expect(face.reaction()).toBe('blink');
  });

  it('schedules the next blink from a new random draw', () => {
    const face = new FaceState(sequence(0, 1));
    face.update(BLINK_MIN);
    expect(face.reaction()).toBe('blink');
    face.update(blinkMs);
    expect(face.reaction()).toBeNull();
    face.update(BLINK_MAX - 1);
    expect(face.reaction()).toBeNull();
    face.update(1);
    expect(face.reaction()).toBe('blink');
  });

  it('blinks again and again', () => {
    const face = new FaceState(() => 0);
    let blinks = 0;
    let was: Reaction | null = null;
    for (let t = 0; t < 20_000; t += 10) {
      face.update(10);
      const now = face.reaction();
      if (now === 'blink' && was !== 'blink') blinks++;
      was = now;
    }
    expect(blinks).toBeGreaterThanOrEqual(Math.floor(20_000 / (BLINK_MIN + blinkMs)) - 1);
  });

  it('a real reaction is shown over an idle blink and the blink goes on behind it', () => {
    const face = new FaceState(() => 0);
    face.update(BLINK_MIN);
    expect(face.reaction()).toBe('blink');
    face.react('joy', 10_000);
    expect(face.reaction()).toBe('joy');
    face.update(blinkMs);
    expect(face.reaction()).toBe('joy');
    face.clearReaction();
    expect(face.reaction()).toBeNull();
  });

  it('reset cancels a running blink and re-randomises the timer', () => {
    const draws = sequence(0, 1);
    const face = new FaceState(draws);
    face.update(BLINK_MIN);
    expect(face.reaction()).toBe('blink');
    face.reset();
    expect(face.reaction()).toBeNull();
    face.update(BLINK_MAX - 1);
    expect(face.reaction()).toBeNull();
    face.update(1);
    expect(face.reaction()).toBe('blink');
  });
});
