import type { ConsentService } from '../consent/types';
import { analyticsDecision, type AnalyticsDecision, type ConsentSignals } from './consent-gate';

/** What `bindAnalyticsConsent` needs of the consent service. */
export type ConsentSource = Pick<ConsentService, 'region' | 'refreshInfo' | 'onChange'>;

/**
 * Keeps the analytics gate on the player's consent (docs/09-services-analytics.md, section 6):
 * decides at once from the TCF strings on the device; when they say nothing, asks UMP for its info
 * once (silently, no form) to learn whether consent is required here; decides again whenever the
 * consent service reports a change (the form after the first run, the privacy options form).
 * Never rejects: a failing read is "no strings", an unknown answer leaves the gate as it is.
 */
export function bindAnalyticsConsent(
  gate: { decide(decision: AnalyticsDecision): void },
  consent: ConsentSource,
  readSignals: () => Promise<ConsentSignals | null>,
): { evaluate(): Promise<void> } {
  let refreshed = false;
  const read = (): Promise<ConsentSignals | null> => readSignals().catch(() => null);
  const evaluate = async (): Promise<void> => {
    let decision = analyticsDecision(await read(), consent.region());
    if (decision === 'unknown' && !refreshed) {
      refreshed = true;
      await consent.refreshInfo();
      decision = analyticsDecision(await read(), consent.region());
    }
    gate.decide(decision);
  };
  consent.onChange(() => void evaluate());
  void evaluate();
  return { evaluate };
}

/** The TCF strings as the native `TippyDevice.consentSignals` gives them. */
export interface RawConsentSignals {
  gdprApplies: number | null;
  purposeConsents: string | null;
}

export function toConsentSignals(raw: RawConsentSignals): ConsentSignals {
  return {
    gdprApplies: raw.gdprApplies === 1 ? true : raw.gdprApplies === 0 ? false : null,
    purposeConsents: typeof raw.purposeConsents === 'string' ? raw.purposeConsents : '',
  };
}
