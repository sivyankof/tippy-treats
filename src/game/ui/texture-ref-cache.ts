/**
 * Counts the users of baked textures and keeps the unused ones for a while. A texture with users
 * is never given up; an unused one stays (so showing it again costs no bake) until `evict` is
 * called, which removes the oldest unused ones beyond `idleLimit`. The order is the order of use.
 *
 * The cache holds keys only: what removing a texture means is up to the caller (`evict` hands
 * the keys over), so it runs without Phaser.
 */
export class TextureRefCache {
  private readonly refs = new Map<string, number>();
  /** Keys made ahead for a user that has not taken them yet (`reserve`): `dropIfIdle` leaves them. */
  private readonly reserved = new Set<string>();

  constructor(private readonly idleLimit: number) {}

  /** Counts one more user of `key` and marks it as the newest. */
  acquire(key: string): void {
    const users = this.refs.get(key) ?? 0;
    this.refs.delete(key);
    this.refs.set(key, users + 1);
    this.reserved.delete(key);
  }

  /**
   * Marks `key` as made ahead for a user that comes soon (a picture baked before its layer lands): until a user takes
   * it, `dropIfIdle` leaves it. The idle limit still applies to it, as to any unused key.
   */
  reserve(key: string): void {
    this.reserved.add(key);
  }

  /** Gives one user back. A key nobody holds (or the cache does not know) is left alone. */
  release(key: string): void {
    const users = this.refs.get(key);
    if (users === undefined || users <= 0) return;
    this.refs.set(key, users - 1);
  }

  /** Whether any user holds `key`. */
  isHeld(key: string): boolean {
    return (this.refs.get(key) ?? 0) > 0;
  }

  /**
   * Forgets `key` now if nobody holds it and nobody is waiting for it (`reserve`); the caller removes the texture. True
   * when it did.
   */
  dropIfIdle(key: string): boolean {
    const users = this.refs.get(key);
    if (users === undefined || users > 0 || this.reserved.has(key)) return false;
    this.refs.delete(key);
    return true;
  }

  /** Removes (through `remove`) the oldest unused keys beyond `idleLimit`. */
  evict(remove: (key: string) => void): void {
    let idle = [...this.refs].filter(([, users]) => users <= 0);
    for (const [key] of idle) {
      if (idle.length <= this.idleLimit) break;
      this.refs.delete(key);
      this.reserved.delete(key);
      remove(key);
      idle = idle.filter(([other]) => other !== key);
    }
  }
}
