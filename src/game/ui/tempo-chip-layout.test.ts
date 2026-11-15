import { describe, expect, it } from 'vitest';
import { tempoChipX } from './tempo-chip-layout';

describe('tempoChipX', () => {
  it('docks the chip to the right of the plate', () => {
    expect(tempoChipX(800, 100, 10, 1080, 16)).toBe(860);
  });

  it('keeps the chip inside the screen margin', () => {
    expect(tempoChipX(1000, 100, 10, 1080, 16)).toBe(1014);
  });
});
