import { describe, expect, it } from 'vitest';
import { NativeConsent, type ConsentPlugin } from './native';
import { WebConsent } from './web';

function fake(overrides: Partial<ConsentPlugin> = {}) {
  const calls: string[] = [];
  const info = (status: string, options = 'NOT_REQUIRED') => ({
    status,
    isConsentFormAvailable: true,
    privacyOptionsRequirementStatus: options,
  });
  const plugin: ConsentPlugin = {
    requestConsentInfo: () => {
      calls.push('info');
      return Promise.resolve(info('NOT_REQUIRED'));
    },
    showConsentForm: () => {
      calls.push('form');
      return Promise.resolve(info('OBTAINED', 'REQUIRED'));
    },
    showPrivacyOptionsForm: () => {
      calls.push('options');
      return Promise.resolve();
    },
    trackingAuthorizationStatus: () => Promise.resolve({ status: 'notDetermined' }),
    requestTrackingAuthorization: () => {
      calls.push('att');
      return Promise.resolve();
    },
    ...overrides,
  };
  return { plugin, calls, info };
}

describe('NativeConsent', () => {
  it('only refreshes the info where no form is required', async () => {
    const { plugin, calls } = fake();
    const consent = new NativeConsent(plugin, 'android');
    await consent.gather();
    expect(calls).toEqual(['info']);
    expect(consent.privacyOptionsRequired()).toBe(false);
  });

  it('shows the form where it is required and then offers the privacy options', async () => {
    const { plugin, calls, info } = fake();
    plugin.requestConsentInfo = () => Promise.resolve(info('REQUIRED', 'REQUIRED'));
    const consent = new NativeConsent(plugin, 'android');
    await consent.gather();
    expect(calls).toEqual(['form']);
    expect(consent.privacyOptionsRequired()).toBe(true);
    await consent.showPrivacyOptions();
    expect(calls).toEqual(['form', 'options']);
  });

  it('knows the region and tells the listeners after every change', async () => {
    const { plugin, info } = fake();
    const consent = new NativeConsent(plugin, 'android');
    let heard = 0;
    consent.onChange(() => heard++);
    expect(consent.region()).toBe('unknown');
    await consent.refreshInfo();
    expect(consent.region()).toBe('not_required');
    plugin.requestConsentInfo = () => Promise.resolve(info('REQUIRED'));
    await consent.gather();
    expect(consent.region()).toBe('required');
    await consent.showPrivacyOptions();
    expect(heard).toBe(3);
  });

  it('refreshes the info without ever showing the form', async () => {
    const { plugin, calls, info } = fake();
    plugin.requestConsentInfo = () => {
      calls.push('info');
      return Promise.resolve(info('REQUIRED'));
    };
    const consent = new NativeConsent(plugin, 'ios');
    await consent.refreshInfo();
    expect(calls).toEqual(['info']);
    plugin.requestConsentInfo = () => Promise.reject(new Error('offline'));
    await expect(consent.refreshInfo()).resolves.toBeUndefined();
  });

  it('never throws when the calls fail or hang', async () => {
    const failing = fake({
      requestConsentInfo: () => Promise.reject(new Error('blocked')),
      showPrivacyOptionsForm: () => Promise.reject(new Error('x')),
      trackingAuthorizationStatus: () => Promise.reject(new Error('x')),
      requestTrackingAuthorization: () => Promise.reject(new Error('x')),
    });
    const consent = new NativeConsent(failing.plugin, 'ios');
    await expect(consent.gather()).resolves.toBeUndefined();
    await expect(consent.showPrivacyOptions()).resolves.toBeUndefined();
    await expect(consent.trackingStatus()).resolves.toBe('unavailable');
    await expect(consent.requestTracking()).resolves.toBeUndefined();

    const hanging = fake({ requestConsentInfo: () => new Promise(() => undefined) });
    await expect(new NativeConsent(hanging.plugin, 'ios', 5).gather()).resolves.toBeUndefined();
  });

  it('knows the tracking question on iOS only', async () => {
    const ios = fake();
    const consent = new NativeConsent(ios.plugin, 'ios');
    expect(await consent.trackingStatus()).toBe('not_determined');
    await consent.requestTracking();
    expect(ios.calls).toEqual(['att']);

    const decided = fake({
      trackingAuthorizationStatus: () => Promise.resolve({ status: 'denied' }),
    });
    expect(await new NativeConsent(decided.plugin, 'ios').trackingStatus()).toBe('decided');

    const android = fake();
    const droid = new NativeConsent(android.plugin, 'android');
    expect(await droid.trackingStatus()).toBe('unavailable');
    await droid.requestTracking();
    expect(android.calls).toEqual([]);
  });
});

describe('WebConsent', () => {
  it('has nothing to ask in a plain browser', async () => {
    const consent = new WebConsent();
    await consent.gather();
    expect(consent.privacyOptionsRequired()).toBe(false);
    expect(await consent.trackingStatus()).toBe('unavailable');
  });

  it('plays the phone in demo mode: the question is open until it is answered', async () => {
    const consent = new WebConsent(true);
    expect(consent.privacyOptionsRequired()).toBe(true);
    expect(await consent.trackingStatus()).toBe('not_determined');
    await consent.requestTracking();
    expect(await consent.trackingStatus()).toBe('decided');
  });
});
