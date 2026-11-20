import { describe, expect, it, vi } from 'vitest';
import { bindAnalyticsConsent, toConsentSignals, type ConsentSource } from './collection-consent';
import type { ConsentRegion, ConsentSignals } from './consent-gate';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function fakeConsent(regionAfterRefresh: ConsentRegion) {
  let region: ConsentRegion = 'unknown';
  let listener: () => void = () => undefined;
  const consent: ConsentSource = {
    region: () => region,
    refreshInfo: vi.fn(() => {
      region = regionAfterRefresh;
      return Promise.resolve();
    }),
    onChange: (cb) => {
      listener = cb;
    },
  };
  return { consent, change: () => listener() };
}

describe('bindAnalyticsConsent', () => {
  it('decides at once from the TCF strings, without asking UMP', async () => {
    const gate = { decide: vi.fn() };
    const { consent } = fakeConsent('required');
    bindAnalyticsConsent(gate, consent, () =>
      Promise.resolve({ gdprApplies: true, purposeConsents: '0' }),
    );
    await flush();
    expect(gate.decide).toHaveBeenLastCalledWith('off');
    expect(consent.refreshInfo).not.toHaveBeenCalled();
  });

  it('asks UMP once when nothing is on the device, and follows the region', async () => {
    const gate = { decide: vi.fn() };
    const { consent } = fakeConsent('not_required');
    bindAnalyticsConsent(gate, consent, () => Promise.resolve(null));
    await flush();
    expect(consent.refreshInfo).toHaveBeenCalledOnce();
    expect(gate.decide).toHaveBeenLastCalledWith('on');
  });

  it('decides again after the form: refusal turns it off, a later consent on', async () => {
    const gate = { decide: vi.fn() };
    const { consent, change } = fakeConsent('required');
    let signals: ConsentSignals | null = null;
    bindAnalyticsConsent(gate, consent, () => Promise.resolve(signals));
    await flush();
    expect(gate.decide).toHaveBeenLastCalledWith('off');
    signals = { gdprApplies: true, purposeConsents: '1111' };
    change();
    await flush();
    expect(gate.decide).toHaveBeenLastCalledWith('on');
    expect(consent.refreshInfo).toHaveBeenCalledOnce();
  });

  it('treats a failing read as no strings and stays undecided offline', async () => {
    const gate = { decide: vi.fn() };
    const { consent } = fakeConsent('unknown');
    bindAnalyticsConsent(gate, consent, () => Promise.reject(new Error('no plugin')));
    await flush();
    expect(gate.decide).toHaveBeenLastCalledWith('unknown');
  });
});

describe('toConsentSignals', () => {
  it('maps the stored numbers and strings', () => {
    expect(toConsentSignals({ gdprApplies: 1, purposeConsents: '10' })).toEqual({
      gdprApplies: true,
      purposeConsents: '10',
    });
    expect(toConsentSignals({ gdprApplies: 0, purposeConsents: null })).toEqual({
      gdprApplies: false,
      purposeConsents: '',
    });
    expect(toConsentSignals({ gdprApplies: null, purposeConsents: null }).gdprApplies).toBeNull();
  });
});
