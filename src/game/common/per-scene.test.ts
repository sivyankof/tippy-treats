import { describe, expect, it } from 'vitest';
import { PerScene } from './per-scene';

/** A scene stand-in: Phaser reuses the same scene object on every start, so does this one. */
class FakeScene {
  private listeners: Array<() => void> = [];
  get listenerCount(): number {
    return this.listeners.length;
  }
  onShutdown(fn: () => void): void {
    this.listeners.push(fn);
  }
  shutdown(): void {
    const fns = this.listeners;
    this.listeners = [];
    for (const fn of fns) fn();
  }
}

/** A thing with parts that something else may destroy behind its back (a strip on the update list). */
class Thing {
  destroyed = false;
  partsAlive = true;
  constructor(readonly id: number) {}
  destroy(): void {
    this.destroyed = true;
    this.partsAlive = false;
  }
}

function holder(opts: { usableFresh?: boolean } = {}): {
  per: PerScene<FakeScene, Thing>;
  made: Thing[];
} {
  const made: Thing[] = [];
  const per = new PerScene<FakeScene, Thing>({
    make: () => {
      const t = new Thing(made.length);
      if (opts.usableFresh === false) t.partsAlive = false;
      made.push(t);
      return t;
    },
    usable: (t) => !t.destroyed && t.partsAlive,
    onShutdown: (scene, fn) => scene.onShutdown(fn),
  });
  return { per, made };
}

describe('PerScene', () => {
  it('makes the object once and hands the same one out while the scene runs', () => {
    const { per, made } = holder();
    const scene = new FakeScene();
    const a = per.get(scene);
    expect(per.get(scene)).toBe(a);
    expect(made).toHaveLength(1);
  });

  it('destroys the object when the scene shuts down and makes a new one on the next start', () => {
    const { per, made } = holder();
    const scene = new FakeScene();
    const first = per.get(scene)!;
    scene.shutdown();
    expect(first.destroyed).toBe(true);
    const second = per.get(scene);
    expect(second).not.toBe(first);
    expect(made).toHaveLength(2);
  });

  it('never hands out an object prepared in a run that was stopped before it was used', () => {
    // The tester's crash: the tongue prepared for a run with no lick outlived the scene's shutdown,
    // its strips did not, and the next run on the same scene object got it back.
    const { per } = holder();
    const scene = new FakeScene();
    const prepared = per.get(scene)!;
    prepared.partsAlive = false; // the shutdown destroyed the strips, not the holder
    scene.shutdown();
    const next = per.get(scene)!;
    expect(next).not.toBe(prepared);
    expect(next.partsAlive).toBe(true);
  });

  it('replaces an object whose parts were destroyed while the scene runs', () => {
    const { per } = holder();
    const scene = new FakeScene();
    const first = per.get(scene)!;
    first.partsAlive = false;
    const second = per.get(scene)!;
    expect(second).not.toBe(first);
    expect(first.destroyed).toBe(true);
  });

  it('keeps separate objects for separate scenes', () => {
    const { per } = holder();
    const a = new FakeScene();
    const b = new FakeScene();
    const ta = per.get(a)!;
    expect(per.get(b)).not.toBe(ta);
    b.shutdown();
    expect(ta.destroyed).toBe(false);
    expect(per.get(a)).toBe(ta);
  });

  it('gives null, not a broken object, when even a fresh one is not usable', () => {
    const { per, made } = holder({ usableFresh: false });
    const scene = new FakeScene();
    expect(per.get(scene)).toBeNull();
    expect(made[0]!.destroyed).toBe(true);
  });

  it('a shutdown listener of a replaced object does not drop its successor', () => {
    const { per } = holder();
    const scene = new FakeScene();
    const first = per.get(scene)!;
    first.partsAlive = false;
    const second = per.get(scene)!;
    // Both listeners fire on the shutdown; the successor is destroyed by its own one.
    scene.shutdown();
    expect(second.destroyed).toBe(true);
    expect(per.get(scene)).not.toBe(second);
  });

  it('registers one shutdown listener per scene start, however many objects are made', () => {
    const { per } = holder();
    const scene = new FakeScene();
    const first = per.get(scene)!;
    first.partsAlive = false;
    per.get(scene);
    expect(scene.listenerCount).toBe(1);
    scene.shutdown();
    per.get(scene);
    expect(scene.listenerCount).toBe(1);
  });

  it('does not rebuild an unusable object again in the same start, but tries on the next one', () => {
    const { per, made } = holder({ usableFresh: false });
    const scene = new FakeScene();
    expect(per.get(scene)).toBeNull();
    expect(per.get(scene)).toBeNull();
    expect(made).toHaveLength(1);
    scene.shutdown();
    expect(per.get(scene)).toBeNull();
    expect(made).toHaveLength(2);
  });
});
