import type { ConsentRegion } from '../telemetry/consent-gate';

/**
 * Where the system tracking question (iOS App Tracking Transparency) stands: `not_determined` =
 * it can still be asked; `decided` = the player already answered; `unavailable` = there is no such
 * question here (Android, the browser).
 */
export type TrackingStatus = 'not_determined' | 'decided' | 'unavailable';

/** The consent of ads: Google UMP and, on iOS, the tracking question (docs/09-services-analytics.md, section 4). */
export interface ConsentService {
  /**
   * Refreshes the UMP consent info and shows its form where the law asks for one. Never rejects:
   * a failing call (blocked domains) just ends, the ads then start anyway.
   */
  gather(): Promise<void>;
  /** The settings must offer the way back to the consent form (known after `gather`). */
  privacyOptionsRequired(): boolean;
  /** Opens the UMP privacy options form; resolves when it is closed. Never rejects. */
  showPrivacyOptions(): Promise<void>;
  trackingStatus(): Promise<TrackingStatus>;
  /** Shows the system tracking question; resolves when it is answered. Never rejects. */
  requestTracking(): Promise<void>;
  /** What the last UMP info said about the region: consent required here or not ('unknown' before any). */
  region(): ConsentRegion;
  /** Refreshes the UMP info silently (never a form), to learn the region. Never rejects. */
  refreshInfo(): Promise<void>;
  /** Called after every change the consent may have had: the info refreshed, a form closed. */
  onChange(listener: () => void): void;
}
