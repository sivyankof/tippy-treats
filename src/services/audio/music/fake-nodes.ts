/**
 * Stand-ins for the Web Audio nodes the music code touches, shared by its tests (no test runner
 * is needed here, so the file is a plain module; the game never imports it).
 */

/** An `AudioParam` that follows its last scheduled value (enough for the levels the music sets). */
export class FakeParam {
  value = 0;
  /** Context time the last ramp ends at. */
  rampEnd = 0;
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number, at = 0): void {
    this.value = v;
    this.rampEnd = at;
  }
}

/** A node that can be wired and unwired. */
export class FakeNode {
  connect(): void {}
  disconnect(): void {}
}

/** A `GainNode` with its level. */
export class FakeGain extends FakeNode {
  gain = new FakeParam();
}
