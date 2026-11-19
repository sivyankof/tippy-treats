import { describe, expect, it } from 'vitest';
import { recordCreaturesReached } from './record-unlocks';

describe('recordCreaturesReached', () => {
  it('hands over the twins from height 75 and skips owned creatures', () => {
    expect(recordCreaturesReached(74, () => false)).toEqual([]);
    expect(recordCreaturesReached(75, () => false)).toEqual(['twins']);
    expect(recordCreaturesReached(200, (id) => id === 'twins')).toEqual([]);
  });

  it('reads a given list instead of the live data', () => {
    expect(recordCreaturesReached(10, () => false, [{ id: 'honey', height: 10 }])).toEqual([
      'honey',
    ]);
  });
});
