import type { CutVariantName } from '../../data/cuts/cut-look';

/**
 * A variant every cut is forced to, or the next cut only: the benchmark forces strands on every
 * cut, the dev hook `window.tippyCut` the one it starts. Nothing of it reaches the sim or the save.
 */
class CutOverride {
  private always: CutVariantName | null = null;
  private next: CutVariantName | null = null;
  private count = 0;

  setAlways(name: CutVariantName | null): void {
    this.always = name;
    this.count = 0;
  }

  /** How many cuts took the forced variant since `setAlways` (the benchmark notes it). */
  get forcedCuts(): number {
    return this.count;
  }

  setNext(name: CutVariantName | null): void {
    this.next = name;
  }

  /** The forced variant of the cut that happens now (the one-shot is used up). */
  take(): CutVariantName | null {
    const name = this.next ?? this.always;
    this.next = null;
    if (name && this.always) this.count++;
    return name;
  }
}

export const cutOverride = new CutOverride();
