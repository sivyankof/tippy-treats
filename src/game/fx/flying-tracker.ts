import type { TowerState } from '../../core/tower-sim';
import type { FlyingMemo } from './run-fx';

/** Remembers the flying layer before each sim step, in one reused object. */
export class FlyingTracker {
  private readonly memo: FlyingMemo = {
    x: 0,
    width: 0,
    kind: 'plain',
    creature: undefined,
    level: undefined,
  };
  private last: FlyingMemo | null = null;

  /** The flying layer before the latest step, or `null`. */
  get current(): FlyingMemo | null {
    return this.last;
  }

  /** Call before the sim step: copies the flying layer of the state. */
  note(state: Readonly<TowerState>): void {
    const flying = state.flying;
    if (!flying) {
      this.last = null;
      return;
    }
    const memo = this.memo;
    memo.x = flying.x;
    memo.width = flying.width;
    memo.kind = flying.kind;
    memo.creature = flying.creature;
    memo.level = flying.level;
    this.last = memo;
  }

  reset(): void {
    this.last = null;
  }
}
