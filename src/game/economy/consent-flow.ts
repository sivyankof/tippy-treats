import type { ConsentService } from '../../services/consent/types';
import type { AdsService } from '../../services/rewarded-video/types';

/** What the flow needs from the game around it (injected, so the decisions are tested without the app). */
export interface ConsentFlowDeps {
  consent: Pick<ConsentService, 'gather' | 'trackingStatus' | 'requestTracking'>;
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
 * The consent of ads, in the order the docs set: (1) on iOS, once, our explainer and then the
 * system tracking question; (2) Google UMP refreshes its info and shows its form only where the law
 * asks; (3) the ads start. The tracking question goes first because UMP, when an IDFA message is
 * published in AdMob, asks it itself with Google's own explainer while it is still open; once it is
 * answered UMP has no such form (docs/09-services-analytics.md, section 4). At every later launch
 * the same steps run silently (UMP is meant to be asked each launch, the explainer and the question
 * are not repeated). A failing step never stops the next: the ads start whatever the answers were,
 * and show non-personalised ones when consent or tracking is refused (the SDK decides that itself).
 * Resolves with true when our own explainer window was shown (the Google form is native and not
 * reported by the service). Never rejects.
 */
export async function runConsentFlow(deps: ConsentFlowDeps): Promise<boolean> {
  session.started = true;
  let shown = false;
  try {
    if (!deps.attAsked && (await deps.consent.trackingStatus()) === 'not_determined') {
      if (await deps.explain()) {
        shown = true;
        await deps.consent.requestTracking();
        deps.markAttAsked();
      }
    }
  } catch {
    // Consent services never reject; this keeps a surprise from stopping the next step.
  }
  try {
    await deps.consent.gather();
  } catch {
    // Same: the ads start whatever happened here.
  }
  try {
    await deps.ads.init();
  } catch {
    // The ads stay unavailable; the game goes on.
  }
  return shown;
}
