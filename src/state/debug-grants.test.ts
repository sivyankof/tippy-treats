import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../data/creatures';
import { MAX_BAKER_LEVEL } from '../data/progression';
import { withBakerLevelBumped, withCreaturesBumped } from './debug-grants';
import { createTestState } from './test-state';

describe('debug grants', () => {
  const save = createTestState().data;

  it('raises the baker level by one and resets the level XP', () => {
    const next = withBakerLevelBumped({ ...save, bakerLevel: 3, bakerXp: 77 });
    expect(next.bakerLevel).toBe(4);
    expect(next.bakerXp).toBe(0);
  });
  it('does not pass the max baker level', () => {
    expect(withBakerLevelBumped({ ...save, bakerLevel: MAX_BAKER_LEVEL }).bakerLevel).toBe(
      MAX_BAKER_LEVEL,
    );
  });
  it('raises owned creatures, caps them and unlocks the rest at level 1', () => {
    const first = CREATURE_IDS[0]!;
    const second = CREATURE_IDS[1]!;
    const next = withCreaturesBumped({
      ...save,
      creatures: { [first]: { level: 2 }, [second]: { level: MAX_CREATURE_LEVEL } },
    });
    expect(next.creatures[first]?.level).toBe(3);
    expect(next.creatures[second]?.level).toBe(MAX_CREATURE_LEVEL);
    for (const id of CREATURE_IDS.slice(2)) expect(next.creatures[id]?.level).toBe(1);
    expect(Object.keys(next.creatures)).toHaveLength(CREATURE_IDS.length);
  });
});
