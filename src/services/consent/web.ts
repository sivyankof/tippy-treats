import type { ConsentService, TrackingStatus } from './types';

/**
 * The browser has no consent form and no tracking question: UMP is not required, ATT is not
 * there. In dev, `demo` plays the phone's side (`?consent=1`): the tracking question is still open
 * and the privacy options are offered, so the explainer and the settings row can be looked at.
 */
export class WebConsent implements ConsentService {
  private asked = false;

  constructor(private readonly demo = false) {}

  gather(): Promise<void> {
    return Promise.resolve();
  }

  privacyOptionsRequired(): boolean {
    return this.demo;
  }

  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }

  trackingStatus(): Promise<TrackingStatus> {
    if (!this.demo) return Promise.resolve('unavailable');
    return Promise.resolve(this.asked ? 'decided' : 'not_determined');
  }

  requestTracking(): Promise<void> {
    this.asked = true;
    return Promise.resolve();
  }
}
