import { AD_LOAD } from '../../data/economy/rewarded-video';
import { withTimeout } from '../../util/with-timeout';
import { regionOfStatus, type ConsentRegion } from '../telemetry/consent-gate';
import type { ConsentService, TrackingStatus } from './types';

interface ConsentInfo {
  status: string;
  isConsentFormAvailable?: boolean;
  privacyOptionsRequirementStatus: string;
}

/** What the game needs of `@capacitor-community/admob` for consent (injected, so tests run without the app). */
export interface ConsentPlugin {
  requestConsentInfo(): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  trackingAuthorizationStatus(): Promise<{ status: string }>;
  requestTrackingAuthorization(): Promise<void>;
}

/** The values the plugin reports (`AdmobConsentStatus`, `PrivacyOptionsRequirementStatus`). */
const REQUIRED = 'REQUIRED';
const NOT_DETERMINED = 'notDetermined';

/**
 * Consent on the phone through the AdMob plugin (Google UMP, and App Tracking Transparency on
 * iOS). Every call is guarded: a failing or silent plugin never throws and never holds the game
 * longer than `AD_LOAD.consentTimeoutMs`.
 */
export class NativeConsent implements ConsentService {
  private optionsRequired = false;
  private lastRegion: ConsentRegion = 'unknown';
  private readonly listeners: Array<() => void> = [];

  constructor(
    private readonly plugin: ConsentPlugin,
    private readonly platform: 'ios' | 'android',
    private readonly timeoutMs: number = AD_LOAD.consentTimeoutMs,
  ) {}

  async gather(): Promise<void> {
    try {
      let info = await this.requestInfo();
      // Google's order: refresh the info at every launch, show the form only where it is needed.
      if (info.status === REQUIRED && info.isConsentFormAvailable !== false) {
        info = await this.plugin.showConsentForm();
        this.note(info);
      }
    } catch {
      // Offline or blocked: carry on, the ads decide for themselves what they may show.
    }
    this.changed();
  }

  region(): ConsentRegion {
    return this.lastRegion;
  }

  async refreshInfo(): Promise<void> {
    try {
      await this.requestInfo();
    } catch {
      // Offline or blocked: the region stays unknown.
    }
    this.changed();
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private async requestInfo(): Promise<ConsentInfo> {
    const info = await withTimeout(this.plugin.requestConsentInfo(), this.timeoutMs);
    this.note(info);
    return info;
  }

  private note(info: ConsentInfo): void {
    this.optionsRequired = info.privacyOptionsRequirementStatus === REQUIRED;
    this.lastRegion = regionOfStatus(info.status);
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A listener's failure is not the consent's.
      }
    }
  }

  privacyOptionsRequired(): boolean {
    return this.optionsRequired;
  }

  async showPrivacyOptions(): Promise<void> {
    try {
      await this.plugin.showPrivacyOptionsForm();
    } catch {
      // Nothing to do: the form could not open.
    }
    this.changed();
  }

  async trackingStatus(): Promise<TrackingStatus> {
    if (this.platform !== 'ios') return 'unavailable';
    try {
      const { status } = await this.plugin.trackingAuthorizationStatus();
      return status === NOT_DETERMINED ? 'not_determined' : 'decided';
    } catch {
      return 'unavailable';
    }
  }

  async requestTracking(): Promise<void> {
    if (this.platform !== 'ios') return;
    try {
      await this.plugin.requestTrackingAuthorization();
    } catch {
      // The question could not be shown; the ads go on without the identifier.
    }
  }
}
