/**
 * Counts the audio nodes the game has created and released, for the leak check
 * (`AudioService.debugStats`). One tally per audio context, shared by the sound synth and the music.
 */
export class NodeTally {
  private created = 0;
  private released = 0;

  /** Nodes that were created and not released yet. */
  get live(): number {
    return this.created - this.released;
  }

  get createdTotal(): number {
    return this.created;
  }

  /** Counts `nodes` as created. */
  add(nodes: readonly unknown[]): void {
    this.created += nodes.length;
  }

  /** Counts `nodes` as released. */
  release(nodes: readonly unknown[]): void {
    this.released += nodes.length;
  }
}

/** The members of a started source node that the scheduling helper uses. */
export interface TimedSource extends AudioNode {
  onended: ((event: Event) => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

/**
 * Starts `source` at `start`, stops it at `stopAt`, and disconnects every node of `nodes` (the
 * source included) once it ends, so no node outlives its sound. The nodes are counted in `tally`.
 * Every voice of the sounds and of the music goes through this one function.
 */
export function runSource(
  tally: NodeTally,
  source: TimedSource,
  nodes: readonly AudioNode[],
  start: number,
  stopAt: number,
): void {
  tally.add(nodes);
  source.onended = () => {
    for (const node of nodes) node.disconnect();
    tally.release(nodes);
  };
  source.start(start);
  source.stop(stopAt);
}
