import { describe, expect, it } from 'vitest';
import { SOUND_IDS } from './sound-book';
import { SOUND_TRIM_DB } from '../../data/audio/sound-trim';

describe('SOUND_TRIM_DB', () => {
  it('trims only sounds of the registry', () => {
    for (const id of Object.keys(SOUND_TRIM_DB)) {
      expect(SOUND_IDS as readonly string[]).toContain(id);
    }
  });

  it('keeps every trim within a sane range', () => {
    for (const db of Object.values(SOUND_TRIM_DB)) {
      expect(Math.abs(db)).toBeLessThanOrEqual(30);
    }
  });
});
