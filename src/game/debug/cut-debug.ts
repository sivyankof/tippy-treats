import { CUT_VARIANT_NAMES, type CutVariantName } from '../../data/cuts/cut-look';
import * as Phaser from 'phaser';
import { cutOverride } from '../fx/cuts/cut-override';
import { OffsetDriver, type DropDriver } from '../perf/perf-drivers';
import type { GameScene } from '../scenes/game-scene';

/** Share of the layer width the dropped layer is off the tower by, per variant: a big piece needs more than `bigShare`. */
const DEBUG_SHARE: Readonly<Record<CutVariantName, number>> = {
  plain: 0.2,
  strands: 0.2,
  panic: 0.25,
  big: 0.42,
};

/** The dev hook `window.tippyCut`. */
export type CutHook = (variant?: CutVariantName, share?: number) => boolean;

/**
 * Dev build only: `window.tippyCut('plain' | 'strands' | 'panic' | 'big', share?)` makes the next
 * cut that variant and drops the flying layer as soon as it is the right distance off the tower
 * (`share` of its width, when given: a thin sliver, say), so the effect starts at once. Returns
 * false when there is no flying layer to drop.
 */
export function installCutDebug(scene: GameScene): void {
  const win = window as Window & { tippyCut?: CutHook };
  // The driver the run had before the hook stepped in; kept across calls so a second call before the drop does not restore the first hook's driver.
  let restore: { driver: DropDriver | null } | null = null;
  const hook = (variant: CutVariantName = 'plain', share?: number): boolean => {
    if (!CUT_VARIANT_NAMES.includes(variant)) return false;
    restore ??= { driver: scene.drivers.current };
    cutOverride.setNext(variant);
    scene.drivers.set(
      new OffsetDriver(share ?? DEBUG_SHARE[variant], () => {
        scene.drivers.set(restore?.driver ?? null);
        restore = null;
      }),
    );
    return true;
  };
  win.tippyCut = hook;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (win.tippyCut === hook) delete win.tippyCut;
  });
}
