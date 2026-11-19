import { describe, expect, it } from 'vitest';
import { tempoChipX, wobbleCentreX } from './tempo-chip-layout';

describe('tempoChipX', () => {
  it('docks the chip a gap to the right of the plate', () => {
    expect(tempoChipX(800, 100, 10)).toBe(860);
  });
});

describe('wobbleCentreX', () => {
  it('keeps the plate centred when the chip fits', () => {
    expect(wobbleCentreX(1080, 400, 100, 10, 16)).toBe(540);
  });

  it('moves the row left so the chip ends at the margin', () => {
    const centre = wobbleCentreX(1080, 900, 100, 10, 16);
    expect(centre).toBe(504);
    const plateRight = centre + 450;
    expect(tempoChipX(plateRight, 100, 10) + 50).toBe(1080 - 16);
  });
});
