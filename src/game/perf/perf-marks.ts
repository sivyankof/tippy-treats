import type { PerfPart } from '../../data/debug/perf';

/** Objects of the run screen that belong to a part `?perf=1` can hide (the backdrop marks its own). */
const marks = new WeakMap<object, PerfPart>();

/** Tells the benchmark which part an object is: a WeakMap entry, nothing else changes. */
export function markPerfPart(object: object, part: PerfPart): void {
  marks.set(object, part);
}

/** The part an object was marked as, `undefined` when none. */
export function perfPartOf(object: object): PerfPart | undefined {
  return marks.get(object);
}
