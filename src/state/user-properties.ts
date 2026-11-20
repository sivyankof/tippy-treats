// The user properties of the analytics (docs/09-services-analytics.md, section 6): coarse facts
// about the player's progress. No id of the player or the install is among them.
import type { Save } from '../core/save/schema';
import { MS_PER_DAY } from '../data/app/clock';
import { TELEMETRY } from '../data/app/telemetry';
import type { AnalyticsService } from '../services/telemetry/types';

/** Name of the bucket `value` falls into: the first whose `upTo` is not below it, else `last`. */
export function bucketOf(
  value: number,
  buckets: ReadonlyArray<{ upTo: number; name: string }>,
  last: string,
): string {
  return buckets.find((bucket) => value <= bucket.upTo)?.name ?? last;
}

/** The properties of a save at the time `nowMs`; every value is a text. */
export function userPropertiesOf(save: Save, nowMs: number): Record<string, string> {
  const days = Math.max(0, Math.floor((nowMs - save.createdAt) / MS_PER_DAY));
  const payer =
    save.purchases.removeAds || save.purchases.starterPack || save.iap.processedTx.length > 0;
  return {
    baker_level: String(save.bakerLevel),
    creatures_owned: String(Object.keys(save.creatures).length),
    best_height_bucket: bucketOf(
      save.records.classicHeight,
      TELEMETRY.heightBuckets,
      TELEMETRY.heightBucketLast,
    ),
    payer: payer ? '1' : '0',
    install_age_bucket: bucketOf(days, TELEMETRY.installBuckets, TELEMETRY.installBucketLast),
  };
}

/** Sends the user properties that changed since the last call (all of them on the first). */
export class UserPropertySync {
  private sent: Record<string, string> = {};

  constructor(private readonly analytics: AnalyticsService) {}

  sync(save: Save, nowMs: number): void {
    const next = userPropertiesOf(save, nowMs);
    for (const [name, value] of Object.entries(next)) {
      if (this.sent[name] === value) continue;
      this.sent[name] = value;
      this.analytics.setUserProperty(name, value);
    }
  }
}
