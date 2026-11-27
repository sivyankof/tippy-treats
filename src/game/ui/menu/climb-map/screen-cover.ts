/** What can be hidden: every display object, a container, a button. */
interface Hideable {
  visible: boolean;
  active: boolean;
  setVisible(visible: boolean): unknown;
}

function isHideable(item: unknown): item is Hideable {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as { setVisible?: unknown }).setVisible === 'function'
  );
}

/**
 * Hides the parts of a screen that stand under a full-size window and shows them again. It
 * remembers what was visible before, so a part the screen keeps hidden by itself stays hidden.
 */
export class ScreenCover {
  private held: Array<[Hideable, boolean]> = [];

  /** Hides `items` (the ones that cannot be hidden are left alone); a second call before `restore` does nothing. */
  hide(items: readonly unknown[]): void {
    if (this.held.length > 0) return;
    for (const item of items) {
      if (!isHideable(item)) continue;
      this.held.push([item, item.visible]);
      item.setVisible(false);
    }
  }

  /** Shows again what `hide` hid. */
  restore(): void {
    for (const [item, visible] of this.held) if (item.active) item.setVisible(visible);
    this.held = [];
  }

  get covering(): boolean {
    return this.held.length > 0;
  }
}
