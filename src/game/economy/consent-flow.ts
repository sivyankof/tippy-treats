import type { ConsentService } from '../../services/consent/types';
import type { AdsService } from '../../services/rewarded-video/types';

/** What the flow needs from the game around it (injected, so the decisions are tested without the app). */
export interface ConsentFlowDeps {
  consent: ConsentService;
  ads: Pick<AdsService, 'init'>;
  /** The tracking explainer and question were already gone through (`save.consent.attAsked`). */
  attAsked: boolean;
  /** Remembers in the save that the tracking question was asked. */
  markAttAsked(): void;
  /** Shows our own explainer window; true when the player pressed Continue, false when it could not be shown. */
  explain(): Promise<boolean>;
}

/** The consent flow started in this launch of the app; it runs once per launch. */
const session = { started: false };

/** First finished run done and the flow has not run yet in this launch (docs/09-services-analytics.md, section 4). */
export function consentDue(finishedRuns: number): boolean {
  return finishedRuns >= 1 && !session.started;
}

/** Test hook: a new launch of the app. */
export function resetConsentSession(): void {
  session.started = false;
}

/**
 * The consent of ads, in the order the docs set: (1) Google UMP refreshes its info and shows its
 * form only where the law asks; (2) on iOS, once, our explainer and then the system tracking
 * question; (3) the ads start. At every later launch the same steps run silently (UMP is meant to
 * be asked each launch, the explainer and the question are not repeated). A failing step never
 * stops the next: the ads start whatever the answers were, and show non-personalised ones when
 * consent or tracking is refused (the SDK decides that itself). Never rejects.
 */
export async function runConsentFlow(deps: ConsentFlowDeps): Promise<void> {
  session.started = true;
  try {
    await deps.consent.gather();
    if (!deps.attAsked && (await deps.consent.trackingStatus()) === 'not_determined') {
      if (await deps.explain()) {
        await deps.consent.requestTracking();
        deps.markAttAsked();
      }
    }
  } catch {
    // Consent services never reject; this keeps a surprise from stopping the ads.
  }
  try {
    await deps.ads.init();
  } catch {
    // The ads stay unavailable; the game goes on.
  }
}
