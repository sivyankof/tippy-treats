import { describe, expect, it } from 'vitest';
import { CREATURE_MATERIALS, type CreatureMaterial } from '../../data/creature-materials';
import { idleBurstOn, materialShape, type Shape } from './material-shape';

const still = { timeMs: 0, swayShare: 0, phase: 0, shiverLeft: 0 };
const quarter = (periodMs: number) => periodMs / 4;

function shapeOf(material: CreatureMaterial, input: Partial<typeof still>): Shape {
  return materialShape(material, { ...still, ...input }, { scaleX: 0, scaleY: 0 });
}

describe('materialShape', () => {
  it('keeps a plain material at rest', () => {
    const plain: CreatureMaterial = { land: { squash: 1, durationMul: 1, ease: 'Linear' } };
    expect(shapeOf(plain, { timeMs: 123, swayShare: 1, shiverLeft: 1 })).toEqual({
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('makes the jelly jiggle more the more the tower sways', () => {
    const jelly = CREATURE_MATERIALS.jelly;
    const sway = jelly.sway;
    if (!sway) throw new Error('jelly has a sway');
    const idle = jelly.idle;
    if (!idle) throw new Error('jelly has an idle motion');
    // At a quarter of the sway period the sway wave peaks; the idle wave adds its own part.
    const t = quarter(sway.periodMs);
    const calm = shapeOf(jelly, { timeMs: t, swayShare: 0 });
    const wild = shapeOf(jelly, { timeMs: t, swayShare: 1 });
    expect(wild.scaleY).toBeCloseTo(calm.scaleY - sway.y, 10);
    expect(wild.scaleX).toBeCloseTo(calm.scaleX + sway.x, 10);
  });

  it('lets the puff breathe: both scales grow together', () => {
    const idle = CREATURE_MATERIALS.puff.idle;
    if (!idle) throw new Error('puff has an idle motion');
    const shape = shapeOf(CREATURE_MATERIALS.puff, { timeMs: quarter(idle.periodMs) });
    expect(shape.scaleX).toBeCloseTo(1 + idle.x, 10);
    expect(shape.scaleY).toBeCloseTo(1 + idle.y, 10);
  });

  it('fades the landing shiver with the share left', () => {
    const shiver = CREATURE_MATERIALS.lemon.landShiver;
    if (!shiver) throw new Error('lemon has a landing shiver');
    const t = quarter(shiver.periodMs);
    const full = shapeOf(CREATURE_MATERIALS.lemon, { timeMs: t, shiverLeft: 1 });
    const half = shapeOf(CREATURE_MATERIALS.lemon, { timeMs: t, shiverLeft: 0.5 });
    expect(full.scaleY).toBeCloseTo(1 - shiver.y, 10);
    expect(half.scaleY).toBeCloseTo(1 - shiver.y / 2, 10);
    expect(shapeOf(CREATURE_MATERIALS.lemon, { timeMs: t })).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it('keeps every material motion small', () => {
    for (const material of Object.values(CREATURE_MATERIALS)) {
      for (let t = 0; t < 5000; t += 37) {
        const shape = shapeOf(material, { timeMs: t, swayShare: 1, shiverLeft: 1 });
        expect(Math.abs(shape.scaleX - 1)).toBeLessThan(0.05);
        expect(Math.abs(shape.scaleY - 1)).toBeLessThan(0.1);
      }
    }
  });
});

describe('idleBurstOn', () => {
  const burst = { onMs: 300, everyMs: 4000 };

  it('runs for the first onMs of every period', () => {
    expect(idleBurstOn(burst, 0, 0)).toBe(true);
    expect(idleBurstOn(burst, 299, 0)).toBe(true);
    expect(idleBurstOn(burst, 300, 0)).toBe(false);
    expect(idleBurstOn(burst, 4100, 0)).toBe(true);
  });

  it('is shifted by the phase', () => {
    // Half a turn moves the burst by half the period.
    expect(idleBurstOn(burst, 2000, Math.PI)).toBe(true);
    expect(idleBurstOn(burst, 0, Math.PI)).toBe(false);
  });
});
