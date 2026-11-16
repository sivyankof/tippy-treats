/** An object made for one start of a scene. */
export interface SceneOwned {
  destroy(): void;
}

export interface PerSceneSpec<S extends object, T extends SceneOwned> {
  make(scene: S): T;
  /** Whether a held object can still be used: nothing destroyed its parts behind its back. */
  usable(item: T): boolean;
  /** Calls `fn` once when the scene shuts down (stop or restart). */
  onShutdown(scene: S, fn: () => void): void;
}

/**
 * One object per scene that lives exactly as long as one start of the scene: made on first use,
 * destroyed and forgotten when the scene shuts down. Phaser reuses the scene object on the next
 * start, so a plain map keyed by the scene would hand the next run an object whose parts the
 * shutdown destroyed (a child on the update list dies there even when its parent is not on the
 * display list). A held object found unusable is replaced; `null` when even a fresh one is not
 * usable. Phaser-free.
 */
export class PerScene<S extends object, T extends SceneOwned> {
  private readonly items = new WeakMap<S, T>();
  /** Scenes that already have a shutdown listener for this start. */
  private readonly listening = new WeakSet<S>();
  /** Scenes where even a fresh object was unusable in this start: not rebuilt until the next one. */
  private readonly failed = new WeakSet<S>();

  constructor(private readonly spec: PerSceneSpec<S, T>) {}

  get(scene: S): T | null {
    if (this.failed.has(scene)) return null;
    const held = this.items.get(scene);
    if (held) {
      if (this.spec.usable(held)) return held;
      this.drop(scene, held);
    }
    if (!this.listening.has(scene)) {
      this.listening.add(scene);
      this.spec.onShutdown(scene, () => this.shutdown(scene));
    }
    const made = this.spec.make(scene);
    this.items.set(scene, made);
    if (this.spec.usable(made)) return made;
    this.drop(scene, made);
    this.failed.add(scene);
    return null;
  }

  private shutdown(scene: S): void {
    this.listening.delete(scene);
    this.failed.delete(scene);
    const held = this.items.get(scene);
    if (held) this.drop(scene, held);
  }

  private drop(scene: S, item: T): void {
    if (this.items.get(scene) === item) this.items.delete(scene);
    item.destroy();
  }
}
