import { describe, expect, it } from 'vitest';
import { CameraKick } from './camera-kick';

describe('CameraKick', () => {
  it('is idle until kicked', () => {
    const kick = new CameraKick();
    kick.update(16);
    expect(kick.offset).toBe(0);
  });

  it('pushes out and back along a sine arc', () => {
    const kick = new CameraKick();
    kick.kick(6, 100);
    expect(kick.offset).toBeCloseTo(0, 10);
    kick.update(50);
    expect(kick.offset).toBeCloseTo(6, 10);
    kick.update(25);
    expect(kick.offset).toBeCloseTo(6 * Math.sin(Math.PI * 0.75), 10);
    kick.update(25);
    expect(kick.offset).toBe(0);
  });

  it('supports upward bumps and restarts on a new kick', () => {
    const kick = new CameraKick();
    kick.kick(-4, 90);
    kick.update(45);
    expect(kick.offset).toBeCloseTo(-4, 10);
    kick.kick(6, 90);
    expect(kick.offset).toBeCloseTo(0, 10);
  });

  it('stays at rest after the end however long the frame was', () => {
    const kick = new CameraKick();
    kick.kick(6, 90);
    kick.update(5000);
    expect(kick.offset).toBe(0);
    kick.update(16);
    expect(kick.offset).toBe(0);
  });
});
