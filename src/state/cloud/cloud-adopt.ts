// Taking a cloud copy of the save, as pure rules (docs/08-architecture.md, section 5, "Принятие копии").
import type { CloudCopy } from '../../core/save/cloud-merge';
import type { Save } from '../../core/save/schema';

/**
 * The local save replaced by the copy. What describes this device stays: the install id (the
 * seed of the missions and the gift, the support mail), `lastSeenAt` (the clock of another device
 * must not trip the clock-back guard), the consents, the ad counters, the notification day, the
 * rating request and the settings. "No ads" this device has stays on (the store gave it here, and
 * the ownership alone never makes the copy go out again): an offline device would show ads to a
 * player who paid until the next purchase check. The starter pack comes from the copy only: its
 * flag owned here would keep the check from giving back the creature the copy lacks. The paid transactions come from the copy: the purchase check
 * that follows pays again what this device bought and the copy lacks. The device now knows the
 * copy, with nothing changed since.
 */
export function withCloudAdopted(local: Save, copy: Pick<CloudCopy, 'rev' | 'id' | 'save'>): Save {
  const { save } = copy;
  return {
    ...save,
    installId: local.installId,
    lastSeenAt: local.lastSeenAt,
    consent: local.consent,
    ads: local.ads,
    notif: local.notif,
    review: local.review,
    settings: local.settings,
    purchases: {
      ...save.purchases,
      removeAds: save.purchases.removeAds || local.purchases.removeAds,
    },
    iap: { processedTx: [...save.iap.processedTx] },
    sync: { cloudRev: copy.rev, cloudId: copy.id, dirty: false },
  };
}

/**
 * The save after its copy `rev`/`id` reached the cloud. `changedSince`: the progress changed
 * while the copy was on its way, so the cloud is behind again.
 */
export function withCloudSent(save: Save, rev: number, id: string, changedSince: boolean): Save {
  return { ...save, sync: { cloudRev: rev, cloudId: id, dirty: changedSince } };
}
