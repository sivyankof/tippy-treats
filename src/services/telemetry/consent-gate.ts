/**
 * Whether Firebase Analytics may collect (docs/09-services-analytics.md, section 6, owner's decision
 * of 2026-11-20): in the EEA, the UK and Switzerland it follows the answer of the Google UMP form,
 * elsewhere it is on. Pure: the signals are read by the caller.
 */

/** The IAB TCF strings UMP writes on the device after the form was answered. */
export interface ConsentSignals {
  /** `IABTCF_gdprApplies`: true or false once UMP has decided, null when it never wrote it. */
  gdprApplies: boolean | null;
  /** `IABTCF_PurposeConsents`: '1'/'0' per TCF purpose, purpose 1 first; '' when absent. */
  purposeConsents: string;
}

/** What the last UMP consent info said about the player's region. */
export type ConsentRegion = 'required' | 'not_required' | 'unknown';

export type AnalyticsDecision = 'on' | 'off' | 'unknown';

/**
 * TCF purpose 1, "store and/or access information on a device": without it Analytics cannot keep
 * its app instance id, so it is the consent that analytics needs.
 */
const STORAGE_PURPOSE_INDEX = 0;

/**
 * The decision: the TCF strings first (they are the player's answer); without them the region UMP
 * reported (consent not required → on; required but not answered yet → off); nothing known → unknown.
 */
export function analyticsDecision(
  signals: ConsentSignals | null,
  region: ConsentRegion,
): AnalyticsDecision {
  if (signals?.gdprApplies === true) {
    return signals.purposeConsents.charAt(STORAGE_PURPOSE_INDEX) === '1' ? 'on' : 'off';
  }
  if (signals?.gdprApplies === false) return 'on';
  if (region === 'not_required') return 'on';
  if (region === 'required') return 'off';
  return 'unknown';
}

/** The region from a UMP consent status (`AdmobConsentStatus`): a status other than "not required" means a regulated region. */
export function regionOfStatus(status: string): ConsentRegion {
  if (status === 'NOT_REQUIRED') return 'not_required';
  if (status === 'REQUIRED' || status === 'OBTAINED') return 'required';
  return 'unknown';
}
