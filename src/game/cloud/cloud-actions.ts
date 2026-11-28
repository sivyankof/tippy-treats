import { CLOUD } from '../../data/app/cloud';
import { cloudSaveShown, services } from '../../services';
import { gameState, timers } from '../../state';
import type { LoadOutcome } from '../../state/game-state';
import { realNow } from '../../util/clock';
import { overridesSave, readDebugParams, readPerfParams } from '../../util/debug-params';
import { makeInstallId } from '../../util/install-id';
import { CloudSync } from './cloud-sync';

let cloud: CloudSync | null = null;
/** Stands in before `bindCloud`: never started, no cloud. */
let idle: CloudSync | null = null;

/** The cloud of this launch; before `bindCloud` one that has no cloud. */
export function cloudSync(): CloudSync {
  if (cloud) return cloud;
  if (!idle) {
    idle = createSync(() => Promise.resolve());
    idle.disable('unsupported');
  }
  return idle;
}

function createSync(afterAdopt: () => Promise<void>): CloudSync {
  return new CloudSync({
    service: services.cloudSave,
    state: gameState,
    now: realNow,
    newId: makeInstallId,
    scheduler: timers,
    blocked: () => gameState.debugTouched,
    afterAdopt,
  });
}

/**
 * Ties the cloud copy to the save once per launch, after the local load (docs/08-architecture.md,
 * section 5, "Облачная копия"). No cloud at all where the platform has none, under a debug
 * override that writes into the save, in `?perf=1`, and when the local save was not read.
 * `afterAdopt` runs after a copy was taken (the purchase check).
 */
export function bindCloud(outcome: LoadOutcome | null, afterAdopt: () => Promise<void>): void {
  if (cloud) return;
  const sync = createSync(afterAdopt);
  cloud = sync;
  if (!cloudSaveShown || overridesSave(readDebugParams()) || readPerfParams() !== null) {
    sync.disable('unsupported');
    return;
  }
  if (outcome?.status !== 'loaded') {
    sync.disable('error');
    return;
  }
  sync.start();
  gameState.onRunRecorded(() => void sync.sync());
  // Going to the background writes (within the interval); coming back reads what changed.
  // In the background the timers of the page stop: the write there does not wait for the interval.
  document.addEventListener(
    'visibilitychange',
    () => void sync.sync({ immediate: document.visibilityState === 'hidden' }),
  );
}

/** A purchase or a payout changed the save: a write follows (within the interval). */
export function requestCloudWrite(): void {
  void cloud?.sync();
}

/** The progress was reset: the reset save goes to the cloud at once. */
export function cloudAfterReset(): void {
  void cloud?.sync({ immediate: true });
}

/** Home holds its buttons and windows until the first cloud answer, `CLOUD.readTimeoutMs` at most. */
export function waitCloudOnHome(): Promise<void> {
  return cloudSync().waitFirstAnswer(CLOUD.readTimeoutMs);
}
